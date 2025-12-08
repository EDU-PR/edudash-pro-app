-- Align subscription_plans.tier enum with tier_name_aligned enum
-- This ensures consistency across payment system and AI tier management

-- Add missing enum values to subscription_tier if they don't exist
DO $$
BEGIN
    -- Add parent_starter if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'parent_starter' 
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'subscription_tier')
    ) THEN
        ALTER TYPE subscription_tier ADD VALUE 'parent_starter';
    END IF;
    
    -- Add parent_plus if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'parent_plus' 
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'subscription_tier')
    ) THEN
        ALTER TYPE subscription_tier ADD VALUE 'parent_plus';
    END IF;
    
    -- Add school_starter if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'school_starter' 
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'subscription_tier')
    ) THEN
        ALTER TYPE subscription_tier ADD VALUE 'school_starter';
    END IF;
    
    -- Add school_premium if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'school_premium' 
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'subscription_tier')
    ) THEN
        ALTER TYPE subscription_tier ADD VALUE 'school_premium';
    END IF;
    
    -- Add school_pro if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'school_pro' 
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'subscription_tier')
    ) THEN
        ALTER TYPE subscription_tier ADD VALUE 'school_pro';
    END IF;
END$$;

-- Update existing subscription_plans to use underscore format
UPDATE subscription_plans SET tier = 'parent_starter' WHERE tier = 'parent-starter';
UPDATE subscription_plans SET tier = 'parent_plus' WHERE tier = 'parent-plus';
UPDATE subscription_plans SET tier = 'school_starter' WHERE tier = 'starter';
UPDATE subscription_plans SET tier = 'school_premium' WHERE tier = 'premium';
UPDATE subscription_plans SET tier = 'school_pro' WHERE tier = 'enterprise';

-- Add comment
COMMENT ON COLUMN subscription_plans.tier IS 'Subscription tier using tier_name_aligned format (underscores): parent_starter, parent_plus, school_starter, school_premium, school_pro';
