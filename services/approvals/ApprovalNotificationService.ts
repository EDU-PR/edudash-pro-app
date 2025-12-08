/**
 * Approval Notification Service
 * 
 * Handles all notification logic for approval workflows
 * ECD-focused messaging that celebrates parent-teacher partnership
 * 
 * @module ApprovalNotificationService
 */

import { supabase } from '../../lib/supabase';
import { FinancialDataService } from '../FinancialDataService';
import type { ProofOfPayment, PettyCashRequest, ProgressReport } from './types';

export class ApprovalNotificationService {
  
  // ============================================================================
  // POP NOTIFICATIONS - Payment approval/rejection notifications for parents
  // ============================================================================

  /**
   * Notify principal of new POP submission from parent
   * Channel: educational (default priority)
   */
  static async notifyPrincipalOfNewPOP(pop: ProofOfPayment): Promise<void> {
    try {
      // Get principal user ID from preschool
      const { data: preschool } = await supabase
        .from('preschools')
        .select('principal_id, name')
        .eq('id', pop.preschool_id)
        .single();

      if (!preschool?.principal_id) {
        console.warn('No principal found for preschool:', pop.preschool_id);
        return;
      }

      const amount = FinancialDataService.formatCurrency(pop.payment_amount);

      await supabase
        .from('push_notifications')
        .insert({
          recipient_user_id: preschool.principal_id,
          title: '💰 New Payment Received',
          body: `${pop.parent_name} submitted proof of payment for ${amount}. Tap to review.`,
          notification_type: 'payment_submitted',
          preschool_id: pop.preschool_id,
          status: 'sent',
          data: {
            type: 'pop_submitted',
            pop_id: pop.id,
            parent_name: pop.parent_name,
            amount: pop.payment_amount,
            student_id: pop.student_id,
            action_url: '/dashboard/principal/approvals',
            channel: 'educational',
            priority: 'high'
          }
        });

      console.log(`✅ Notified principal of new POP from ${pop.parent_name}`);
    } catch (error) {
      console.error('Error notifying principal of new POP:', error);
    }
  }

  /**
   * Notify parent that their payment proof was approved
   * Channel: educational (default priority) with celebration tone
   */
  static async notifyParentPOPApproved(pop: ProofOfPayment): Promise<void> {
    try {
      // Get school name and student name for personalization
      const { data: preschool } = await supabase
        .from('preschools')
        .select('name')
        .eq('id', pop.preschool_id)
        .single();

      const { data: student } = await supabase
        .from('students')
        .select('first_name, last_name')
        .eq('id', pop.student_id)
        .single();

      const schoolName = preschool?.name || 'your school';
      const studentName = student ? `${student.first_name} ${student.last_name}` : 'your child';
      const amount = FinancialDataService.formatCurrency(pop.payment_amount);

      await supabase
        .from('push_notifications')
        .insert({
          recipient_user_id: pop.submitted_by,
          title: '🎉 Payment Approved!',
          body: `Your payment of ${amount} for ${studentName} has been approved. Welcome to the ${schoolName} family!`,
          notification_type: 'payment_approved',
          preschool_id: pop.preschool_id,
          status: 'sent',
          data: {
            type: 'pop_approved',
            pop_id: pop.id,
            student_id: pop.student_id,
            amount: pop.payment_amount,
            approved_at: pop.approved_at,
            action_url: '/dashboard/parent',
            channel: 'educational',
            priority: 'high',
            celebration: true
          }
        });

      console.log(`✅ Notified parent ${pop.parent_name} of POP approval`);
    } catch (error) {
      console.error('Error notifying parent of POP approval:', error);
    }
  }

  /**
   * Notify parent that their payment proof was rejected
   * Channel: urgent (requires attention)
   */
  static async notifyParentPOPRejected(pop: ProofOfPayment): Promise<void> {
    try {
      const amount = FinancialDataService.formatCurrency(pop.payment_amount);
      const reason = pop.rejection_reason || 'Unable to verify payment details';

      await supabase
        .from('push_notifications')
        .insert({
          recipient_user_id: pop.submitted_by,
          title: '⚠️ Payment Review Needed',
          body: `Your payment proof (${amount}) needs attention. ${reason}. Please resubmit or contact us.`,
          notification_type: 'payment_rejected',
          preschool_id: pop.preschool_id,
          status: 'sent',
          data: {
            type: 'pop_rejected',
            pop_id: pop.id,
            student_id: pop.student_id,
            amount: pop.payment_amount,
            rejection_reason: pop.rejection_reason,
            action_url: '/dashboard/parent/payments',
            channel: 'urgent',
            priority: 'high',
            requires_action: true
          }
        });

      console.log(`✅ Notified parent ${pop.parent_name} of POP rejection`);
    } catch (error) {
      console.error('Error notifying parent of POP rejection:', error);
    }
  }

