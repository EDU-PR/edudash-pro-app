// School Settings Service
// Centralized service for reading/writing school-level settings

import { assertSupabase } from '@/lib/supabase';

export type DashboardLayout = 'grid' | 'list';
export type BackupFrequency = 'daily' | 'weekly' | 'monthly';
export type DateFormat = 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'YYYY-MM-DD';
export type TimeFormat = '12h' | '24h';
export type AttendanceLifecycleBillingBehavior = 'stop_new_fees_keep_debt' | string;

export interface AttendanceLifecyclePolicy {
  enabled: boolean;
  trigger_absent_days: number;
  grace_days: number;
  require_principal_approval: boolean;
  billing_behavior: AttendanceLifecycleBillingBehavior;
  auto_unassign_class_on_inactive: boolean;
  notify_channels: {
    push: boolean;
    email: boolean;
    sms: boolean;
    whatsapp: boolean;
  };
}

export interface SchoolSettings {
  // Basic School Info
  schoolName: string;
  schoolLogo?: string;
  primaryColor: string;
  secondaryColor: string;
  timezone: string;
  currency: string;

  // Feature Toggles
  features: {
    activityFeed: {
      enabled: boolean;
      allowTeacherDelete: boolean;
      allowParentComment: boolean;
      showPriorityBadges: boolean;
    };
    studentsDirectory: {
      enabled: boolean;
      showPhotos: boolean;
      showMedicalInfo: boolean;
      allowTeacherEdit: boolean;
      showPaymentStatus: boolean;
    };
    teachersDirectory: {
      enabled: boolean;
      showSalaries: boolean;
      showPerformanceRatings: boolean;
      allowParentContact: boolean;
      showQualifications: boolean;
    };
    financialReports: {
      enabled: boolean;
      showTeacherView: boolean;
      allowExport: boolean;
      showDetailedBreakdown: boolean;
      requireApprovalLimit: number;
      hideOnDashboards: boolean;
      requirePasswordForAccess: boolean;
      privateModeEnabled: boolean;
    };
    uniforms: {
      enabled: boolean;
    };
    stationery: {
      enabled: boolean;
    };
    pettyCash: {
      enabled: boolean;
      dailyLimit: number;
      requireApprovalAbove: number;
      allowedCategories: string[];
      requireReceipts: boolean;
    };
  };

  // Display Options
  display: {
    dashboardLayout: DashboardLayout;
    showWeatherWidget: boolean;
    showCalendarWidget: boolean;
    defaultLanguage: string;
    dateFormat: DateFormat;
    timeFormat: TimeFormat;
  };

  // Permissions & Roles
  permissions: {
    allowTeacherReports: boolean;
    allowParentMessaging: boolean;
    requireTwoFactorAuth: boolean;
    sessionTimeout: number;
    financeAdminControls: {
      canManageFees: boolean;
      canManageStudentProfile: boolean;
      canDeleteFees: boolean;
    };
  };

  // Notifications
  notifications: {
    emailEnabled: boolean;
    smsEnabled: boolean;
    pushEnabled: boolean;
    dailyReports: boolean;
    urgentAlertsOnly: boolean;
  };

  // Backup & Data
  backup: {
    autoBackupEnabled: boolean;
    backupFrequency: BackupFrequency;
    dataRetentionMonths: number;
  };

  // Learner lifecycle automation policy
  attendanceLifecycle: AttendanceLifecyclePolicy;

  // Integrations
  whatsapp_number?: string; // Stored in preschools.settings for WA integration
}

export const DEFAULT_SCHOOL_SETTINGS: SchoolSettings = {
  schoolName: 'My School',
  primaryColor: '#4F46E5',
  secondaryColor: '#6B7280',
  timezone: 'Africa/Johannesburg',
  currency: 'ZAR',
  features: {
    activityFeed: {
      enabled: true,
      allowTeacherDelete: false,
      allowParentComment: true,
      showPriorityBadges: true,
    },
    studentsDirectory: {
      enabled: true,
      showPhotos: true,
      showMedicalInfo: true,
      allowTeacherEdit: true,
      showPaymentStatus: true,
    },
    teachersDirectory: {
      enabled: true,
      showSalaries: false,
      showPerformanceRatings: true,
      allowParentContact: true,
      showQualifications: true,
    },
    financialReports: {
      enabled: true,
      showTeacherView: false,
      allowExport: true,
      showDetailedBreakdown: true,
      requireApprovalLimit: 1000,
      hideOnDashboards: false,
      requirePasswordForAccess: false,
      privateModeEnabled: false,
    },
    uniforms: {
      enabled: false,
    },
    stationery: {
      enabled: false,
    },
    pettyCash: {
      enabled: true,
      dailyLimit: 500,
      requireApprovalAbove: 200,
      allowedCategories: [
        'Teaching Materials',
        'Classroom Supplies',
        'Printing & Stationery',
        'Cleaning Supplies',
        'Maintenance & Repairs',
        'Utilities',
        'Transport',
        'Fuel',
        'Snacks & Refreshments',
        'First Aid',
        'Events',
        'Security',
        'Emergency',
        'Other',
      ],
      requireReceipts: true,
    },
  },
  display: {
    dashboardLayout: 'grid',
    showWeatherWidget: true,
    showCalendarWidget: true,
    defaultLanguage: 'en',
    dateFormat: 'DD/MM/YYYY',
    timeFormat: '24h',
  },
  permissions: {
    allowTeacherReports: true,
    allowParentMessaging: true,
    requireTwoFactorAuth: false,
    sessionTimeout: 30,
    financeAdminControls: {
      canManageFees: true,
      canManageStudentProfile: true,
      canDeleteFees: true,
    },
  },
  notifications: {
    emailEnabled: true,
    smsEnabled: false,
    pushEnabled: true,
    dailyReports: true,
    urgentAlertsOnly: false,
  },
  backup: {
    autoBackupEnabled: true,
    backupFrequency: 'daily',
    dataRetentionMonths: 12,
  },
  attendanceLifecycle: {
    enabled: true,
    trigger_absent_days: 5,
    grace_days: 7,
    require_principal_approval: false,
    billing_behavior: 'stop_new_fees_keep_debt',
    auto_unassign_class_on_inactive: true,
    notify_channels: {
      push: true,
      email: false,
      sms: false,
      whatsapp: false,
    },
  },
};

