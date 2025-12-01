-- Test script to verify push_subscriptions table

-- Check table structure
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'push_subscriptions'
ORDER BY ordinal_position;

-- Check constraints
SELECT 
    constraint_name,
    constraint_type
FROM information_schema.table_constraints
WHERE table_name = 'push_subscriptions';

-- Check existing subscriptions
SELECT 
    id,
    user_id,
    topics,
    is_active,
    created_at
FROM push_subscriptions
ORDER BY created_at DESC
LIMIT 5;
