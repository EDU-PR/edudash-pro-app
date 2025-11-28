-- Migration: Add invite_logs table for tracking invitations
-- Created: 2024-11-28

-- Create invite_logs table
CREATE TABLE IF NOT EXISTS public.invite_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  preschool_id UUID REFERENCES preschools(id) ON DELETE SET NULL,
  invite_type TEXT NOT NULL CHECK (invite_type IN ('email', 'sms', 'whatsapp', 'link')),
  invite_target TEXT NOT NULL, -- email, phone number, or 'clipboard' for copied links
  invite_link TEXT NOT NULL,
  status TEXT DEFAULT 'sent' CHECK (status IN ('sent', 'copied', 'clicked', 'registered', 'failed')),
  inviter_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  clicked_at TIMESTAMPTZ,
  registered_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Create index for analytics
CREATE INDEX IF NOT EXISTS idx_invite_logs_preschool_id ON public.invite_logs(preschool_id);
CREATE INDEX IF NOT EXISTS idx_invite_logs_created_at ON public.invite_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_invite_logs_invite_type ON public.invite_logs(invite_type);

-- Enable RLS
ALTER TABLE public.invite_logs ENABLE ROW LEVEL SECURITY;

-- RLS policies
-- Allow users to insert their own invites
CREATE POLICY "Users can create invites" ON public.invite_logs
  FOR INSERT WITH CHECK (true);

-- Allow users to view invites for their preschool (principals/teachers)
CREATE POLICY "Staff can view preschool invites" ON public.invite_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.preschool_id = invite_logs.preschool_id
      AND profiles.role IN ('principal', 'teacher', 'superadmin')
    )
  );

-- Superadmins can view all
CREATE POLICY "Superadmins can view all invites" ON public.invite_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'superadmin'
    )
  );

COMMENT ON TABLE public.invite_logs IS 'Tracks all invitation attempts for analytics and preventing spam';
