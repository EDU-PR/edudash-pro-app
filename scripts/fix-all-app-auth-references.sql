-- Comprehensive fix for all app_auth references in RLS policies
-- This replaces all policies that reference the non-existent app_auth schema

-- Helper function to check if user is super_admin
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND role = 'super_admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Helper function to get user's organization_id
CREATE OR REPLACE FUNCTION public.get_user_org_id()
RETURNS UUID AS $$
BEGIN
  RETURN (
    SELECT organization_id FROM profiles 
    WHERE id = auth.uid()
    LIMIT 1
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- =====================================================
-- FIX: school_ai_subscriptions
-- =====================================================
DROP POLICY IF EXISTS school_ai_subscriptions_rls_read ON school_ai_subscriptions;
DROP POLICY IF EXISTS school_ai_subscriptions_rls_write ON school_ai_subscriptions;

CREATE POLICY school_ai_subscriptions_rls_read ON school_ai_subscriptions
FOR SELECT USING (
  school_id = public.get_user_org_id() OR public.is_super_admin()
);

CREATE POLICY school_ai_subscriptions_rls_write ON school_ai_subscriptions
FOR ALL USING (
  school_id = public.get_user_org_id() OR public.is_super_admin()
);

-- =====================================================
-- FIX: petty_cash_receipts
-- =====================================================
DROP POLICY IF EXISTS petty_cash_receipts_rls_read ON petty_cash_receipts;
DROP POLICY IF EXISTS petty_cash_receipts_rls_write ON petty_cash_receipts;

CREATE POLICY petty_cash_receipts_rls_read ON petty_cash_receipts
FOR SELECT USING (
  preschool_id = public.get_user_org_id() OR public.is_super_admin()
);

CREATE POLICY petty_cash_receipts_rls_write ON petty_cash_receipts
FOR ALL USING (
  preschool_id = public.get_user_org_id() OR public.is_super_admin()
);

-- =====================================================
-- FIX: petty_cash_reconciliations
-- =====================================================
DROP POLICY IF EXISTS petty_cash_reconciliations_rls_read ON petty_cash_reconciliations;
DROP POLICY IF EXISTS petty_cash_reconciliations_rls_write ON petty_cash_reconciliations;

CREATE POLICY petty_cash_reconciliations_rls_read ON petty_cash_reconciliations
FOR SELECT USING (
  preschool_id = public.get_user_org_id() OR public.is_super_admin()
);

CREATE POLICY petty_cash_reconciliations_rls_write ON petty_cash_reconciliations
FOR ALL USING (
  preschool_id = public.get_user_org_id() OR public.is_super_admin()
);

-- =====================================================
-- FIX: ai_generations
-- =====================================================
DROP POLICY IF EXISTS ai_generations_tenant_isolation ON ai_generations;
DROP POLICY IF EXISTS ai_generations_rls_read ON ai_generations;
DROP POLICY IF EXISTS ai_generations_rls_write ON ai_generations;

CREATE POLICY ai_generations_tenant_isolation ON ai_generations
FOR ALL USING (
  user_id = auth.uid() OR public.is_super_admin()
);

-- =====================================================
-- FIX: organizations
-- =====================================================
DROP POLICY IF EXISTS superadmin_service_role_access ON organizations;
DROP POLICY IF EXISTS organizations_update_admins ON organizations;
DROP POLICY IF EXISTS organizations_select_self_or_superadmin ON organizations;
DROP POLICY IF EXISTS organizations_delete_superadmin ON organizations;

CREATE POLICY organizations_select ON organizations
FOR SELECT USING (
  id = public.get_user_org_id() OR public.is_super_admin()
);

CREATE POLICY organizations_update ON organizations
FOR UPDATE USING (
  id = public.get_user_org_id() AND EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('principal', 'admin')
  )
) OR public.is_super_admin();

CREATE POLICY organizations_delete ON organizations
FOR DELETE USING (public.is_super_admin());

-- =====================================================
-- FIX: homework_assignments
-- =====================================================
DROP POLICY IF EXISTS superadmin_service_role_access ON homework_assignments;

CREATE POLICY homework_assignments_access ON homework_assignments
FOR ALL USING (
  preschool_id = public.get_user_org_id() OR public.is_super_admin()
);

-- =====================================================
-- FIX: financial_transactions
-- =====================================================
DROP POLICY IF EXISTS superadmin_service_role_access ON financial_transactions;

