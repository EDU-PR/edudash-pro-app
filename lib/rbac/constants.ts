/**
 * RBAC Constants - Role and Capability Definitions
 * 
 * Core constants for the Role-Based Access Control system including
 * role hierarchy, capability flags, and tier-based permissions.
 */

// Core role definitions with hierarchy (higher number = more permissions)
export const ROLES = {
  student: { level: 0, name: 'student', display: 'Student/Learner' },
  parent: { level: 1, name: 'parent', display: 'Parent' },
  teacher: { level: 2, name: 'teacher', display: 'Teacher' },
  principal: { level: 3, name: 'principal', display: 'Principal' },
  principal_admin: { level: 3, name: 'principal_admin', display: 'Principal/Admin' },
  super_admin: { level: 4, name: 'super_admin', display: 'Super Admin' },
} as const;

export type Role = keyof typeof ROLES;
export type SeatStatus = 'active' | 'inactive' | 'pending' | 'revoked';
export type PlanTier = 'free' | 'starter' | 'premium' | 'enterprise';

// Comprehensive capability flags
export const CAPABILITIES = {
  // Core access capabilities
  view_dashboard: 'view_dashboard',
  access_mobile_app: 'access_mobile_app',
  
  // Organization-level capabilities
  view_organization_settings: 'view_organization_settings',
  manage_organization: 'manage_organization',
  invite_members: 'invite_members',
  manage_seats: 'manage_seats',
  
  // School/educational capabilities
  view_school_metrics: 'view_school_metrics',
  manage_teachers: 'manage_teachers',
  manage_students: 'manage_students',
  manage_classes: 'manage_classes',
  access_principal_hub: 'access_principal_hub',
  generate_school_reports: 'generate_school_reports',
  
  // Teaching capabilities
  create_assignments: 'create_assignments',
  grade_assignments: 'grade_assignments',
  view_class_analytics: 'view_class_analytics',
  communicate_with_parents: 'communicate_with_parents',
  
  // Parent capabilities
  view_child_progress: 'view_child_progress',
  communicate_with_teachers: 'communicate_with_teachers',
  access_homework_help: 'access_homework_help',
  
  // Parent Dashboard Capabilities
  access_parent_dashboard: 'access_parent_dashboard',
  submit_homework: 'submit_homework',
  view_announcements: 'view_announcements',
  use_whatsapp: 'use_whatsapp',
  send_voice_notes: 'send_voice_notes',
  view_progress: 'view_progress',
  in_app_messaging: 'in_app_messaging',
  parent_teacher_chat: 'parent_teacher_chat',
  offline_homework_submission: 'offline_homework_submission',
  receive_push_notifications: 'receive_push_notifications',
  
  // WhatsApp Integration Capabilities
  whatsapp_opt_in: 'whatsapp_opt_in',
  whatsapp_send_messages: 'whatsapp_send_messages',
  whatsapp_receive_messages: 'whatsapp_receive_messages',
  whatsapp_voice_messages: 'whatsapp_voice_messages',
  
  // Communication & Engagement
  read_school_announcements: 'read_school_announcements',
  reply_to_teachers: 'reply_to_teachers',
  send_media_messages: 'send_media_messages',
  record_voice_feedback: 'record_voice_feedback',
  view_engagement_metrics: 'view_engagement_metrics',
  provide_feedback: 'provide_feedback',
  
  // Progress & Analytics
  view_student_progress: 'view_student_progress',
  view_homework_history: 'view_homework_history',
  view_attendance_records: 'view_attendance_records',
  access_ai_insights: 'access_ai_insights',
  view_progress_reports: 'view_progress_reports',
  
  // AI capabilities (tier-dependent)
  ai_lesson_generation: 'ai_lesson_generation',
  ai_grading_assistance: 'ai_grading_assistance',
  ai_homework_helper: 'ai_homework_helper',
  ai_stem_activities: 'ai_stem_activities',
  ai_progress_analysis: 'ai_progress_analysis',
  ai_insights: 'ai_insights',
  ai_quota_management: 'ai_quota_management',
  
  // Premium/Enterprise capabilities
  advanced_analytics: 'advanced_analytics',
  bulk_operations: 'bulk_operations',
  custom_reports: 'custom_reports',
  api_access: 'api_access',
  sso_access: 'sso_access',
  priority_support: 'priority_support',
  
  // Admin capabilities
  view_all_organizations: 'view_all_organizations',
  manage_billing: 'manage_billing',
  manage_subscriptions: 'manage_subscriptions',
  access_admin_tools: 'access_admin_tools',
  manage_feature_flags: 'manage_feature_flags',
  view_system_logs: 'view_system_logs',
} as const;

export type Capability = keyof typeof CAPABILITIES;

