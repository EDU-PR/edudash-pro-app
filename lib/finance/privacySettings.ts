export interface FinancePrivacySettings {
  hideFeesOnDashboards: boolean;
  requireAppPasswordForFees: boolean;
}

const DEFAULT_PRIVACY_SETTINGS: FinancePrivacySettings = {
  hideFeesOnDashboards: false,
  requireAppPasswordForFees: false,
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
  };
}