CREATE POLICY financial_transactions_access ON financial_transactions
FOR ALL USING (
  preschool_id = public.get_user_org_id() OR public.is_super_admin()
);

-- =====================================================
-- FIX: petty_cash_transactions
-- =====================================================
DROP POLICY IF EXISTS superadmin_service_role_access ON petty_cash_transactions;

CREATE POLICY petty_cash_transactions_access ON petty_cash_transactions
FOR ALL USING (
  preschool_id = public.get_user_org_id() OR public.is_super_admin()
);

-- =====================================================
-- FIX: invoices
-- =====================================================
DROP POLICY IF EXISTS superadmin_service_role_access ON invoices;

CREATE POLICY invoices_access ON invoices
FOR ALL USING (
  preschool_id = public.get_user_org_id() OR public.is_super_admin()
);

-- =====================================================
-- FIX: attendance_records
-- =====================================================
DROP POLICY IF EXISTS superadmin_service_role_access ON attendance_records;

CREATE POLICY attendance_records_access ON attendance_records
FOR ALL USING (
  preschool_id = public.get_user_org_id() OR public.is_super_admin()
);

-- =====================================================
-- FIX: push_notifications
-- =====================================================
DROP POLICY IF EXISTS superadmin_service_role_access ON push_notifications;
DROP POLICY IF EXISTS push_notifications_rls_read ON push_notifications;
DROP POLICY IF EXISTS push_notifications_rls_write ON push_notifications;

CREATE POLICY push_notifications_access ON push_notifications
FOR ALL USING (
  user_id = auth.uid() OR public.is_super_admin()
);

-- =====================================================
-- FIX: superadmin_audit_log
-- =====================================================
DROP POLICY IF EXISTS superadmin_audit_own_logs ON superadmin_audit_log;

CREATE POLICY superadmin_audit_access ON superadmin_audit_log
FOR ALL USING (public.is_super_admin());

-- =====================================================
-- FIX: parent_child_links
-- =====================================================
DROP POLICY IF EXISTS parent_child_links_rls_read ON parent_child_links;
DROP POLICY IF EXISTS parent_child_links_rls_write ON parent_child_links;

CREATE POLICY parent_child_links_access ON parent_child_links
FOR ALL USING (
  parent_id = auth.uid() OR public.is_super_admin()
);

-- =====================================================
-- FIX: service monitoring tables (super_admin only)
-- =====================================================
DROP POLICY IF EXISTS superadmin_service_role_access ON service_health_status;
DROP POLICY IF EXISTS superadmin_service_role_access ON service_cost_tracking;
DROP POLICY IF EXISTS superadmin_service_role_access ON service_api_keys;
DROP POLICY IF EXISTS superadmin_service_role_access ON service_usage_limits;
DROP POLICY IF EXISTS superadmin_service_role_access ON service_incidents;
DROP POLICY IF EXISTS superadmin_service_role_access ON service_alerts;
DROP POLICY IF EXISTS superadmin_service_role_access ON service_alert_config;

CREATE POLICY service_health_status_access ON service_health_status FOR ALL USING (public.is_super_admin());
CREATE POLICY service_cost_tracking_access ON service_cost_tracking FOR ALL USING (public.is_super_admin());
CREATE POLICY service_api_keys_access ON service_api_keys FOR ALL USING (public.is_super_admin());
CREATE POLICY service_usage_limits_access ON service_usage_limits FOR ALL USING (public.is_super_admin());
CREATE POLICY service_incidents_access ON service_incidents FOR ALL USING (public.is_super_admin());
CREATE POLICY service_alerts_access ON service_alerts FOR ALL USING (public.is_super_admin());
CREATE POLICY service_alert_config_access ON service_alert_config FOR ALL USING (public.is_super_admin());

-- =====================================================
-- FIX: school_invitation_codes
-- =====================================================
DROP POLICY IF EXISTS school_invite_codes_select_same_school ON school_invitation_codes;
DROP POLICY IF EXISTS school_invite_codes_update_by_principal ON school_invitation_codes;

CREATE POLICY school_invitation_codes_select ON school_invitation_codes
FOR SELECT USING (
  school_id = public.get_user_org_id() OR public.is_super_admin()
);

CREATE POLICY school_invitation_codes_update ON school_invitation_codes
FOR UPDATE USING (
  school_id = public.get_user_org_id() AND EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('principal', 'admin')
  )
);

SELECT 'All app_auth references have been replaced!' as status;
