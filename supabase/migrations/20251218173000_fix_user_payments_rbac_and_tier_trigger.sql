-- Fix user-scoped PayFast payments so tiers reliably update and the app can poll tx status.
--
-- Issues addressed:
-- 1) `payment_transactions` rows created for user-scoped purchases didn't store `user_id` + `tier`,
--    so the tier auto-upgrade trigger couldn't run and the client couldn't SELECT under RLS.
-- 2) Existing completed user-scoped tx rows need a safe backfill based on metadata.
-- 3) The tier auto-upgrade trigger should also run when `user_id`/`tier` are populated after completion.

-- 1) Allow authenticated users to read their own payment transactions (user-scoped checkout).
DROP POLICY IF EXISTS "payment_transactions_user_select" ON public.payment_transactions;
CREATE POLICY "payment_transactions_user_select"
  ON public.payment_transactions
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- 2) Make the auto-upgrade trigger resilient:
--    - Run when tx becomes completed (existing behavior)
--    - Also run when user_id/tier are populated AFTER completion (backfill or late updates)
CREATE OR REPLACE FUNCTION public.auto_update_user_tier_on_payment()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'completed'
     AND NEW.user_id IS NOT NULL
     AND NEW.tier IS NOT NULL
     AND (
       OLD.status IS DISTINCT FROM NEW.status
       OR OLD.user_id IS DISTINCT FROM NEW.user_id
       OR OLD.tier IS DISTINCT FROM NEW.tier
     ) THEN

    -- Update user_ai_tiers (cast tier to tier_name_aligned enum)
    INSERT INTO public.user_ai_tiers (user_id, tier, created_at, updated_at)
    VALUES (NEW.user_id, NEW.tier::public.tier_name_aligned, NOW(), NOW())
    ON CONFLICT (user_id)
    DO UPDATE SET tier = EXCLUDED.tier, updated_at = EXCLUDED.updated_at;

    -- Update user_ai_usage.current_tier (also tier_name_aligned enum)
    UPDATE public.user_ai_usage
    SET current_tier = NEW.tier::public.tier_name_aligned, updated_at = NOW()
    WHERE user_id = NEW.user_id;

    IF NOT FOUND THEN
      INSERT INTO public.user_ai_usage (
        user_id,
        current_tier,
        exams_generated_this_month,
        explanations_requested_this_month,
        chat_messages_today,
        created_at,
        updated_at
      ) VALUES (
        NEW.user_id,
        NEW.tier::public.tier_name_aligned,
        0,
        0,
        0,
        NOW(),
        NOW()
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.auto_update_user_tier_on_payment() IS
'Automatically updates user_ai_tiers and user_ai_usage when a payment is marked completed. Also runs when user_id/tier are backfilled after completion.';

-- 3) Backfill existing user-scoped completed tx rows (safe, metadata-based).
--    IMPORTANT: Only apply to scope=user to avoid incorrectly upgrading principals for school-wide payments.
UPDATE public.payment_transactions
SET
  user_id = COALESCE(
    user_id,
    CASE
      WHEN (metadata->>'actor_user_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      THEN (metadata->>'actor_user_id')::uuid
      ELSE NULL
    END
  ),
  tier = COALESCE(NULLIF(tier, ''), NULLIF(metadata->>'plan_tier', '')),
  updated_at = NOW()
WHERE status = 'completed'
  AND COALESCE(metadata->>'scope', '') = 'user'
  AND (
    user_id IS NULL
    OR tier IS NULL
    OR tier = ''
  )
  AND (metadata ? 'actor_user_id')
  AND (metadata ? 'plan_tier');



