/**
 * Approval Workflow Types
 * 
 * Shared type definitions for POP, Petty Cash, and Progress Report workflows
 * Extracted from ApprovalWorkflowService for WARP.md compliance
 */

export interface ProofOfPayment {
  id: string;
  preschool_id: string;
  student_id: string;
  submitted_by: string;
  parent_name: string;
  parent_email?: string;
  parent_phone?: string;
  
  // Payment details
  payment_amount: number;
  payment_date: string;
  payment_method: 'bank_transfer' | 'eft' | 'cash' | 'cheque' | 'mobile_payment' | 'card' | 'other';
  payment_reference?: string;
  bank_name?: string;
  account_number_last_4?: string;
  
  // Purpose
  payment_purpose: string;
  fee_type?: 'tuition' | 'registration' | 'activity' | 'transport' | 'meals' | 'uniform' | 'other';
  month_year?: string;
  
  // Documents
  receipt_image_path?: string;
  bank_statement_path?: string;
  additional_documents?: string[];
  
  // Status
  status: 'submitted' | 'under_review' | 'approved' | 'rejected' | 'requires_info' | 'matched';
  reviewed_by?: string;
  reviewed_at?: string;
  review_notes?: string;
  rejection_reason?: string;
  
  // Auto-matching
  matched_payment_id?: string;
  auto_matched: boolean;
  matching_confidence?: number;
  
  // Timestamps
  submitted_at: string;
  approved_at?: string;
  created_at: string;
  updated_at: string;
  
  // Student info (joined)
  student_name?: string;
  student_grade?: string;
}

export interface PettyCashRequest {
  id: string;
  preschool_id: string;
  requested_by: string;
  requestor_name: string;
  requestor_role: string;
  
  // Request details
  amount: number;
  category: string;
  description: string;
  justification: string;
  urgency: 'low' | 'normal' | 'high' | 'urgent';
  
  // Budget
  budget_category_id?: string;
  estimated_total_cost?: number;
  
  // Status
  status: 'pending' | 'approved' | 'rejected' | 'requires_info' | 'disbursed' | 'completed' | 'cancelled';
  approved_by?: string;
  approved_at?: string;
  approval_notes?: string;
  rejection_reason?: string;
  approved_amount?: number;
  
  // Disbursement
  disbursed_by?: string;
  disbursed_at?: string;
  disbursement_method?: 'cash' | 'bank_transfer' | 'petty_cash_float';
  
  // Receipt
  receipt_required: boolean;
  receipt_deadline?: string;
  receipt_submitted: boolean;
  receipt_image_path?: string;
  actual_amount_spent?: number;
  
  // Change tracking
  change_amount: number;
  change_returned: boolean;
  
  // Timestamps
  requested_at: string;
  needed_by?: string;
  created_at: string;
  updated_at: string;
}

export interface ProgressReport {
  id: string;
  preschool_id: string;
  student_id: string;
  teacher_id: string;
  report_period: string;
  report_type: string;
  report_category?: string;
  
  // Content
  teacher_comments?: string;
  strengths?: string;
  areas_for_improvement?: string;
  subjects_performance?: Record<string, any>;
  overall_grade?: string;
  
  // School readiness (for preschool)
  school_readiness_indicators?: Record<string, any>;
  developmental_milestones?: Record<string, boolean>;
  transition_readiness_level?: string;
  readiness_notes?: string;
  recommendations?: string;
  
  // Approval status
  approval_status: 'draft' | 'pending_review' | 'approved' | 'rejected' | 'sent';
  reviewed_by?: string;
  reviewed_at?: string;
  rejection_reason?: string;
  sent_at?: string;
  
  // Timestamps
  created_at: string;
  updated_at: string;
}

export interface ApprovalSummary {
  pending_pops: number;
  pending_petty_cash: number;
  total_pending_amount: number;
  urgent_requests: number;
  overdue_receipts: number;
}

export type ApprovalEntityType = 'proof_of_payment' | 'petty_cash_request' | 'expense' | 'payment' | 'progress_report';
export type ApprovalAction = 'submit' | 'review' | 'approve' | 'reject' | 'request_info' | 'resubmit' | 'cancel';
export type EntityType = ApprovalEntityType;

/**
 * Parameters for logging approval actions (audit trail)
 */
export interface ApprovalActionParams {
  preschoolId: string;
  entityType: EntityType;
  entityId: string;
  performedBy: string;
  performerName: string;
  performerRole: string;
  action: ApprovalAction;
  previousStatus: string | null;
  newStatus: string;
  notes?: string;
  reason?: string;
}