function deepMerge<T>(base: T, overrides: Partial<T>): T {
  if (!overrides) return base;
  const result: any = Array.isArray(base) ? [...(base as any)] : { ...(base as any) };
  for (const key of Object.keys(overrides)) {
    const v: any = (overrides as any)[key];
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      (result as any)[key] = deepMerge((base as any)[key] ?? {}, v);
    } else {
      (result as any)[key] = v;
    }
  }
  return result as T;
}

export class SchoolSettingsService {
  static async get(schoolId: string): Promise<SchoolSettings> {
    const supabase = assertSupabase();
    
    // Try preschools table first
    let data = null;
    let error = null;
    
    ({ data, error } = await supabase
      .from('preschools')
      .select('settings, name')
      .eq('id', schoolId)
      .maybeSingle());

    // If no preschool found, try organizations table (for membership orgs like SOA)
    if (!data && !error) {
      ({ data, error } = await supabase
        .from('organizations')
        .select('settings, name')
        .eq('id', schoolId)
        .maybeSingle());
    }

    if (error) throw error;
    
    const merged = deepMerge(DEFAULT_SCHOOL_SETTINGS, (data?.settings || {}) as Partial<SchoolSettings>);
    // If the merged name is the default sentinel or missing, prefer the DB school name
    if ((merged.schoolName === DEFAULT_SCHOOL_SETTINGS.schoolName || !merged.schoolName) && data?.name) {
      merged.schoolName = data.name;
    }
    return merged;
  }

  static async update(
    schoolId: string,
    updates: Partial<SchoolSettings>
  ): Promise<SchoolSettings> {
    const supabase = assertSupabase();

    // Build a fully merged payload first, because update_school_settings does top-level JSON merge.
    const [{ data: preschoolRow }, { data: organizationRow }] = await Promise.all([
      supabase.from('preschools').select('settings').eq('id', schoolId).maybeSingle(),
      supabase.from('organizations').select('settings').eq('id', schoolId).maybeSingle(),
    ]);
    const currentSettings = (preschoolRow?.settings || organizationRow?.settings || {}) as Partial<SchoolSettings>;
    const nextSettings = deepMerge(currentSettings as SchoolSettings, updates as Partial<SchoolSettings>);

    const { data, error } = await supabase.rpc('update_school_settings', {
      p_preschool_id: schoolId,
      p_patch: nextSettings as any,
    });

    if (error) {
      // Fallback for org-only deployments where the RPC cannot find a preschool row.
      if (!preschoolRow && organizationRow) {
        const { error: orgUpdateError } = await supabase
          .from('organizations')
          .update({ settings: nextSettings as any })
          .eq('id', schoolId);
        if (orgUpdateError) throw orgUpdateError;
        return deepMerge(DEFAULT_SCHOOL_SETTINGS, nextSettings as Partial<SchoolSettings>);
      }
      throw error;
    }

    // Keep organizations.settings aligned when both entities share the same id.
    if (organizationRow) {
      try {
        await supabase
          .from('organizations')
          .update({ settings: (data || nextSettings) as any })
          .eq('id', schoolId);
      } catch {
        // Best-effort sync only; preschools.settings remains source of truth.
      }
    }

    return deepMerge(DEFAULT_SCHOOL_SETTINGS, ((data || nextSettings) || {}) as Partial<SchoolSettings>);
  }

  static async updateWhatsAppNumber(schoolId: string, whatsappE164: string): Promise<void> {
    const { error } = await assertSupabase().rpc('update_school_settings', {
      p_preschool_id: schoolId,
      p_patch: { whatsapp_number: whatsappE164 } as any,
    });
    if (error) throw error;
  }
}

export default SchoolSettingsService;
