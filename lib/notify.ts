import { assertSupabase } from '@/lib/supabase'

export type NotifyRole = 'principal' | 'principal_admin' | 'superadmin' | 'teacher' | 'parent'

async function dispatch(event_type: string, payload: any) {
  const { data, error } = await assertSupabase().functions.invoke('notifications-dispatcher', {
    body: { event_type, ...payload } as any,
  })
  if (error) throw error
  return data
}

export async function notifySeatRequestCreated(preschool_id: string, requester_email?: string) {
  return dispatch('seat_request_created', {
    preschool_id,
    role_targets: ['principal', 'principal_admin', 'superadmin'] as NotifyRole[],
    include_email: true,
    custom_payload: { requester_email },
  })
}

export async function notifySeatRequestApproved(user_id: string) {
  return dispatch('seat_request_approved', {
    user_ids: [user_id],
    include_email: true,
  })
}

export async function notifySubscriptionCreated(preschool_id: string, plan_tier: string) {
  return dispatch('subscription_created', {
    preschool_id,
    plan_tier,
    role_targets: ['principal', 'principal_admin', 'superadmin'] as NotifyRole[],
    include_email: true,
  })
}

export async function notifyPaymentSuccessSchool(preschool_id: string, plan_tier?: string, amount?: string) {
  return dispatch('payment_success', {
    preschool_id,
    plan_tier,
    custom_payload: { amount },
    role_targets: ['principal', 'principal_admin', 'superadmin'] as NotifyRole[],
    include_email: true,
  })
}

export async function notifyPaymentSuccessUser(user_id: string, plan_tier?: string, amount?: string) {
  return dispatch('payment_success', {
    user_ids: [user_id],
    plan_tier,
    custom_payload: { amount },
    include_email: true,
  })
}

export async function notifyTrialStarted(preschool_id: string, plan_tier: string, trial_end_date?: string) {
  return dispatch('trial_started', {
    preschool_id,
    plan_tier,
    custom_payload: { trial_end_date },
    role_targets: ['principal', 'principal_admin', 'superadmin'] as NotifyRole[],
    include_email: true,
  })
}

export async function notifyPaymentRequired(preschool_id: string, subscription_id: string, plan_tier: string, amount: number) {
  return dispatch('payment_required', {
    preschool_id,
    subscription_id,
    plan_tier,
    custom_payload: { 
      amount,
      payment_url: `${process.env.EXPO_PUBLIC_WEB_URL || 'https://app.edudashpro.com'}/payment/checkout/${subscription_id}`,
      message: `Payment required for ${plan_tier} plan upgrade (R${amount})` 
    },
    role_targets: ['principal', 'principal_admin'] as NotifyRole[],
    include_email: true,
    include_push: true,
  })
}

export async function notifySubscriptionPendingPayment(preschool_id: string, subscription_id: string, plan_name: string) {
  return dispatch('subscription_pending_payment', {
    preschool_id,
    subscription_id,
    custom_payload: { 
      plan_name,
      action_required: 'Complete payment to activate subscription',
      payment_deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days
    },
    role_targets: ['principal', 'principal_admin'] as NotifyRole[],
    include_email: true,
    include_push: true,
  })
}

export async function notifyBirthdayDonationPaid(
  user_id: string,
  payload: {
    payer_child_name?: string;
    birthday_child_name?: string;
    donation_amount?: number;
    donation_date?: string;
  }
) {
  return dispatch('birthday_donation_paid', {
    user_ids: [user_id],
    custom_payload: payload,
    include_push: true,
  })
}

export async function notifyBirthdayDonationReminder(
  user_ids: string[],
  payload: {
    child_name?: string;
    days_until?: number;
    donation_amount?: number;
    donation_date?: string;
    school_name?: string;
  }
) {
  return dispatch('birthday_donation_reminder', {
    user_ids,
    custom_payload: payload,
    include_push: true,
  })
}

// ============================================================================
// School Calendar Event Notifications
// ============================================================================

export type TargetAudience = 'all' | 'parents' | 'teachers' | 'students';

/**
 * Notify target audience about a new school event
 */
export async function notifySchoolEventCreated(
  event_id: string, 
  preschool_id: string, 
  target_audience: TargetAudience[] = ['all']
) {
  return dispatch('school_event_created', {
    event_id,
    preschool_id,
    target_audience,
  })
}

/**
 * Notify target audience about an updated school event
 */
export async function notifySchoolEventUpdated(
  event_id: string, 
  preschool_id: string, 
  target_audience: TargetAudience[] = ['all']
) {
  return dispatch('school_event_updated', {
    event_id,
    preschool_id,
    target_audience,
  })
}

/**
 * Notify target audience about a cancelled school event
 */
export async function notifySchoolEventCancelled(
  event_id: string, 
  preschool_id: string, 
  target_audience: TargetAudience[] = ['all']
) {
  return dispatch('school_event_cancelled', {
    event_id,
    preschool_id,
    target_audience,
  })
}

