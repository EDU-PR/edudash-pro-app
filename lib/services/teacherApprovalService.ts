/**
 * Teacher Approval Service
 * 
 * Handles the workflow for approving teachers after they accept an invitation.
 * Integrates with seat management to ensure proper teacher activation.
 */

import { assertSupabase } from '@/lib/supabase';

export interface PendingTeacher {
  id: string;
  user_id: string;
  preschool_id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone?: string;
  invite_id?: string;
  invite_accepted_at?: string;
  status: 'pending' | 'approved' | 'rejected' | 'withdrawn';
  requested_at: string;
  notes?: string;
  // Profile data
  profile?: {
    id: string;
    full_name?: string;
    avatar_url?: string;
    bio?: string;
    qualifications?: string[];
  };
}

export interface ApprovalResult {
  success: boolean;
  message: string;
  teacher_id?: string;
  seat_assigned?: boolean;
  error?: string;
}

export interface TeacherApprovalStats {
  pending: number;
  approved: number;
  rejected: number;
  total: number;
}

/**
 * Get pending teachers awaiting approval for a school
 */
export async function getPendingTeachers(preschoolId: string): Promise<PendingTeacher[]> {
  const supabase = assertSupabase();
  
  // First check teacher_approvals table
  const { data: approvals, error: approvalError } = await supabase
    .from('teacher_approvals')
    .select(`
      id,
      teacher_id,
      preschool_id,
      status,
      requested_at,
      notes,
      invite_id
    `)
    .eq('preschool_id', preschoolId)
    .eq('status', 'pending')
    .order('requested_at', { ascending: false });

  if (approvalError) {
    console.error('[TeacherApproval] Error fetching approvals:', approvalError);
    // Fallback to teacher_invites with accepted status
  }

  // Also check teacher_invites for accepted invites that need approval
  const { data: acceptedInvites, error: inviteError } = await supabase
    .from('teacher_invites')
    .select(`
      id,
      email,
      school_id,
      status,
      accepted_at,
      accepted_by
    `)
    .eq('school_id', preschoolId)
    .eq('status', 'accepted')
    .order('accepted_at', { ascending: false });

  if (inviteError) {
    console.error('[TeacherApproval] Error fetching invites:', inviteError);
  }

  // Combine and fetch profile data
  const pendingTeachers: PendingTeacher[] = [];
  
  // Process approvals
  if (approvals) {
    for (const approval of approvals) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, email, first_name, last_name, phone, full_name, avatar_url')
        .eq('id', approval.teacher_id)
        .single();
        
      if (profile) {
        pendingTeachers.push({
          id: approval.id,
          user_id: approval.teacher_id,
          preschool_id: approval.preschool_id,
          email: profile.email,
          first_name: profile.first_name || '',
          last_name: profile.last_name || '',
          phone: profile.phone,
          invite_id: approval.invite_id,
          status: approval.status,
          requested_at: approval.requested_at,
          notes: approval.notes,
          profile: {
            id: profile.id,
            full_name: profile.full_name,
            avatar_url: profile.avatar_url,
          },
        });
      }
    }
  }

  // Process accepted invites not yet in approvals
  if (acceptedInvites) {
    for (const invite of acceptedInvites) {
      // Check if already in pending list
      if (pendingTeachers.some(t => t.invite_id === invite.id)) continue;
      
      // Fetch profile by accepted_by or email
      let profile;
      if (invite.accepted_by) {
        const { data } = await supabase
          .from('profiles')
          .select('id, email, first_name, last_name, phone, full_name, avatar_url')
          .eq('id', invite.accepted_by)
          .single();
        profile = data;
      }
      
      if (!profile) {
        // Try by email
        const { data } = await supabase
          .from('profiles')
          .select('id, email, first_name, last_name, phone, full_name, avatar_url')
          .eq('email', invite.email.toLowerCase())
          .single();
        profile = data;
      }
      
      if (profile) {
        pendingTeachers.push({
          id: `invite-${invite.id}`,
          user_id: profile.id,
          preschool_id: invite.school_id,
          email: profile.email || invite.email,
          first_name: profile.first_name || '',
          last_name: profile.last_name || '',
          phone: profile.phone,
          invite_id: invite.id,
          invite_accepted_at: invite.accepted_at,
          status: 'pending',
          requested_at: invite.accepted_at,
          profile: {
            id: profile.id,
            full_name: profile.full_name,
            avatar_url: profile.avatar_url,
          },
        });
      }
    }
  }

  return pendingTeachers;
}

/**
 * Get approval stats for a school
 */
export async function getApprovalStats(preschoolId: string): Promise<TeacherApprovalStats> {
  const supabase = assertSupabase();
  
  const { data, error } = await supabase
    .from('teacher_approvals')
    .select('status')
    .eq('preschool_id', preschoolId);

  if (error) {
    console.error('[TeacherApproval] Error fetching stats:', error);
    return { pending: 0, approved: 0, rejected: 0, total: 0 };
  }

  const stats = {
    pending: 0,
    approved: 0,
    rejected: 0,
    total: data?.length || 0,
  };

  data?.forEach(item => {
    if (item.status === 'pending') stats.pending++;
    else if (item.status === 'approved') stats.approved++;
    else if (item.status === 'rejected') stats.rejected++;
  });

  return stats;
}

/**
 * Approve a pending teacher and assign seat
 */
