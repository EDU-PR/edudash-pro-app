-- Add service role key to vault so the trigger can use it
-- Run this in Supabase SQL Editor

-- First, make sure vault extension is enabled
CREATE EXTENSION IF NOT EXISTS vault;

-- Store the service role key (replace with your actual service role key from Supabase dashboard)
-- Get it from: Project Settings → API → service_role key (secret)
INSERT INTO vault.secrets (secret, name, description)
VALUES (
  'your-service-role-key-here', -- Replace with actual key
  'service_role_key',
  'Service role key for calling Edge Functions from triggers'
)
ON CONFLICT (name) 
DO UPDATE SET 
  secret = EXCLUDED.secret,
  updated_at = NOW();

-- Verify it was stored
SELECT name, description, created_at, updated_at 
FROM vault.secrets 
WHERE name = 'service_role_key';
