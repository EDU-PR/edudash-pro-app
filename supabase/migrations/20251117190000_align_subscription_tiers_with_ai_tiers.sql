-- Align subscription_tier enum with tier_name_aligned enum
-- All tier names should use underscores (parent_starter, parent_plus, etc)
-- This ensures consistency across subscription_plans, user_ai_tiers, and user_ai_usage tables

-- Add underscored tier values to subscription_tier enum
ALTER TYPE subscription_tier ADD VALUE IF NOT EXISTS 'parent_starter';
ALTER TYPE subscription_tier ADD VALUE IF NOT EXISTS 'parent_plus';
ALTER TYPE subscription_tier ADD VALUE IF NOT EXISTS 'teacher_starter';
ALTER TYPE subscription_tier ADD VALUE IF NOT EXISTS 'teacher_pro';
ALTER TYPE subscription_tier ADD VALUE IF NOT EXISTS 'school_starter';
ALTER TYPE subscription_tier ADD VALUE IF NOT EXISTS 'school_premium';
ALTER TYPE subscription_tier ADD VALUE IF NOT EXISTS 'school_pro';
ALTER TYPE subscription_tier ADD VALUE IF NOT EXISTS 'school_enterprise';

-- Update existing subscription_plans to use underscored format
UPDATE subscription_plans SET tier = 'parent_starter' WHERE tier = 'parent-starter';
UPDATE subscription_plans SET tier = 'parent_plus' WHERE tier = 'parent-plus';
UPDATE subscription_plans SET tier = 'teacher_starter' WHERE tier = 'teacher-starter';
UPDATE subscription_plans SET tier = 'teacher_pro' WHERE tier = 'teacher-pro';
UPDATE subscription_plans SET tier = 'school_starter' WHERE tier = 'school-starter';
UPDATE subscription_plans SET tier = 'school_premium' WHERE tier = 'school-premium';
UPDATE subscription_plans SET tier = 'school_pro' WHERE tier = 'school-pro';
UPDATE subscription_plans SET tier = 'school_enterprise' WHERE tier = 'school-enterprise';

-- Add comment explaining the standardization
COMMENT ON TYPE subscription_tier IS 'Subscription tier enum - uses underscores to match tier_name_aligned enum (parent_starter, parent_plus, etc). Updated 2025-11-17 for consistency across all tier-related tables.';