/**
 * Send reminder notification for upcoming school event
 */
export async function notifySchoolEventReminder(
  event_id: string, 
  preschool_id: string, 
  target_audience: TargetAudience[] = ['all']
) {
  return dispatch('school_event_reminder', {
    event_id,
    preschool_id,
    target_audience,
  })
}

// ============================================================================
// Registration Notifications
// ============================================================================

/**
 * Notify a parent/guardian that their child's registration has been approved.
 * Sends push notification (if parent has an account) + email to guardian.
 */
export async function notifyRegistrationApproved(params: {
  parentId?: string | null
  guardianEmail: string
  guardianName?: string
  childName: string
  schoolName: string
  registrationId: string
  studentId?: string
  preschoolId?: string
}) {
  const {
    parentId,
    guardianEmail,
    guardianName,
    childName,
    schoolName,
    registrationId,
    studentId,
    preschoolId,
  } = params

  const appUrl = process.env.EXPO_PUBLIC_WEB_URL || 'https://app.edudashpro.com'

  const emailHtml = `
    <div style="font-family: Arial, sans-serif; color: #0f172a; line-height: 1.7;">
      <h2 style="color: #16a34a; margin-bottom: 4px;">✅ Registration Approved</h2>
      <p>Dear ${guardianName || 'Parent'},</p>
      <p><strong>${childName}</strong>'s registration at <strong>${schoolName}</strong> has been approved!</p>
      <p>Here's what happens next:</p>
      <ul style="padding-left: 20px;">
        <li>Your child has been enrolled and is now active on the school system.</li>
        <li>You can track attendance, homework, and school updates from the EduDash Pro app.</li>
        <li>Your child's teacher will be in touch with class details.</li>
      </ul>
      <p style="margin: 24px 0;">
        <a href="${appUrl}" style="display: inline-block; background: #6d28d9; color: #ffffff; padding: 14px 24px; border-radius: 10px; text-decoration: none; font-weight: 700; font-size: 14px;">
          Open EduDash Pro
        </a>
      </p>
      <p style="font-size: 13px; color: #64748b;">If you haven't downloaded the app yet, search for <strong>EduDash Pro</strong> on the App Store or Google Play, or visit <a href="${appUrl}" style="color: #6d28d9;">${appUrl}</a>.</p>
      <p>Welcome to ${schoolName}! 🎉</p>
    </div>
  `

  return dispatch('child_registration_approved', {
    user_ids: parentId ? [parentId] : [],
    recipient_email: guardianEmail,
    registration_id: registrationId,
    student_id: studentId,
    child_name: childName,
    school_name: schoolName,
    preschool_id: preschoolId,
    include_email: true,
    email_template_override: {
      subject: `✅ ${childName}'s Registration Approved — ${schoolName}`,
      html: emailHtml,
      text: `${childName}'s registration at ${schoolName} has been approved! Open EduDash Pro to get started: ${appUrl}`,
    },
  })
}

/**
 * Notify a parent/guardian that their child's registration has been rejected.
 * Sends push notification (if parent has an account) + email to guardian.
 */
export async function notifyRegistrationRejected(params: {
  parentId?: string | null
  guardianEmail: string
  guardianName?: string
  childName: string
  schoolName: string
  registrationId: string
  rejectionReason: string
  preschoolId?: string
}) {
  const {
    parentId,
    guardianEmail,
    guardianName,
    childName,
    schoolName,
    registrationId,
    rejectionReason,
    preschoolId,
  } = params

  const emailHtml = `
    <div style="font-family: Arial, sans-serif; color: #0f172a; line-height: 1.7;">
      <h2 style="color: #dc2626; margin-bottom: 4px;">Registration Update</h2>
      <p>Dear ${guardianName || 'Parent'},</p>
      <p>We regret to inform you that <strong>${childName}</strong>'s registration at <strong>${schoolName}</strong> was not approved at this time.</p>
      ${rejectionReason ? `<p><strong>Reason:</strong> ${rejectionReason}</p>` : ''}
      <p>If you believe this is an error or have questions, please contact the school directly.</p>
      <p style="font-size: 13px; color: #64748b; margin-top: 16px;">This is an automated message from EduDash Pro.</p>
    </div>
  `

  return dispatch('child_registration_rejected', {
    user_ids: parentId ? [parentId] : [],
    recipient_email: guardianEmail,
    registration_id: registrationId,
    child_name: childName,
    school_name: schoolName,
    rejection_reason: rejectionReason,
    preschool_id: preschoolId,
    include_email: true,
    email_template_override: {
      subject: `Registration Update — ${childName} at ${schoolName}`,
      html: emailHtml,
      text: `${childName}'s registration at ${schoolName} was not approved. ${rejectionReason ? 'Reason: ' + rejectionReason : ''} Please contact the school for more information.`,
    },
  })
}
