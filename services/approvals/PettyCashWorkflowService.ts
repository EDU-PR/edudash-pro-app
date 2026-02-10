/**
 * Petty Cash Workflow Service
 *
 * Uses petty_cash_transactions as the source of truth for petty cash approvals.
 * Keeps the public service API stable for existing screens.
 *
 * @module PettyCashWorkflowService
 */

import { supabase } from '../../lib/supabase';
import { withPettyCashTenant } from '@/lib/utils/pettyCashTenant';
import type { PettyCashRequest, ApprovalActionParams } from './types';
import { ApprovalNotificationService } from './ApprovalNotificationService';
import { writeApprovalAuditLog } from './auditLogger';

interface BasicProfile {
  id: string;
  auth_user_id?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  role?: string | null;
}

export class PettyCashWorkflowService {
  private static mapTransactionStatusToRequestStatus(status: unknown): PettyCashRequest['status'] {
    const value = String(status || '').toLowerCase();
    switch (value) {
      case 'approved':
        return 'approved';
      case 'rejected':
        return 'rejected';
      case 'completed':
        return 'completed';
      default:
        return 'pending';
    }
  }

  private static mapRequestStatusesToTransactionStatuses(statuses?: string[]): string[] {
    if (!Array.isArray(statuses) || statuses.length === 0) return [];
    const mapped = new Set<string>();

    for (const raw of statuses) {
      const status = String(raw || '').toLowerCase();
      switch (status) {
        case 'requires_info':
          mapped.add('pending');
          break;
        case 'disbursed':
          mapped.add('approved');
          break;
        case 'cancelled':
          mapped.add('rejected');
          break;
        default:
          mapped.add(status);
          break;
      }
    }

    return Array.from(mapped);
  }

  private static normalizeUrgency(raw: unknown, fallbackText = ''): PettyCashRequest['urgency'] {
    const value = `${String(raw || '').toLowerCase()} ${String(fallbackText || '').toLowerCase()}`;
    if (value.includes('urgent')) return 'urgent';
    if (value.includes('high')) return 'high';
    if (value.includes('low')) return 'low';
    return 'normal';
  }

  private static composeDescription(description: string, justification?: string): string {
    const base = String(description || '').trim();
    const reason = String(justification || '').trim();
    if (!reason) return base;
    if (!base) return `Justification: ${reason}`;
    return `${base}\nJustification: ${reason}`;
  }

  private static async loadProfilesForCreators(creatorIds: string[]): Promise<Map<string, BasicProfile>> {
    const ids = Array.from(new Set(creatorIds.filter(Boolean)));
    const profileMap = new Map<string, BasicProfile>();
    if (!ids.length) return profileMap;

    const byId = await supabase
      .from('profiles')
      .select('id, auth_user_id, first_name, last_name, role')
      .in('id', ids);

    if (Array.isArray(byId.data)) {
      byId.data.forEach((profile: BasicProfile) => {
        if (profile?.id) profileMap.set(String(profile.id), profile);
        if (profile?.auth_user_id) profileMap.set(String(profile.auth_user_id), profile);
      });
    }

    const unresolved = ids.filter((id) => !profileMap.has(id));
    if (!unresolved.length) return profileMap;

    const byAuth = await supabase
      .from('profiles')
      .select('id, auth_user_id, first_name, last_name, role')
      .in('auth_user_id', unresolved as any);

    if (Array.isArray(byAuth.data)) {
      byAuth.data.forEach((profile: BasicProfile) => {
        if (profile?.id) profileMap.set(String(profile.id), profile);
        if (profile?.auth_user_id) profileMap.set(String(profile.auth_user_id), profile);
      });
    }

    return profileMap;
  }

