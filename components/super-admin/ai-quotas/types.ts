/**
 * Type definitions for AI Quota Management
 * @module components/super-admin/ai-quotas/types
 */

/**
 * AI Quota settings for a school
 */
export interface AIQuotaSettings {
  id: string;
  school_id: string;
  school_name: string;
  plan_type: 'free' | 'basic' | 'pro' | 'enterprise';
  monthly_limit: number;
  current_usage: number;
  reset_date: string;
  overage_allowed: boolean;
  overage_limit?: number;
  cost_per_overage: number;
  warnings_enabled: boolean;
  warning_thresholds: number[];
  is_suspended: boolean;
  last_updated: string;
}

/**
 * Global AI quota configuration
 */
export interface GlobalQuotaConfig {
  free_tier_limit: number;
  basic_tier_limit: number;
  pro_tier_limit: number;
  enterprise_tier_limit: number;
  overage_rate: number;
  warning_thresholds: number[];
  suspension_threshold: number;
  auto_reset_enabled: boolean;
  cost_alerts_enabled: boolean;
}

/**
 * Usage statistics across all schools
 */
export interface UsageStatistics {
  total_tokens_used: number;
  total_cost: number;
  average_cost_per_school: number;
  schools_over_limit: number;
  schools_suspended: number;
  projected_monthly_cost: number;
  top_consuming_schools: TopConsumingSchool[];
}

/**
 * Top consuming school info
 */
export interface TopConsumingSchool {
  school_name: string;
  usage: number;
  cost: number;
  percentage: number;
}

/**
 * Filter state for school list
 */
export interface QuotaFilters {
  plan: 'all' | 'free' | 'basic' | 'pro' | 'enterprise';
  status: 'all' | 'normal' | 'over_limit' | 'suspended';
  search: string;
}

/**
 * Default global config values
 */
export const DEFAULT_GLOBAL_CONFIG: GlobalQuotaConfig = {
  free_tier_limit: 1000,
  basic_tier_limit: 5000,
  pro_tier_limit: 25000,
  enterprise_tier_limit: 100000,
  overage_rate: 0.002,
  warning_thresholds: [75, 90, 95],
  suspension_threshold: 120,
  auto_reset_enabled: true,
  cost_alerts_enabled: true,
};

/**
 * Default usage statistics
 */
export const DEFAULT_USAGE_STATS: UsageStatistics = {
  total_tokens_used: 0,
  total_cost: 0,
  average_cost_per_school: 0,
  schools_over_limit: 0,
  schools_suspended: 0,
  projected_monthly_cost: 0,
  top_consuming_schools: [],
};

/**
 * Default filter state
 */
export const DEFAULT_FILTERS: QuotaFilters = {
  plan: 'all',
  status: 'all',
  search: '',
};
