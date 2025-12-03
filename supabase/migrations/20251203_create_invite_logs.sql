-- Create invite_logs table for tracking invitation attempts
BEGIN;

CREATE TABLE IF NOT EXISTS public.invite_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient_phone TEXT NOT NULL,
  recipient_email TEXT,
  invitation_type TEXT NOT NULL CHECK (invitation_type IN ('sms', 'email', 'whatsapp')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'failed', 'clicked')),
  error_message TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  preschool_id UUID REFERENCES public.preschools(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add index for common queries
CREATE INDEX IF NOT EXISTS idx_invite_logs_sender_id ON public.invite_logs(sender_id);
CREATE INDEX IF NOT EXISTS idx_invite_logs_preschool_id ON public.invite_logs(preschool_id);
CREATE INDEX IF NOT EXISTS idx_invite_logs_recipient_phone ON public.invite_logs(recipient_phone);
CREATE INDEX IF NOT EXISTS idx_invite_logs_created_at ON public.invite_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_invite_logs_status ON public.invite_logs(status);

-- Enable RLS
ALTER TABLE public.invite_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own sent invites
CREATE POLICY invite_logs_select_own ON public.invite_logs
  FOR SELECT
  USING (
    sender_id = auth.uid()
  );

-- Policy: Users can insert their own invite logs
CREATE POLICY invite_logs_insert_own ON public.invite_logs
  FOR INSERT
  WITH CHECK (
    sender_id = auth.uid()
  );

-- Policy: Principals/teachers can view invites for their preschool
CREATE POLICY invite_logs_select_preschool ON public.invite_logs
  FOR SELECT
  USING (
    preschool_id IN (
      SELECT preschool_id 
      FROM public.profiles 
      WHERE id = auth.uid() 
      AND role IN ('principal', 'teacher')
    )
  );

-- Policy: Service role full access
CREATE POLICY invite_logs_service_role ON public.invite_logs
  FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_invite_logs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_invite_logs_updated_at
  BEFORE UPDATE ON public.invite_logs
  FOR EACH ROW
  EXECUTE FUNCTION update_invite_logs_updated_at();

COMMIT;
