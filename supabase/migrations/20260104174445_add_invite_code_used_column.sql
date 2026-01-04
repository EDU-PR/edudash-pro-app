-- Add invite_code_used column to organization_members
-- This tracks which invite code was used when a member joined

ALTER TABLE organization_members ADD COLUMN IF NOT EXISTS invite_code_used VARCHAR(20);

COMMENT ON COLUMN organization_members.invite_code_used IS 'Invite code used when joining the organization';

-- Create index for looking up members by invite code
CREATE INDEX IF NOT EXISTS idx_org_members_invite_code ON organization_members(invite_code_used) WHERE invite_code_used IS NOT NULL;