// Role-based capability mapping
export const ROLE_CAPABILITIES: Record<Role, Capability[]> = {
  student: [
    'view_dashboard',
    'access_mobile_app',
    'view_progress',
    'view_announcements',
    'receive_push_notifications',
  ],
  parent: [
    'view_dashboard',
    'access_mobile_app',
    'view_child_progress',
    'communicate_with_teachers',
    'access_homework_help',
    'access_parent_dashboard',
    'submit_homework',
    'view_announcements',
    'send_voice_notes',
    'view_progress',
    'in_app_messaging',
    'parent_teacher_chat',
    'offline_homework_submission',
    'receive_push_notifications',
    'read_school_announcements',
    'reply_to_teachers',
    'send_media_messages',
    'record_voice_feedback',
    'provide_feedback',
    'view_student_progress',
    'view_homework_history',
    'view_attendance_records',
    'view_progress_reports',
    'whatsapp_opt_in',
    'whatsapp_send_messages',
    'whatsapp_receive_messages',
    'ai_homework_helper',
  ],
  teacher: [
    'view_dashboard',
    'access_mobile_app',
    'manage_classes',
    'create_assignments',
    'grade_assignments',
    'view_class_analytics',
    'communicate_with_parents',
    'ai_lesson_generation',
    'ai_grading_assistance',
    'ai_homework_helper',
    'ai_progress_analysis',
    'ai_insights',
  ],
  principal: [
    'view_dashboard',
    'access_mobile_app',
    'view_organization_settings',
    'invite_members',
    'manage_seats',
    'view_school_metrics',
    'manage_teachers',
    'manage_students',
    'manage_classes',
    'access_principal_hub',
    'generate_school_reports',
    'create_assignments',
    'grade_assignments',
    'view_class_analytics',
    'ai_lesson_generation',
    'ai_grading_assistance',
    'ai_homework_helper',
    'ai_progress_analysis',
    'ai_insights',
    'ai_quota_management',
  ],
  principal_admin: [
    'view_dashboard',
    'access_mobile_app',
    'view_organization_settings',
    'invite_members',
    'manage_seats',
    'view_school_metrics',
    'manage_teachers',
    'manage_students',
    'manage_classes',
    'access_principal_hub',
    'generate_school_reports',
    'create_assignments',
    'grade_assignments',
    'view_class_analytics',
    'ai_lesson_generation',
    'ai_grading_assistance',
    'ai_homework_helper',
    'ai_progress_analysis',
    'ai_insights',
    'ai_quota_management',
  ],
  super_admin: [
    'view_dashboard',
    'access_mobile_app',
    'view_all_organizations',
    'manage_organization',
    'manage_billing',
    'manage_subscriptions',
    'access_admin_tools',
    'manage_feature_flags',
    'view_system_logs',
    'advanced_analytics',
    'bulk_operations',
    'custom_reports',
    'api_access',
    'priority_support',
    'ai_lesson_generation',
    'ai_grading_assistance',
    'ai_homework_helper',
    'ai_stem_activities',
    'ai_progress_analysis',
    'ai_insights',
    'ai_quota_management',
  ],
};

// Plan tier capability additions
export const TIER_CAPABILITIES: Record<PlanTier | 'basic' | 'pro', Capability[]> = {
  free: [
    'ai_homework_helper',
    'view_engagement_metrics',
  ],
  starter: [
    'ai_homework_helper',
    'ai_lesson_generation',
    'view_engagement_metrics',
    'whatsapp_voice_messages',
    'ai_insights',
  ],
  basic: [
    'ai_homework_helper',
    'ai_lesson_generation',
    'view_engagement_metrics',
    'ai_insights',
  ],
  pro: [
    'ai_homework_helper',
    'ai_lesson_generation',
    'ai_grading_assistance',
    'ai_stem_activities',
    'ai_progress_analysis',
    'advanced_analytics',
    'view_engagement_metrics',
    'whatsapp_voice_messages',
    'ai_insights',
    'use_whatsapp',
  ],
  premium: [
    'ai_homework_helper',
    'ai_lesson_generation',
    'ai_grading_assistance',
    'ai_stem_activities',
    'ai_progress_analysis',
    'advanced_analytics',
    'view_engagement_metrics',
    'whatsapp_voice_messages',
    'ai_insights',
    'use_whatsapp',
  ],
  enterprise: [
    'ai_homework_helper',
    'ai_lesson_generation',
    'ai_grading_assistance',
    'ai_stem_activities',
    'ai_progress_analysis',
    'advanced_analytics',
    'bulk_operations',
    'custom_reports',
    'sso_access',
    'priority_support',
    'view_engagement_metrics',
    'whatsapp_voice_messages',
    'ai_insights',
    'ai_quota_management',
    'use_whatsapp',
  ],
};
