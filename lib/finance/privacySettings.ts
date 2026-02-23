export interface FinancePrivacySettings {
  hideFeesOnDashboards: boolean;
  requireAppPasswordForFees: boolean;
  adminCanManageFees: boolean;
  adminCanManageStudentProfile: boolean;
  adminCanDeleteFees: boolean;
}

const DEFAULT_PRIVACY_SETTINGS: FinancePrivacySettings = {
  hideFeesOnDashboards: false,
  requireAppPasswordForFees: false,
  adminCanManageFees: true,
  adminCanManageStudentProfile: true,
  adminCanDeleteFees: true,
};

export function resolveFinancePrivacySettings(
  settings: Record<string, unknown> | null | undefined
): FinancePrivacySettings {
  if (!settings || typeof settings !== 'object') {
    return DEFAULT_PRIVACY_SETTINGS;
  }

  const features = (settings.features || {}) as Record<string, any>;
  const financialReports = (features.financialReports || {}) as Record<string, any>;
  const financePrivacy = (settings.finance_privacy || {}) as Record<string, any>;
  const permissions = (settings.permissions || {}) as Record<string, any>;
  const financeAdminControls = (permissions.financeAdminControls || {}) as Record<string, any>;
  const financePermissions = (settings.finance_permissions || {}) as Record<string, any>;

  const privateModeEnabled =
    financialReports.privateModeEnabled === true ||
    financePrivacy.private_mode_enabled === true;
  const hideOnDashboards =
    privateModeEnabled ||
    financialReports.hideOnDashboards === true ||
    financePrivacy.hide_fees_on_dashboards === true;
  const requirePasswordForAccess =
    privateModeEnabled ||
    financialReports.requirePasswordForAccess === true ||
    financePrivacy.require_password_for_fees === true;

  return {
    hideFeesOnDashboards: hideOnDashboards,
    requireAppPasswordForFees: requirePasswordForAccess,
    adminCanManageFees:
      financeAdminControls.canManageFees !== undefined
        ? financeAdminControls.canManageFees === true
        : financePermissions.admin_can_manage_fees !== undefined
          ? financePermissions.admin_can_manage_fees === true
          : true,
    adminCanManageStudentProfile:
      financeAdminControls.canManageStudentProfile !== undefined
        ? financeAdminControls.canManageStudentProfile === true
        : financePermissions.admin_can_manage_student_profile !== undefined
          ? financePermissions.admin_can_manage_student_profile === true
          : true,
    adminCanDeleteFees:
      financeAdminControls.canDeleteFees !== undefined
        ? financeAdminControls.canDeleteFees === true
        : financePermissions.admin_can_delete_fees !== undefined
          ? financePermissions.admin_can_delete_fees === true
          : true,
  };
}