  // ============================================================================
  // PETTY CASH NOTIFICATIONS - For teacher petty cash requests
  // ============================================================================

  /**
   * Notify principal of new petty cash request from teacher
   * Channel: educational (default priority)
   */
  static async notifyPrincipalOfNewPettyCashRequest(request: PettyCashRequest): Promise<void> {
    try {
      const { data: preschool } = await supabase
        .from('preschools')
        .select('principal_id')
        .eq('id', request.preschool_id)
        .single();

      if (!preschool?.principal_id) {
        console.warn('No principal found for preschool:', request.preschool_id);
        return;
      }

      const amount = FinancialDataService.formatCurrency(request.amount);
      const urgencyEmoji = request.urgency === 'urgent' ? '🚨 ' : request.urgency === 'high' ? '⚡ ' : '';

      await supabase
        .from('push_notifications')
        .insert({
          recipient_user_id: preschool.principal_id,
          title: `${urgencyEmoji}Petty Cash Request`,
          body: `${request.requestor_name} needs ${amount} for ${request.category}. Tap to review.`,
          notification_type: 'petty_cash_request',
          preschool_id: request.preschool_id,
          status: 'sent',
          data: {
            type: 'petty_cash_request',
            request_id: request.id,
            requestor_id: request.requested_by,
            requestor_name: request.requestor_name,
            amount: request.amount,
            category: request.category,
            urgency: request.urgency,
            action_url: '/dashboard/principal/petty-cash',
            channel: 'educational',
            priority: request.urgency === 'urgent' ? 'max' : request.urgency === 'high' ? 'high' : 'default'
          }
        });

      console.log(`✅ Notified principal of petty cash request from ${request.requestor_name}`);
    } catch (error) {
      console.error('Error notifying principal of petty cash request:', error);
    }
  }

  /**
   * Notify teacher that their petty cash request was approved
   * Channel: educational with celebration tone
   */
  static async notifyTeacherPettyCashApproved(request: PettyCashRequest): Promise<void> {
    try {
      const approvedAmount = request.approved_amount || request.amount;
      const amount = FinancialDataService.formatCurrency(approvedAmount);

      await supabase
        .from('push_notifications')
        .insert({
          recipient_user_id: request.requested_by,
          title: '✅ Petty Cash Approved!',
          body: `Your ${amount} request for ${request.category} has been approved. Collect from the office.`,
          notification_type: 'petty_cash_approved',
          preschool_id: request.preschool_id,
          status: 'sent',
          data: {
            type: 'petty_cash_approved',
            request_id: request.id,
            approved_amount: approvedAmount,
            category: request.category,
            approved_by: request.approved_by,
            approved_at: request.approved_at,
            action_url: '/dashboard/teacher/petty-cash',
            channel: 'educational',
            priority: 'high',
            celebration: true
          }
        });

      console.log(`✅ Notified teacher ${request.requestor_name} of petty cash approval`);
    } catch (error) {
      console.error('Error notifying teacher of petty cash approval:', error);
    }
  }

  /**
   * Notify teacher that their petty cash request was rejected
   * Channel: educational (informational)
   */
  static async notifyTeacherPettyCashRejected(request: PettyCashRequest): Promise<void> {
    try {
      const amount = FinancialDataService.formatCurrency(request.amount);
      const reason = request.rejection_reason || 'Request could not be approved at this time';

      await supabase
        .from('push_notifications')
        .insert({
          recipient_user_id: request.requested_by,
          title: '📋 Petty Cash Update',
          body: `Your ${amount} request for ${request.category} was not approved. ${reason}`,
          notification_type: 'petty_cash_rejected',
          preschool_id: request.preschool_id,
          status: 'sent',
          data: {
            type: 'petty_cash_rejected',
            request_id: request.id,
            amount: request.amount,
            category: request.category,
            rejection_reason: request.rejection_reason,
            action_url: '/dashboard/teacher/petty-cash',
            channel: 'educational',
            priority: 'default'
          }
        });

      console.log(`✅ Notified teacher ${request.requestor_name} of petty cash rejection`);
    } catch (error) {
      console.error('Error notifying teacher of petty cash rejection:', error);
    }
  }

  // ============================================================================
  // PROGRESS REPORT NOTIFICATIONS - Celebrating early learning milestones
  // ============================================================================

