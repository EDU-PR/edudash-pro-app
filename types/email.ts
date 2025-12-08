/**
 * Email Service Types
 *
 * Type definitions for the email service module.
 * Extracted from services/EmailTemplateService.ts per WARP.md standards.
 */

/**
 * Email template database record
 */
export interface EmailTemplate {
  id: string;
  preschool_id: string | null;
  name: string;
  template_type: 'progress_report' | 'newsletter' | 'event_reminder' | 'invoice' | 'welcome' | 'custom';
  subject_template: string;
  body_html: string;
  body_text: string | null;
  variables: string[];
  is_system_template: boolean;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Progress report for student performance tracking
 */
export interface ProgressReport {
  id?: string;
  preschool_id: string;
  student_id: string;
  teacher_id: string;
  report_period: string; // e.g., "Q1 2025", "Term 1"
  report_type: 'weekly' | 'monthly' | 'quarterly' | 'annual';
  overall_comments?: string;
  teacher_comments?: string;
  strengths?: string;
  areas_for_improvement?: string;
  subjects_performance?: Record<string, { grade: string; comments: string }>;
  attendance_summary?: { present: number; absent: number; percentage: number };
  behavioral_notes?: unknown;
  overall_grade?: string;
  email_sent_at?: string;
  email_message_id?: string;
  
  // Approval workflow fields
  status?: 'draft' | 'pending_review' | 'approved' | 'rejected' | 'sent';
  teacher_signature?: string;
  teacher_signature_data?: string;
  teacher_signed_at?: string;
  principal_signature_data?: string;
  principal_signed_at?: string;
  reviewed_by?: string;
  reviewed_at?: string;
  reviewer_name?: string;
  rejection_reason?: string;
  review_notes?: string;
  
  // School readiness fields (for Grade R transition reports)
  report_category?: 'general' | 'school_readiness';
  school_readiness_indicators?: SchoolReadinessIndicators;
  developmental_milestones?: Record<string, boolean>;
  transition_readiness_level?: 'not_ready' | 'developing' | 'ready' | 'exceeds_expectations';
  readiness_notes?: string;
  recommendations?: string;
}

/**
 * School readiness indicators for Grade R transition reports
 */
export interface SchoolReadinessIndicators {
  social_skills?: { rating: number; notes: string };
  emotional_development?: { rating: number; notes: string };
  gross_motor_skills?: { rating: number; notes: string };
  fine_motor_skills?: { rating: number; notes: string };
  cognitive_development?: { rating: number; notes: string };
  language_development?: { rating: number; notes: string };
  independence?: { rating: number; notes: string };
  self_care?: { rating: number; notes: string };
}

/**
 * Newsletter database record
 */
export interface Newsletter {
  id?: string;
  preschool_id: string;
  title: string;
  content_html: string;
  content_text?: string;
  status: 'draft' | 'scheduled' | 'sending' | 'sent' | 'failed';
  scheduled_for?: string;
  sent_at?: string;
  recipient_filter?: {
    roles?: string[];
    classes?: string[];
  };
  total_recipients?: number;
  sent_count?: number;
  failed_count?: number;
  open_count?: number;
  click_count?: number;
  created_by: string;
}

/**
 * Email send request payload
 */
export interface EmailSendRequest {
  to: string | string[];
  subject: string;
  body: string;
  is_html?: boolean;
  reply_to?: string;
  cc?: string[];
  bcc?: string[];
  confirmed?: boolean;
}

/**
 * Email send response
 */
export interface EmailSendResponse {
  success: boolean;
  message_id?: string;
  error?: string;
}

/**
 * Student data for email generation
 */
export interface StudentData {
  first_name: string;
  last_name: string;
  preschool_id?: string;
  class_id?: string;
  class?: {
    name: string;
  };
  parent?: {
    email: string;
    name: string;
  };
}

/**
 * School data for email generation
 */
export interface SchoolData {
  id: string;
  name: string;
  address?: string;
  phone?: string;
  email?: string;
  logo_url?: string;
}

/**
 * Teacher data for email generation
 */
export interface TeacherData {
  id: string;
  name: string;
  email: string;
}

/**
 * Recipient data for newsletters
 */
export interface RecipientData {
  user_id: string;
  email: string;
  name: string;
  role?: string;
}

/**
 * Progress report email variables
 */
export interface ProgressReportEmailVariables {
  student_name: string;
  report_period: string;
  teacher_name: string;
  school_name: string;
  overall_grade?: string;
  strengths?: string;
  improvements?: string;
  teacher_comments?: string;
  [key: string]: string | undefined;
}

/**
 * Newsletter email variables
 */
export interface NewsletterEmailVariables {
  school_name: string;
  newsletter_title: string;
  content_html: string;
  recipient_name: string;
  [key: string]: string | undefined;
}