export async function approveTeacher(
  teacherId: string,
  preschoolId: string,
  reviewerId: string,
  options?: {
    assignSeat?: boolean;
    notes?: string;
  }
): Promise<ApprovalResult> {
  const supabase = assertSupabase();
  
  try {
    // 1. Update teacher_approvals if exists
    const { data: existingApproval } = await supabase
      .from('teacher_approvals')
      .select('id')
      .eq('teacher_id', teacherId)
      .eq('preschool_id', preschoolId)
      .maybeSingle();

    if (existingApproval) {
      const { error: updateError } = await supabase
        .from('teacher_approvals')
        .update({
          status: 'approved',
          reviewed_by: reviewerId,
          reviewed_at: new Date().toISOString(),
          notes: options?.notes,
          seat_assigned: options?.assignSeat ?? true,
        })
        .eq('id', existingApproval.id);

      if (updateError) throw updateError;
    } else {
      // Create approval record
      const { error: insertError } = await supabase
        .from('teacher_approvals')
        .insert({
          teacher_id: teacherId,
          preschool_id: preschoolId,
          status: 'approved',
          reviewed_by: reviewerId,
          reviewed_at: new Date().toISOString(),
          notes: options?.notes,
          seat_assigned: options?.assignSeat ?? true,
        });

      if (insertError) throw insertError;
    }

    // 2. Update profile with teacher role and preschool
    const { error: profileError } = await supabase
      .from('profiles')
      .update({
        role: 'teacher',
        preschool_id: preschoolId,
        organization_id: preschoolId,
      })
      .eq('id', teacherId);

    if (profileError) {
      console.warn('[TeacherApproval] Profile update warning:', profileError);
    }

    // 3. Assign seat if requested
    let seatAssigned = false;
    if (options?.assignSeat !== false) {
      try {
        // Create or update organization_members entry with active seat
        const { error: memberError } = await supabase
          .from('organization_members')
          .upsert({
            organization_id: preschoolId,
            user_id: teacherId,
            role: 'teacher',
            seat_status: 'active',
            invited_by: reviewerId,
          }, {
            onConflict: 'organization_id,user_id',
          });

        if (!memberError) {
          seatAssigned = true;
        }
      } catch (seatError) {
        console.warn('[TeacherApproval] Seat assignment warning:', seatError);
      }
    }

    // 4. Update teacher_invites if applicable
    await supabase
      .from('teacher_invites')
      .update({ status: 'approved' })
      .eq('school_id', preschoolId)
      .eq('accepted_by', teacherId);

    return {
      success: true,
      message: seatAssigned 
        ? 'Teacher approved and seat assigned successfully'
        : 'Teacher approved (seat assignment pending)',
      teacher_id: teacherId,
      seat_assigned: seatAssigned,
    };

  } catch (error: any) {
    console.error('[TeacherApproval] Approval error:', error);
    return {
      success: false,
      message: 'Failed to approve teacher',
      error: error.message,
    };
  }
}

/**
 * Reject a pending teacher
 */
export async function rejectTeacher(
  teacherId: string,
  preschoolId: string,
  reviewerId: string,
  reason?: string
): Promise<ApprovalResult> {
  const supabase = assertSupabase();
  
  try {
    // Update teacher_approvals
    const { data: existingApproval } = await supabase
      .from('teacher_approvals')
      .select('id')
      .eq('teacher_id', teacherId)
      .eq('preschool_id', preschoolId)
      .maybeSingle();

    if (existingApproval) {
      const { error: updateError } = await supabase
        .from('teacher_approvals')
        .update({
          status: 'rejected',
          reviewed_by: reviewerId,
          reviewed_at: new Date().toISOString(),
          rejection_reason: reason,
        })
        .eq('id', existingApproval.id);

      if (updateError) throw updateError;
    } else {
      const { error: insertError } = await supabase
        .from('teacher_approvals')
        .insert({
          teacher_id: teacherId,
          preschool_id: preschoolId,
          status: 'rejected',
          reviewed_by: reviewerId,
          reviewed_at: new Date().toISOString(),
          rejection_reason: reason,
        });

      if (insertError) throw insertError;
    }

    // Update teacher_invites
    await supabase
      .from('teacher_invites')
      .update({ status: 'rejected' })
      .eq('school_id', preschoolId)
      .eq('accepted_by', teacherId);

    return {
      success: true,
      message: 'Teacher application rejected',
      teacher_id: teacherId,
    };

  } catch (error: any) {
    console.error('[TeacherApproval] Rejection error:', error);
    return {
      success: false,
      message: 'Failed to reject teacher',
      error: error.message,
    };
  }
}

/**
 * Create a pending approval record when teacher accepts invite
 */
export async function createPendingApproval(
  teacherId: string,
  preschoolId: string,
  inviteId?: string
): Promise<ApprovalResult> {
  const supabase = assertSupabase();
  
  try {
    const { error } = await supabase
      .from('teacher_approvals')
      .insert({
        teacher_id: teacherId,
        preschool_id: preschoolId,
        invite_id: inviteId,
        status: 'pending',
        requested_at: new Date().toISOString(),
      });

    if (error && error.code !== '23505') { // Ignore duplicate key error
      throw error;
    }

    return {
      success: true,
      message: 'Approval request created',
      teacher_id: teacherId,
    };

  } catch (error: any) {
    console.error('[TeacherApproval] Create approval error:', error);
    return {
      success: false,
      message: 'Failed to create approval request',
      error: error.message,
    };
  }
}