  /**
   * Notify principal of new progress report submission from teacher
   * Channel: educational (default priority)
   */
  static async notifyPrincipalOfNewReport(report: ProgressReport): Promise<void> {
    try {
      const { data: preschool } = await supabase
        .from('preschools')
        .select('principal_id')
        .eq('id', report.preschool_id)
        .single();

      if (!preschool?.principal_id) {
        console.warn('No principal found for preschool:', report.preschool_id);
        return;
      }

      const { data: student } = await supabase
        .from('students')
        .select('first_name, last_name')
        .eq('id', report.student_id)
        .single();

      const studentName = student ? `${student.first_name} ${student.last_name}` : 'a student';
      const reportType = report.report_category === 'school_readiness' ? 'School Readiness' : 'Progress';

      await supabase
        .from('push_notifications')
        .insert({
          recipient_user_id: preschool.principal_id,
          title: '📊 New Report for Review',
          body: `${reportType} report for ${studentName} is ready for your review and approval.`,
          notification_type: 'report_submitted',
          preschool_id: report.preschool_id,
          status: 'sent',
          data: {
            type: 'report_submitted',
            report_id: report.id,
            student_id: report.student_id,
            student_name: studentName,
            report_type: report.report_type,
            report_category: report.report_category,
            action_url: `/dashboard/principal/reports/${report.id}`,
            channel: 'educational',
            priority: 'default'
          }
        });

      console.log(`✅ Notified principal of new report for ${studentName}`);
    } catch (error) {
      console.error('Error notifying principal of new report:', error);
    }
  }

  /**
   * Notify teacher that their progress report was approved
   * Channel: educational with positive reinforcement
   */
  static async notifyTeacherReportApproved(report: ProgressReport): Promise<void> {
    try {
      const { data: student } = await supabase
        .from('students')
        .select('first_name, last_name')
        .eq('id', report.student_id)
        .single();

      const studentName = student ? `${student.first_name} ${student.last_name}` : 'the student';

      await supabase
        .from('push_notifications')
        .insert({
          recipient_user_id: report.teacher_id,
          title: '🌟 Report Approved!',
          body: `Great work! Your progress report for ${studentName} has been approved and sent to parents.`,
          notification_type: 'report_approved',
          preschool_id: report.preschool_id,
          status: 'sent',
          data: {
            type: 'report_approved',
            report_id: report.id,
            student_id: report.student_id,
            student_name: studentName,
            approved_at: report.reviewed_at,
            action_url: `/dashboard/teacher/reports/${report.id}`,
            channel: 'educational',
            priority: 'default',
            celebration: true
          }
        });

      console.log(`✅ Notified teacher of report approval for ${studentName}`);
    } catch (error) {
      console.error('Error notifying teacher of report approval:', error);
    }
  }

  /**
   * Notify teacher that their progress report needs revision
   * Channel: educational (constructive feedback)
   */
  static async notifyTeacherReportRejected(report: ProgressReport): Promise<void> {
    try {
      const { data: student } = await supabase
        .from('students')
        .select('first_name, last_name')
        .eq('id', report.student_id)
        .single();

      const studentName = student ? `${student.first_name} ${student.last_name}` : 'the student';
      const reason = report.rejection_reason || 'Needs some updates before sending to parents';

      await supabase
        .from('push_notifications')
        .insert({
          recipient_user_id: report.teacher_id,
          title: '✏️ Report Revision Needed',
          body: `The progress report for ${studentName} needs revision. ${reason}`,
          notification_type: 'report_rejected',
          preschool_id: report.preschool_id,
          status: 'sent',
          data: {
            type: 'report_rejected',
            report_id: report.id,
            student_id: report.student_id,
            student_name: studentName,
            rejection_reason: report.rejection_reason,
            action_url: `/dashboard/teacher/reports/${report.id}`,
            channel: 'educational',
            priority: 'default'
          }
        });

      console.log(`✅ Notified teacher of report revision needed for ${studentName}`);
    } catch (error) {
      console.error('Error notifying teacher of report rejection:', error);
    }
  }

  /**
   * Notify teacher that their report was successfully sent to parent
   * Channel: educational (confirmation)
   */
  static async notifyTeacherReportSent(report: ProgressReport): Promise<void> {
    try {
      const { data: student } = await supabase
        .from('students')
        .select('first_name, last_name')
        .eq('id', report.student_id)
        .single();

      const studentName = student ? `${student.first_name} ${student.last_name}` : 'the student';

      await supabase
        .from('push_notifications')
        .insert({
          recipient_user_id: report.teacher_id,
          title: '📧 Report Delivered',
          body: `The progress report for ${studentName} has been successfully sent to their parents.`,
          notification_type: 'report_sent',
          preschool_id: report.preschool_id,
          status: 'sent',
          data: {
            type: 'report_sent',
            report_id: report.id,
            student_id: report.student_id,
            student_name: studentName,
            sent_at: new Date().toISOString(),
            action_url: `/dashboard/teacher/reports/${report.id}`,
            channel: 'educational',
            priority: 'low'
          }
        });

      console.log(`✅ Notified teacher that report was sent for ${studentName}`);
    } catch (error) {
      console.error('Error notifying teacher of report sent:', error);
    }
  }
}
