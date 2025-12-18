-- ============================================
-- CV Uploads Table (Org Admin CV Processing)
-- Date: 2025-12-18
-- Purpose: Separate org-admin CV uploads/processing from learner-authored CV builder data
-- ============================================

-- Ensure updated_at trigger function exists (safe if already present)
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Store org-admin CV uploads + extracted data
CREATE TABLE IF NOT EXISTS public.cv_uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  uploaded_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  file_type TEXT NOT NULL,
  extracted_data JSONB,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processed', 'failed')),
  error TEXT,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_cv_uploads_org_id ON public.cv_uploads(organization_id);
CREATE INDEX IF NOT EXISTS idx_cv_uploads_uploaded_by ON public.cv_uploads(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_cv_uploads_status ON public.cv_uploads(status);
CREATE INDEX IF NOT EXISTS idx_cv_uploads_processed_at ON public.cv_uploads(processed_at);

-- Trigger
DROP TRIGGER IF EXISTS update_cv_uploads_updated_at ON public.cv_uploads;
CREATE TRIGGER update_cv_uploads_updated_at
  BEFORE UPDATE ON public.cv_uploads
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.cv_uploads ENABLE ROW LEVEL SECURITY;

-- Policies
DROP POLICY IF EXISTS "cv_uploads_select_org_members" ON public.cv_uploads;
DROP POLICY IF EXISTS "cv_uploads_insert_org_admins" ON public.cv_uploads;
DROP POLICY IF EXISTS "cv_uploads_update_org_admins" ON public.cv_uploads;

CREATE POLICY "cv_uploads_select_org_members"
  ON public.cv_uploads FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.organization_id = cv_uploads.organization_id
    )
  );

CREATE POLICY "cv_uploads_insert_org_admins"
  ON public.cv_uploads FOR INSERT
  TO authenticated
  WITH CHECK (
    uploaded_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.organization_id = cv_uploads.organization_id
        AND p.role IN ('admin', 'super_admin', 'principal', 'principal_admin')
    )
  );

CREATE POLICY "cv_uploads_update_org_admins"
  ON public.cv_uploads FOR UPDATE
  TO authenticated
  USING (
    uploaded_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.organization_id = cv_uploads.organization_id
        AND p.role IN ('admin', 'super_admin', 'principal', 'principal_admin')
    )
  )
  WITH CHECK (
    uploaded_by = auth.uid()
  );

COMMENT ON TABLE public.cv_uploads IS 'Org-admin uploaded CVs and extracted structured data (separate from learner-authored CV builder CVs).';



