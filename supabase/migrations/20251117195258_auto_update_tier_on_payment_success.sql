-- Auto-update user tier when payment status changes to 'completed'
-- This ensures users get their tier updated even if PayFast webhook fails
-- CRITICAL for production - prevents manual tier updates

CREATE OR REPLACE FUNCTION auto_update_user_tier_on_payment()
RETURNS TRIGGER AS $$
BEGIN
  -- Only proceed if status changed to 'completed' and we have a user_id and tier
  IF NEW.status = 'completed' AND OLD.status != 'completed' 
     AND NEW.user_id IS NOT NULL AND NEW.tier IS NOT NULL THEN
    
    -- Update user_ai_tiers (cast tier to tier_name_aligned enum)
    INSERT INTO user_ai_tiers (user_id, tier, created_at, updated_at)
    VALUES (NEW.user_id, NEW.tier::tier_name_aligned, NOW(), NOW())
    ON CONFLICT (user_id)
    DO UPDATE SET 
      tier = EXCLUDED.tier,
      updated_at = EXCLUDED.updated_at;
    
    -- Update user_ai_usage.current_tier (also tier_name_aligned enum)
    UPDATE user_ai_usage
    SET current_tier = NEW.tier::tier_name_aligned, updated_at = NOW()
    WHERE user_id = NEW.user_id;    -- If no user_ai_usage record exists, create one
    IF NOT FOUND THEN
      INSERT INTO user_ai_usage (
        user_id, 
        current_tier,
        exams_generated_this_month,
        explanations_requested_this_month,
        chat_messages_today,
        created_at,
        updated_at
      ) VALUES (
        NEW.user_id,
        NEW.tier::tier_name_aligned,
        0,
        0,
        0,
        NOW(),
        NOW()
      );
    END IF;
    
    RAISE NOTICE 'Auto-updated tier for user % to %', NEW.user_id, NEW.tier;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on payment_transactions
DROP TRIGGER IF EXISTS trigger_auto_update_tier_on_payment ON payment_transactions;

CREATE TRIGGER trigger_auto_update_tier_on_payment
  AFTER UPDATE ON payment_transactions
  FOR EACH ROW
  EXECUTE FUNCTION auto_update_user_tier_on_payment();

COMMENT ON FUNCTION auto_update_user_tier_on_payment() IS 
'Automatically updates user_ai_tiers and user_ai_usage when a payment is marked as completed. 
This ensures tier updates happen even if PayFast webhook fails. Created 2025-11-17.';
