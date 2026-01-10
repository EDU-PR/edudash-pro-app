-- Fix document RLS so national executive can see youth/women/veterans documents
-- Date: 2026-01-10
-- Issue: National President (and other top executives) cannot see documents uploaded by youth wing
-- The current RLS policy for admin_only documents is too restrictive

-- Drop the policy first, then recreate the function, then recreate the policy
DROP POLICY IF EXISTS "members_view_documents" ON public.organization_documents;

-- Update the user_can_view_org_document function to properly handle access levels
-- and allow national executives to view documents from sub-structures (youth, women, veterans)
CREATE OR REPLACE FUNCTION public.user_can_view_org_document(doc_id UUID, doc_access_level TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, auth
AS $$
DECLARE
  doc_org_id UUID;
  user_member_type TEXT;
  doc_uploader_member_type TEXT;
BEGIN
  -- Get the document's organization_id and uploader's member_type
  SELECT 
    od.organization_id,
    om.member_type
  INTO doc_org_id, doc_uploader_member_type
  FROM public.organization_documents od
  LEFT JOIN public.organization_members om ON od.uploaded_by = om.user_id AND om.organization_id = od.organization_id
  WHERE od.id = doc_id;

  IF doc_org_id IS NULL THEN
    RETURN FALSE; -- Document not found
  END IF;

  -- Get the current user's member_type in the same organization
  SELECT om.member_type
  INTO user_member_type
  FROM public.organization_members om
  WHERE om.user_id = auth.uid() 
    AND om.organization_id = doc_org_id 
    AND om.seat_status = 'active';

  IF user_member_type IS NULL THEN
    RETURN FALSE; -- User is not an active member of the organization
  END IF;

  -- Check if the user is the uploader
  IF EXISTS (SELECT 1 FROM public.organization_documents WHERE id = doc_id AND uploaded_by = auth.uid()) THEN
    RETURN TRUE;
  END IF;

  -- Handle access levels
  CASE doc_access_level
    WHEN 'public' THEN
      RETURN TRUE;
      
    WHEN 'members' THEN
      RETURN TRUE; -- Any active member can view
      
    WHEN 'managers' THEN
      RETURN user_member_type IN (
        'regional_manager', 'provincial_manager', 'branch_manager', 
        'executive', 'national_coordinator', 'national_admin', 
        'ceo', 'president', 'deputy_president', 'secretary_general', 'treasurer',
        'youth_president', 'youth_deputy', 'youth_secretary', 'youth_treasurer',
        'women_president', 'women_deputy', 'women_secretary', 'women_treasurer',
        'veterans_president'
      );
      
    WHEN 'executives' THEN
      RETURN user_member_type IN (
        'executive', 'national_coordinator', 'national_admin', 
        'ceo', 'president', 'deputy_president', 'secretary_general', 'treasurer',
        'youth_president', 'youth_deputy', 'youth_secretary', 'youth_treasurer',
        'women_president', 'women_deputy', 'women_secretary', 'women_treasurer',
        'veterans_president'
      );
      
    WHEN 'admin_only' THEN
      -- National executives (president, deputy, secretary, treasurer, CEO) can see ALL admin_only documents
      -- This includes documents uploaded by youth, women, and veterans wings
      IF user_member_type IN ('ceo', 'president', 'deputy_president', 'secretary_general', 'treasurer', 'national_admin') THEN
        RETURN TRUE;
      END IF;
      
      -- Youth wing executives can see youth wing documents
      IF user_member_type IN ('youth_president', 'youth_deputy', 'youth_secretary', 'youth_treasurer') 
         AND doc_uploader_member_type IN ('youth_president', 'youth_deputy', 'youth_secretary', 'youth_treasurer') THEN
        RETURN TRUE;
      END IF;
      
      -- Women wing executives can see women wing documents
      IF user_member_type IN ('women_president', 'women_deputy', 'women_secretary', 'women_treasurer') 
         AND doc_uploader_member_type IN ('women_president', 'women_deputy', 'women_secretary', 'women_treasurer') THEN
        RETURN TRUE;
      END IF;
      
      -- Veterans league executives can see veterans documents
      IF user_member_type = 'veterans_president' 
         AND doc_uploader_member_type = 'veterans_president' THEN
        RETURN TRUE;
      END IF;
      
      RETURN FALSE;
      
    WHEN 'custom' THEN
      -- Check custom grants (e.g., specific user or role grants)
      RETURN EXISTS (
        SELECT 1
        FROM public.document_access_grants dag
        WHERE dag.document_id = doc_id
          AND (dag.grantee_user_id = auth.uid() OR dag.grantee_role = user_member_type)
          AND dag.revoked_at IS NULL
          AND (dag.valid_until IS NULL OR dag.valid_until > now())
      );
      
    ELSE
      RETURN FALSE;
  END CASE;
END;
$$;

-- Recreate the policy using the updated function
CREATE POLICY "members_view_documents"
ON public.organization_documents
FOR SELECT
USING (public.user_can_view_org_document(id, access_level));

COMMENT ON FUNCTION public.user_can_view_org_document IS 
'Checks if a user can view a document based on access level. National executives can see ALL admin_only documents including those from youth, women, and veterans wings.';