  private static mapTransactionToRequest(
    tx: any,
    profiles: Map<string, BasicProfile>,
    overrides?: Partial<PettyCashRequest>,
  ): PettyCashRequest {
    const createdBy = String(tx?.created_by || '');
    const profile = profiles.get(createdBy);
    const requestorName = profile
      ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || 'Staff Member'
      : 'Staff Member';
    const requestorRole = String(profile?.role || 'teacher');

    const createdAt = String(tx?.created_at || new Date().toISOString());
    const updatedAt = String(tx?.updated_at || createdAt);
    const neededBy = tx?.transaction_date ? String(tx.transaction_date) : undefined;

    const baseDate = neededBy ? new Date(neededBy) : new Date(createdAt);
    const receiptDeadline = Number.isNaN(baseDate.getTime())
      ? undefined
      : new Date(baseDate.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const status = this.mapTransactionStatusToRequestStatus(tx?.status);

    const base: PettyCashRequest = {
      id: String(tx?.id || ''),
      preschool_id: String(tx?.school_id || tx?.preschool_id || ''),
      requested_by: createdBy,
      requestor_name: requestorName,
      requestor_role: requestorRole,
      amount: Math.abs(Number(tx?.amount || 0)),
      category: String(tx?.category || 'General'),
      description: String(tx?.description || ''),
      justification: String(tx?.description || ''),
      urgency: this.normalizeUrgency(tx?.transaction_type, tx?.description),
      status,
      approved_by: tx?.approved_by || undefined,
      approved_at: status === 'approved' || status === 'completed' ? updatedAt : undefined,
      approved_amount: status === 'approved' || status === 'completed'
        ? Math.abs(Number(tx?.amount || 0))
        : undefined,
      disbursed_by: tx?.approved_by || undefined,
      disbursed_at: status === 'approved' || status === 'completed' ? updatedAt : undefined,
      disbursement_method: 'petty_cash_float',
      receipt_required: true,
      receipt_deadline: receiptDeadline,
      receipt_submitted: Boolean(tx?.receipt_url),
      receipt_image_path: tx?.receipt_url || undefined,
      actual_amount_spent: tx?.receipt_url ? Math.abs(Number(tx?.amount || 0)) : undefined,
      change_amount: 0,
      change_returned: false,
      requested_at: createdAt,
      needed_by: neededBy,
      created_at: createdAt,
      updated_at: updatedAt,
    };

    return {
      ...base,
      ...overrides,
    };
  }

  private static async getTransactionById(requestId: string): Promise<{ data: any; column: string } | null> {
    const result = await withPettyCashTenant((column, client) =>
      client
        .from('petty_cash_transactions')
        .select(`id, ${column}, amount, status, type, category, description, created_by, approved_by, receipt_url, transaction_type, transaction_date, created_at, updated_at`)
        .eq('id', requestId)
        .eq('type', 'expense')
        .single()
    );

    if (result.error || !result.data) {
      return null;
    }

    return {
      data: result.data,
      column: result.column,
    };
  }

  /**
   * Submit a new petty cash request
   */
  static async submitPettyCashRequest(
    preschoolId: string,
    requestedBy: string,
    requestorName: string,
    requestorRole: string,
    requestData: {
      amount: number;
      category: string;
      description: string;
      justification: string;
      urgency: 'low' | 'normal' | 'high' | 'urgent';
      budget_category_id?: string;
      estimated_total_cost?: number;
      needed_by?: string;
      receipt_required?: boolean;
    }
  ): Promise<PettyCashRequest | null> {
    try {
      const transactionDate = requestData.needed_by || new Date().toISOString().split('T')[0];
      const receiptDeadline = new Date(new Date(transactionDate).getTime() + 7 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split('T')[0];

      const { data, error } = await withPettyCashTenant((column, client) =>
        client
          .from('petty_cash_transactions')
          .insert({
            [column]: preschoolId,
            created_by: requestedBy,
            amount: Math.abs(Number(requestData.amount || 0)),
            type: 'expense',
            category: requestData.category || 'General',
            description: this.composeDescription(requestData.description, requestData.justification),
            status: 'pending',
            transaction_date: transactionDate,
            transaction_type: requestData.urgency,
            reference_number: requestData.budget_category_id || null,
          })
          .select('*')
          .single()
      );

      if (error || !data) {
        console.error('Error submitting petty cash request:', error);
        return null;
      }

      const profileMap = new Map<string, BasicProfile>([
        [requestedBy, {
          id: requestedBy,
          first_name: requestorName,
          last_name: '',
          role: requestorRole,
        }],
      ]);

      const request = this.mapTransactionToRequest(data, profileMap, {
        requestor_name: requestorName,
        requestor_role: requestorRole,
        urgency: requestData.urgency,
        justification: requestData.justification,
        receipt_required: requestData.receipt_required ?? true,
        receipt_deadline: receiptDeadline,
      });

      await this.logAction({
        preschoolId,
        entityType: 'petty_cash_request',
        entityId: request.id,
        performedBy: requestedBy,
        performerName: requestorName,
        performerRole: requestorRole,
        action: 'submit',
        previousStatus: null,
        newStatus: 'pending',
        notes: `Petty cash request for ${requestData.description}`,
      });

      await ApprovalNotificationService.notifyPrincipalOfNewPettyCashRequest(request);
      return request;
    } catch (error) {
      console.error('Error in submitPettyCashRequest:', error);
      return null;
    }
  }

  /**
   * Get pending petty cash requests for principal review
   */
  static async getPendingPettyCashRequests(preschoolId: string, limit = 50): Promise<PettyCashRequest[]> {
    try {
      const { data, error } = await withPettyCashTenant((column, client) =>
        client
          .from('petty_cash_transactions')
          .select('*')
          .eq(column, preschoolId)
          .eq('type', 'expense')
          .eq('status', 'pending')
          .order('created_at', { ascending: false })
          .limit(limit)
      );

      if (error) {
        console.error('Error loading pending petty cash requests:', error);
        return [];
      }

      const rows = Array.isArray(data) ? data : [];
      const profiles = await this.loadProfilesForCreators(rows.map((row: any) => String(row.created_by || '')));

      return rows.map((row: any) => this.mapTransactionToRequest(row, profiles));
    } catch (error) {
      console.error('Error in getPendingPettyCashRequests:', error);
      return [];
    }
  }

  /**
   * Get all petty cash requests with filters
   */
  static async getAllPettyCashRequests(
    preschoolId: string,
    options?: {
      status?: string[];
      limit?: number;
      offset?: number;
      requestorId?: string;
      urgency?: string;
    }
  ): Promise<PettyCashRequest[]> {
    try {
      const mappedStatuses = this.mapRequestStatusesToTransactionStatuses(options?.status);

      const { data, error } = await withPettyCashTenant((column, client) => {
        let query = client
          .from('petty_cash_transactions')
          .select('*')
          .eq(column, preschoolId)
          .eq('type', 'expense')
          .order('created_at', { ascending: false });

        if (mappedStatuses.length) {
          query = query.in('status', mappedStatuses);
        }

        if (options?.requestorId) {
          query = query.eq('created_by', options.requestorId);
        }

        if (options?.urgency) {
          query = query.eq('transaction_type', options.urgency);
        }

        if (options?.limit) {
          query = query.limit(options.limit);
        }

        if (options?.offset) {
          query = query.range(options.offset, options.offset + (options.limit || 50) - 1);
        }

        return query;
      });

      if (error) {
        console.error('Error loading petty cash requests:', error);
        return [];
      }

      const rows = Array.isArray(data) ? data : [];
      const profiles = await this.loadProfilesForCreators(rows.map((row: any) => String(row.created_by || '')));
      return rows.map((row: any) => this.mapTransactionToRequest(row, profiles));
    } catch (error) {
      console.error('Error in getAllPettyCashRequests:', error);
      return [];
    }
  }

  /**
   * Approve a petty cash request
   */
  static async approvePettyCashRequest(
    requestId: string,
    approvedBy: string,
    approverName: string,
    approvedAmount?: number,
    approvalNotes?: string
  ): Promise<boolean> {
    try {
      const existing = await this.getTransactionById(requestId);
      if (!existing) {
        console.error('Error fetching petty cash request:', requestId);
        return false;
      }

      const finalApprovedAmount = Math.abs(Number(approvedAmount ?? existing.data.amount ?? 0));

      const updateResult = await withPettyCashTenant((column, client) =>
        client
          .from('petty_cash_transactions')
          .update({
            status: 'approved',
            approved_by: approvedBy,
            amount: finalApprovedAmount,
            updated_at: new Date().toISOString(),
          })
          .eq('id', requestId)
          .eq(column, existing.data[existing.column])
          .select('*')
          .single()
      );

      if (updateResult.error || !updateResult.data) {
        console.error('Error approving petty cash request:', updateResult.error);
        return false;
      }

      await this.logAction({
        preschoolId: String(
          updateResult.data.school_id ||
          updateResult.data.preschool_id ||
          existing.data[existing.column] ||
          '',
        ),
        entityType: 'petty_cash_request',
        entityId: requestId,
        performedBy: approvedBy,
        performerName: approverName,
        performerRole: 'principal_admin',
        action: 'approve',
        previousStatus: String(existing.data.status || 'pending'),
        newStatus: 'approved',
        notes: approvalNotes,
      });

      const profiles = await this.loadProfilesForCreators([String(updateResult.data.created_by || '')]);
      const request = this.mapTransactionToRequest(updateResult.data, profiles, {
        approved_amount: finalApprovedAmount,
        approval_notes: approvalNotes,
      });

      await ApprovalNotificationService.notifyTeacherPettyCashApproved(request);
      return true;
    } catch (error) {
      console.error('Error in approvePettyCashRequest:', error);
      return false;
    }
  }

  /**
   * Reject a petty cash request
   */
  static async rejectPettyCashRequest(
    requestId: string,
    rejectedBy: string,
    rejectorName: string,
    rejectionReason: string,
    approvalNotes?: string
  ): Promise<boolean> {
    try {
      const existing = await this.getTransactionById(requestId);
      if (!existing) {
        console.error('Error fetching petty cash request:', requestId);
        return false;
      }

      const updateResult = await withPettyCashTenant((column, client) =>
        client
          .from('petty_cash_transactions')
          .update({
            status: 'rejected',
            approved_by: rejectedBy,
            updated_at: new Date().toISOString(),
          })
          .eq('id', requestId)
          .eq(column, existing.data[existing.column])
          .select('*')
          .single()
      );

      if (updateResult.error || !updateResult.data) {
        console.error('Error rejecting petty cash request:', updateResult.error);
        return false;
      }

      await this.logAction({
        preschoolId: String(
          updateResult.data.school_id ||
          updateResult.data.preschool_id ||
          existing.data[existing.column] ||
          '',
        ),
        entityType: 'petty_cash_request',
        entityId: requestId,
        performedBy: rejectedBy,
        performerName: rejectorName,
        performerRole: 'principal_admin',
        action: 'reject',
        previousStatus: String(existing.data.status || 'pending'),
        newStatus: 'rejected',
        notes: approvalNotes,
        reason: rejectionReason,
      });

      const profiles = await this.loadProfilesForCreators([String(updateResult.data.created_by || '')]);
      const request = this.mapTransactionToRequest(updateResult.data, profiles, {
        rejection_reason: rejectionReason,
        approval_notes: approvalNotes,
      });

      await ApprovalNotificationService.notifyTeacherPettyCashRejected(request);
      return true;
    } catch (error) {
      console.error('Error in rejectPettyCashRequest:', error);
      return false;
    }
  }

  /**
   * Mark petty cash as disbursed
   */
  static async disbursePettyCash(
    requestId: string,
    disbursedBy: string,
    disbursementMethod: 'cash' | 'bank_transfer' | 'petty_cash_float' = 'petty_cash_float'
  ): Promise<boolean> {
    try {
      const existing = await this.getTransactionById(requestId);
      if (!existing) {
        console.error('Error fetching petty cash request for disbursement:', requestId);
        return false;
      }

      const { error } = await withPettyCashTenant((column, client) =>
        client
          .from('petty_cash_transactions')
          .update({
            status: 'approved',
            approved_by: disbursedBy,
            updated_at: new Date().toISOString(),
            transaction_type: disbursementMethod,
          })
          .eq('id', requestId)
          .eq(column, existing.data[existing.column])
      );

      if (error) {
        console.error('Error disbursing petty cash:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error in disbursePettyCash:', error);
      return false;
    }
  }

  /**
   * Submit receipt for disbursed petty cash
   */
  static async submitReceipt(
    requestId: string,
    receiptImagePath: string,
    actualAmountSpent: number,
    changeAmount: number
  ): Promise<boolean> {
    try {
      const existing = await this.getTransactionById(requestId);
      if (!existing) {
        console.error('Error fetching petty cash request for receipt:', requestId);
        return false;
      }

      const nextAmount = Number.isFinite(actualAmountSpent)
        ? Math.abs(Number(actualAmountSpent || 0))
        : Math.abs(Number(existing.data.amount || 0));
      const receiptNote = Number.isFinite(changeAmount)
        ? ` | Change returned: ${Math.abs(Number(changeAmount || 0)).toFixed(2)}`
        : '';

      const { error } = await withPettyCashTenant((column, client) =>
        client
          .from('petty_cash_transactions')
          .update({
            receipt_url: receiptImagePath,
            amount: nextAmount,
            status: 'completed',
            description: `${existing.data.description || ''}${receiptNote}`.trim(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', requestId)
          .eq(column, existing.data[existing.column])
      );

      if (error) {
        console.error('Error submitting receipt:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error in submitReceipt:', error);
      return false;
    }
  }

  /**
   * Get overdue receipts
   */
  static async getOverdueReceipts(preschoolId: string): Promise<PettyCashRequest[]> {
    try {
      const { data, error } = await withPettyCashTenant((column, client) =>
        client
          .from('petty_cash_transactions')
          .select('*')
          .eq(column, preschoolId)
          .eq('type', 'expense')
          .eq('status', 'approved')
          .is('receipt_url', null)
          .order('transaction_date', { ascending: true })
      );

      if (error) {
        console.error('Error loading overdue receipts:', error);
        return [];
      }

      const rows = Array.isArray(data) ? data : [];
      const today = new Date();
      const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const overdueRows = rows.filter((row: any) => {
        const base = row?.transaction_date ? new Date(row.transaction_date) : new Date(row?.created_at || '');
        if (Number.isNaN(base.getTime())) return false;
        const deadline = new Date(base.getTime() + 7 * 24 * 60 * 60 * 1000);
        return deadline < todayStart;
      });

      const profiles = await this.loadProfilesForCreators(overdueRows.map((row: any) => String(row.created_by || '')));
      return overdueRows.map((row: any) => this.mapTransactionToRequest(row, profiles));
    } catch (error) {
      console.error('Error in getOverdueReceipts:', error);
      return [];
    }
  }

  /**
   * Log approval action for audit trail
   */
  private static async logAction(params: ApprovalActionParams): Promise<void> {
    await writeApprovalAuditLog(params);
  }
}
