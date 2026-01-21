// @ts-nocheck - Deno Edge Function with URL imports
/* eslint-disable @typescript-eslint/no-unused-vars */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

// Type definitions for Deno environment
declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
};

// Notification context type
interface NotificationContext {
  sender_name?: string;
  thread_id?: string;
  message_id?: string;
  message_preview?: string;
  announcement_title?: string;
  announcement_preview?: string;
  priority?: string;
  announcement_id?: string;
  assignment_title?: string;
  assignment_id?: string;
  submission_id?: string;
  student_id?: string;
  student_name?: string;
  subject?: string;
  due_text?: string;
  school_name?: string;
  plan_tier?: string;
  amount?: number;
  subscription_id?: string;
  payment_url?: string;
  message?: string;
  plan_name?: string;
  action_required?: string;
  payment_deadline?: string;
  trial_end_text?: string;
  requester_email?: string;
  report_id?: string;
  teacher_name?: string;
  rejection_reason?: string;
  invoice_id?: string;
  invoice_number?: string;
  total_amount?: number;
  due_date?: string;
  status?: string;
  overdue_days?: number;
  call_id?: string;
  caller_id?: string;
  caller_name?: string;
  call_type?: string;
  meeting_url?: string;
}

// Notification template type
interface NotificationTemplate {
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: string | null;
  badge?: number;
  priority?: string;
  channelId?: string;
  _contentAvailable?: boolean;
  categoryId?: string;
}

// Notification request type
interface NotificationRequest {
  event_type: string;
  user_ids?: string[];
  role_targets?: string[];
  preschool_id?: string;
  thread_id?: string;
  message_id?: string;
  announcement_id?: string;
  assignment_id?: string;
  student_id?: string;
  report_id?: string;
  invoice_id?: string;
  subscription_id?: string;
  plan_tier?: string;
  call_id?: string;
  caller_id?: string;
  caller_name?: string;
  call_type?: string;
  meeting_url?: string;
  rejection_reason?: string;
  custom_payload?: Record<string, unknown>;
  template_override?: Partial<NotificationTemplate>;
  send_immediately?: boolean;
  include_email?: boolean;
  test?: boolean;
  target_user_id?: string;
  channel?: string;
  email_template_override?: {
    subject?: string;
    text?: string;
    html?: string;
  };
}

// Push device type
interface PushDevice {
  user_id: string;
  expo_push_token: string;
  language?: string;
}

// Environment variables
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const EXPO_ACCESS_TOKEN = Deno.env.get('EXPO_ACCESS_TOKEN');

// Create Supabase client with service role for bypassing RLS
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

/**
 * Get notification template for different event types
 */
function getNotificationTemplate(eventType: string, context: NotificationContext = {}): NotificationTemplate {
  const templates: Record<string, NotificationTemplate> = {
    new_message: {
      title: "New Message",
      body: context.sender_name ? `${context.sender_name} sent you a message` : "You have a new message",
      data: {
        type: 'message',
        thread_id: context.thread_id,
        message_id: context.message_id,
        screen: 'messages'
      },
      sound: 'default',
      badge: 1,
      priority: 'high',
      channelId: 'messages'
    },
    new_announcement: {
      title: "School Announcement",
      body: context.announcement_title || "New announcement from your school",
      data: {
        type: 'announcement',
        announcement_id: context.announcement_id,
        screen: 'announcements'
      },
      sound: 'default',
      badge: 1,
      priority: 'high',
      channelId: 'announcements'
    },
    homework_graded: {
      title: "Homework Graded",
      body: context.assignment_title ? `${context.assignment_title} has been graded` : "Your child's homework has been graded",
      data: {
        type: 'homework',
        assignment_id: context.assignment_id,
        submission_id: context.submission_id,
        student_id: context.student_id,
        screen: 'homework-details'
      },
      sound: 'default',
      badge: 1,
      priority: 'normal',
      channelId: 'homework'
    },
    assignment_due_soon: {
      title: "Assignment Due Soon",
      body: context.assignment_title ? `${context.assignment_title} is due ${context.due_text || 'soon'}` : "You have an assignment due soon",
      data: {
        type: 'homework',
        assignment_id: context.assignment_id,
        screen: 'homework-submit'
      },
      sound: 'default',
      priority: 'normal',
      channelId: 'homework'
    },
    progress_update: {
      title: "Progress Update",
      body: context.student_name ? `${context.student_name}'s progress report is ready` : "New progress update available",
      data: {
        type: 'progress',
        student_id: context.student_id,
        screen: 'progress'
      },
      sound: 'default',
      priority: 'normal',
      channelId: 'progress'
    },
    whatsapp_opt_in: {
      title: "WhatsApp Integration",
      body: "Connect with your school via WhatsApp for instant updates",
      data: {
        type: 'whatsapp',
        action: 'opt_in',
        screen: 'dashboard'
      },
      sound: 'default',
      priority: 'normal',
      channelId: 'general'
    },
    subscription_created: {
      title: 'Subscription Created',
      body: context.school_name ? `A ${context.plan_tier || 'plan'} subscription was created for ${context.school_name}` : `A ${context.plan_tier || 'plan'} subscription was created`,
      data: {
        type: 'billing',
        screen: 'subscriptions',
        plan_tier: context.plan_tier
      },
      sound: 'default',
      priority: 'high',
      channelId: 'billing'
    },
    payment_success: {
      title: 'Payment Successful',
      body: context.amount ? `Payment received (${context.amount}). Subscription active.` : 'Payment received. Subscription active.',
      data: {
        type: 'billing',
        screen: 'subscriptions',
        plan_tier: context.plan_tier
      },
      sound: 'default',
      priority: 'high',
      channelId: 'billing'
    },
    trial_started: {
      title: 'Trial Started',
      body: context.trial_end_text ? `Your ${context.plan_tier || 'plan'} trial started. Ends ${context.trial_end_text}.` : `Your ${context.plan_tier || 'plan'} trial has started.`,
      data: {
        type: 'billing',
        screen: 'subscriptions'
      },
      sound: 'default',
      priority: 'normal',
      channelId: 'billing'
    },
    trial_ending: {
      title: 'Trial Ending Soon',
      body: context.trial_end_text ? `Your trial ends ${context.trial_end_text}. Add payment to continue.` : 'Your trial ends soon. Add payment to continue.',
      data: {
        type: 'billing',
        screen: 'subscriptions'
      },
      sound: 'default',
      priority: 'high',
      channelId: 'billing'
    },
    trial_ended: {
      title: 'Trial Ended',
      body: 'Your trial period has ended. Upgrade to regain premium features.',
      data: {
        type: 'billing',
        screen: 'subscriptions'
      },
      sound: 'default',
      priority: 'high',
      channelId: 'billing'
    },
    seat_request_created: {
      title: 'Seat Request',
      body: context.requester_email ? `${context.requester_email} requested a teacher seat` : 'A teacher requested a seat',
      data: {
        type: 'seats',
        screen: 'seat-management'
      },
      sound: 'default',
      priority: 'high',
      channelId: 'admin'
    },
    seat_request_approved: {
      title: 'Seat Approved',
      body: 'Your teacher seat has been approved. You now have full access.',
      data: {
        type: 'seats',
        screen: 'dashboard'
      },
      sound: 'default',
      priority: 'high',
      channelId: 'admin'
    },
    payment_required: {
      title: 'Payment Required',
      body: context.message || `Payment required for ${context.plan_tier || 'plan'} upgrade`,
      data: {
        type: 'billing',
        screen: 'payment-checkout',
        subscription_id: context.subscription_id,
        payment_url: context.payment_url
      },
      sound: 'default',
      priority: 'high',
      channelId: 'billing'
    },
    subscription_pending_payment: {
      title: 'Payment Pending',
      body: context.action_required || `Complete payment for ${context.plan_name || 'your subscription'}`,
      data: {
        type: 'billing',
        screen: 'payment-checkout',
        subscription_id: context.subscription_id
      },
      sound: 'default',
      priority: 'high',
      channelId: 'billing'
    },
    new_invoice: {
      title: 'New Invoice',
      body: context.invoice_number ? `Invoice ${context.invoice_number} has been created` : 'A new invoice has been created for you',
      data: {
        type: 'invoice',
        invoice_id: context.invoice_id,
        screen: 'invoice-details'
      },
      sound: 'default',
      priority: 'normal',
      channelId: 'invoices'
    },
    invoice_sent: {
      title: 'Invoice Sent',
      body: context.invoice_number ? `Invoice ${context.invoice_number} has been sent` : 'Your invoice has been sent',
      data: {
        type: 'invoice',
        invoice_id: context.invoice_id,
        screen: 'invoice-details'
      },
      sound: 'default',
      priority: 'normal',
      channelId: 'invoices'
    },
    overdue_reminder: {
      title: 'Invoice Overdue',
      body: context.invoice_number ? `Invoice ${context.invoice_number} is overdue - please pay to avoid late fees` : 'You have an overdue invoice - please pay to avoid late fees',
      data: {
        type: 'invoice',
        invoice_id: context.invoice_id,
        screen: 'invoice-details'
      },
      sound: 'default',
      priority: 'high',
      channelId: 'invoices'
    },
    payment_confirmed: {
      title: 'Payment Received',
      body: context.invoice_number ? `Payment received for Invoice ${context.invoice_number} - thank you!` : 'Payment received - thank you!',
      data: {
        type: 'invoice',
        invoice_id: context.invoice_id,
        screen: 'invoice-details'
      },
      sound: 'default',
      priority: 'normal',
      channelId: 'invoices'
    },
    invoice_viewed: {
      title: 'Invoice Viewed',
      body: context.invoice_number ? `Invoice ${context.invoice_number} was viewed` : 'Your invoice was viewed',
      data: {
        type: 'invoice',
        invoice_id: context.invoice_id,
        screen: 'invoice-details'
      },
      sound: null,
      priority: 'normal',
      channelId: 'invoices'
    },
    report_submitted_for_review: {
      title: 'Progress Report Submitted',
      body: context.student_name && context.teacher_name ? `${context.teacher_name} submitted a progress report for ${context.student_name}` : 'A progress report has been submitted for review',
      data: {
        type: 'report',
        report_id: context.report_id,
        student_id: context.student_id,
        screen: 'principal-report-review'
      },
      sound: 'default',
      priority: 'high',
      channelId: 'reports'
    },
    report_approved: {
      title: 'Progress Report Approved',
      body: context.student_name ? `Your progress report for ${context.student_name} has been approved` : 'Your progress report has been approved',
      data: {
        type: 'report',
        report_id: context.report_id,
        student_id: context.student_id,
        screen: 'progress-report-creator'
      },
      sound: 'default',
      priority: 'normal',
      channelId: 'reports'
    },
    report_rejected: {
      title: 'Progress Report Needs Revision',
      body: context.student_name && context.rejection_reason ? `Report for ${context.student_name} needs revision: ${context.rejection_reason}` : context.rejection_reason || 'Your progress report needs revision',
      data: {
        type: 'report',
        report_id: context.report_id,
        student_id: context.student_id,
        rejection_reason: context.rejection_reason,
        screen: 'progress-report-creator'
      },
      sound: 'default',
      priority: 'high',
      channelId: 'reports'
    },
    incoming_call: {
      title: context.call_type === 'video' ? '📹 Incoming Video Call' : '📞 Incoming Voice Call',
      body: context.caller_name ? `${context.caller_name} is calling...` : 'Incoming call...',
      data: {
        type: 'incoming_call',
        call_id: context.call_id,
        caller_id: context.caller_id,
        caller_name: context.caller_name,
        call_type: context.call_type || 'voice',
        meeting_url: context.meeting_url,
        screen: 'incoming-call'
      },
      sound: 'default',
      badge: 1,
      priority: 'high',
      channelId: 'incoming-calls',
      _contentAvailable: true,
      categoryId: 'incoming_call'
    },
    lesson_assigned: {
      title: '📚 New Lesson Assigned',
      body: context.student_name 
        ? `${context.student_name} has been assigned: ${context.assignment_title || 'a new lesson'}` 
        : `Your child has been assigned: ${context.assignment_title || 'a new lesson'}`,
      data: {
        type: 'lesson_assignment',
        assignment_id: context.assignment_id,
        student_id: context.student_id,
        screen: 'lesson-detail'
      },
      sound: 'default',
      badge: 1,
      priority: 'normal',
      channelId: 'homework'
    },
    // School calendar events
    school_event_created: {
      title: '📅 New School Event',
      body: context.event_title 
        ? `${context.event_title}${context.event_date ? ` on ${context.event_date}` : ''}`
        : 'A new school event has been scheduled',
      data: {
        type: 'school_event',
        event_id: context.event_id,
        event_type: context.event_type,
        screen: 'calendar'
      },
      sound: 'default',
      badge: 1,
      priority: 'normal',
      channelId: 'calendar'
    },
    school_event_reminder: {
      title: '🔔 Event Reminder',
      body: context.event_title 
        ? `Reminder: ${context.event_title}${context.event_date ? ` is ${context.event_date}` : ' is coming up'}`
        : 'You have an upcoming school event',
      data: {
        type: 'school_event_reminder',
        event_id: context.event_id,
        event_type: context.event_type,
        screen: 'calendar'
      },
      sound: 'default',
      badge: 1,
      priority: 'high',
      channelId: 'calendar'
    },
    school_event_updated: {
      title: '📅 Event Updated',
      body: context.event_title 
        ? `${context.event_title} has been updated`
        : 'A school event has been updated',
      data: {
        type: 'school_event',
        event_id: context.event_id,
        event_type: context.event_type,
        screen: 'calendar'
      },
      sound: 'default',
      priority: 'normal',
      channelId: 'calendar'
    },
    school_event_cancelled: {
      title: '❌ Event Cancelled',
      body: context.event_title 
        ? `${context.event_title} has been cancelled`
        : 'A school event has been cancelled',
      data: {
        type: 'school_event',
        event_id: context.event_id,
        event_type: context.event_type,
        screen: 'calendar'
      },
      sound: 'default',
      priority: 'high',
      channelId: 'calendar'
    }
  };

  return templates[eventType] || {
    title: "EduDash Pro",
    body: "You have a new notification",
    sound: 'default',
    priority: 'normal',
    channelId: 'general'
  };
}

/**
 * Get push tokens for users
 */
async function getPushTokensForUsers(userIds: string[]): Promise<PushDevice[]> {
  const { data, error } = await supabase
    .from('push_devices')
    .select('user_id, expo_push_token, language')
    .in('user_id', userIds)
    .eq('is_active', true)
    .order('updated_at', { ascending: false });

  if (error) {
    console.error('Error fetching push tokens:', error);
    return [];
  }

  // Deduplicate by user_id (keeping the most recent)
  const uniqueTokens = new Map<string, PushDevice>();
  (data || []).forEach((device: PushDevice) => {
    if (!uniqueTokens.has(device.user_id)) {
      uniqueTokens.set(device.user_id, device);
    }
  });

  return Array.from(uniqueTokens.values());
}

/**
 * Get users to notify based on context
 */
async function getUsersToNotify(request: NotificationRequest): Promise<string[]> {
  if (request.user_ids && request.user_ids.length > 0) {
    return request.user_ids;
  }

  const userIds: string[] = [];

  // Role-based targeting within a preschool
  if (request.role_targets && request.role_targets.length > 0) {
    try {
      const roles = request.role_targets;

      if (roles.includes('superadmin')) {
        const { data: superAdmins } = await supabase
          .from('profiles')
          .select('id, role')
          .eq('role', 'superadmin')
          .eq('is_active', true);
        if (superAdmins) userIds.push(...superAdmins.map((r: { id: string }) => r.id));
      }

      const filteredRoles = roles.filter((r: string) => r !== 'superadmin');
      if (filteredRoles.length > 0 && request.preschool_id) {
        const { data: schoolUsers } = await supabase
          .from('profiles')
          .select('id, role')
          .eq('preschool_id', request.preschool_id)
          .in('role', filteredRoles)
          .eq('is_active', true);
        if (schoolUsers) userIds.push(...schoolUsers.map((r: { id: string }) => r.id));
      }
    } catch (e) {
      console.error('Role-based targeting failed:', e);
    }
  }

  // Get users based on event context
  switch (request.event_type) {
    case 'new_message':
      if (request.thread_id) {
        const { data: thread } = await supabase
          .from('message_threads')
          .select('parent_id, teacher_id')
          .eq('id', request.thread_id)
          .single();
        if (thread) {
          if (thread.parent_id) userIds.push(thread.parent_id);
          if (thread.teacher_id) userIds.push(thread.teacher_id);
        }
      }
      break;

    case 'new_announcement':
      if (request.preschool_id) {
        const { data: parents } = await supabase
          .from('profiles')
          .select('id')
          .eq('preschool_id', request.preschool_id)
          .eq('role', 'parent')
          .eq('is_active', true);
        if (parents) {
          userIds.push(...parents.map((p: { id: string }) => p.id));
        }
      }
      break;

    case 'homework_graded':
      if (request.student_id) {
        const { data: student } = await supabase
          .from('students')
          .select('parent_id, guardian_id')
          .eq('id', request.student_id)
          .single();
        if (student) {
          if (student.parent_id) userIds.push(student.parent_id);
          if (student.guardian_id) userIds.push(student.guardian_id);
        }
      }
      break;

    case 'assignment_due_soon':
      if (request.assignment_id) {
        const { data: assignment } = await supabase
          .from('homework_assignments')
          .select('class_id, preschool_id')
          .eq('id', request.assignment_id)
          .single();

        if (assignment) {
          const { data: students } = await supabase
            .from('students')
            .select('parent_id, guardian_id')
            .eq('class_id', assignment.class_id)
            .eq('is_active', true);

          if (students) {
            students.forEach((student: { parent_id?: string; guardian_id?: string }) => {
              if (student.parent_id) userIds.push(student.parent_id);
              if (student.guardian_id) userIds.push(student.guardian_id);
            });
          }
        }
      }
      break;

    case 'report_submitted_for_review':
      if (request.preschool_id) {
        const { data: principals } = await supabase
          .from('profiles')
          .select('id')
          .eq('preschool_id', request.preschool_id)
          .in('role', ['principal', 'principal_admin'])
          .eq('is_active', true);
        if (principals) {
          userIds.push(...principals.map((p: { id: string }) => p.id));
        }
      }
      break;

    case 'report_approved':
    case 'report_rejected':
      if (request.report_id) {
        const { data: report } = await supabase
          .from('progress_reports')
          .select('teacher_id')
          .eq('id', request.report_id)
          .single();
        if (report?.teacher_id) {
          userIds.push(report.teacher_id);
        }
      }
      break;

    case 'new_invoice':
    case 'invoice_sent':
    case 'overdue_reminder':
    case 'payment_confirmed':
    case 'invoice_viewed':
      if (request.invoice_id) {
        const { data: invoice } = await supabase
          .from('invoices')
          .select('preschool_id, created_by, bill_to_email, student_id')
          .eq('id', request.invoice_id)
          .single();

        if (invoice) {
          if (invoice.created_by && ['invoice_sent', 'payment_confirmed', 'invoice_viewed'].includes(request.event_type)) {
            userIds.push(invoice.created_by);
          }

          if (invoice.student_id) {
            const { data: student } = await supabase
              .from('students')
              .select('parent_id, guardian_id')
              .eq('id', invoice.student_id)
              .single();
            if (student) {
              if (student.parent_id) userIds.push(student.parent_id);
              if (student.guardian_id) userIds.push(student.guardian_id);
            }
          } else if (invoice.bill_to_email) {
            const { data: billToUser } = await supabase
              .from('profiles')
              .select('id')
              .eq('email', invoice.bill_to_email)
              .eq('preschool_id', invoice.preschool_id)
              .single();
            if (billToUser) {
              userIds.push(billToUser.id);
            }
          }

          if (invoice.preschool_id) {
            const { data: principals } = await supabase
              .from('profiles')
              .select('id')
              .eq('preschool_id', invoice.preschool_id)
              .in('role', ['principal', 'principal_admin'])
              .eq('is_active', true);
            if (principals) {
              userIds.push(...principals.map((p: { id: string }) => p.id));
            }
          }
        }
      }
      break;

    case 'lesson_assigned':
      // Notify the parent(s) of the student who was assigned a lesson
      if (request.student_id) {
        const { data: student } = await supabase
          .from('students')
          .select('parent_id, guardian_id')
          .eq('id', request.student_id)
          .single();
        if (student) {
          if (student.parent_id) userIds.push(student.parent_id);
          if (student.guardian_id) userIds.push(student.guardian_id);
        }
      }
      break;
  }

  return [...new Set(userIds.filter(Boolean))];
}

/**
 * Get notification context for template rendering
 */
async function getNotificationContext(request: NotificationRequest): Promise<NotificationContext> {
  const context: NotificationContext = {};

  try {
    switch (request.event_type) {
      case 'new_message':
        if (request.message_id) {
          const { data: message } = await supabase
            .from('messages')
            .select(`
              *,
              sender:sender_id(first_name, last_name),
              thread:message_threads(*)
            `)
            .eq('id', request.message_id)
            .single();

          if (message) {
            context.sender_name = message.sender ? `${message.sender.first_name} ${message.sender.last_name}` : 'Unknown';
            context.thread_id = message.thread_id;
            context.message_id = message.id;
            context.message_preview = message.content?.substring(0, 50) + (message.content?.length > 50 ? '...' : '');
          }
        }
        break;

      case 'new_announcement':
        if (request.announcement_id) {
          const { data: announcement } = await supabase
            .from('announcements')
            .select('title, content, priority')
            .eq('id', request.announcement_id)
            .single();

          if (announcement) {
            context.announcement_title = announcement.title;
            context.announcement_preview = announcement.content?.substring(0, 100);
            context.priority = announcement.priority;
            context.announcement_id = request.announcement_id;
          }
        }
        break;

      case 'homework_graded':
        if (request.assignment_id) {
          const { data: assignment } = await supabase
            .from('homework_assignments')
            .select('title, subject')
            .eq('id', request.assignment_id)
            .single();

          if (assignment) {
            context.assignment_title = assignment.title;
            context.subject = assignment.subject;
            context.assignment_id = request.assignment_id;
          }
        }
        if (request.student_id) {
          const { data: student } = await supabase
            .from('students')
            .select('first_name, last_name')
            .eq('id', request.student_id)
            .single();

          if (student) {
            context.student_name = `${student.first_name} ${student.last_name}`;
            context.student_id = request.student_id;
          }
        }
        break;

      case 'assignment_due_soon': {
        if (request.assignment_id) {
          const { data: assignment } = await supabase
            .from('homework_assignments')
            .select('title, due_date, subject')
            .eq('id', request.assignment_id)
            .single();

          if (assignment) {
            context.assignment_title = assignment.title;
            context.subject = assignment.subject;
            context.assignment_id = request.assignment_id;

            const dueDate = new Date(assignment.due_date);
            const now = new Date();
            const diffHours = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60));

            if (diffHours <= 24) {
              context.due_text = diffHours <= 1 ? 'in 1 hour' : `in ${diffHours} hours`;
            } else {
              const diffDays = Math.ceil(diffHours / 24);
              context.due_text = diffDays === 1 ? 'tomorrow' : `in ${diffDays} days`;
            }
          }
        }
        break;
      }

      case 'subscription_created': {
        if (request.preschool_id) {
          const { data: school } = await supabase
            .from('preschools')
            .select('name')
            .eq('id', request.preschool_id)
            .single();
          if (school) context.school_name = school.name;
        }
        context.plan_tier = request.plan_tier;
        break;
      }

      case 'payment_success': {
        if (request.preschool_id) {
          const { data: school } = await supabase
            .from('preschools')
            .select('name')
            .eq('id', request.preschool_id)
            .single();
          if (school) context.school_name = school.name;
        }
        context.plan_tier = request.plan_tier;
        context.amount = request.custom_payload?.amount as number | undefined;
        break;
      }

      case 'payment_required': {
        context.subscription_id = request.subscription_id;
        context.plan_tier = request.plan_tier;
        context.payment_url = request.custom_payload?.payment_url as string | undefined;
        context.amount = request.custom_payload?.amount as number | undefined;
        context.message = request.custom_payload?.message as string | undefined;
        break;
      }

      case 'subscription_pending_payment': {
        context.subscription_id = request.subscription_id;
        context.plan_name = request.custom_payload?.plan_name as string | undefined;
        context.action_required = request.custom_payload?.action_required as string | undefined;
        context.payment_deadline = request.custom_payload?.payment_deadline as string | undefined;
        break;
      }

      case 'trial_started':
      case 'trial_ending':
      case 'trial_ended': {
        if (request.preschool_id) {
          const { data: school } = await supabase
            .from('preschools')
            .select('name')
            .eq('id', request.preschool_id)
            .single();
          if (school) context.school_name = school.name;
        }
        context.plan_tier = request.plan_tier;
        if (request.custom_payload?.trial_end_date) {
          const end = new Date(request.custom_payload.trial_end_date as string);
          const now = new Date();
          const diffDays = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          context.trial_end_text = diffDays <= 0 ? 'today' : diffDays === 1 ? 'tomorrow' : `in ${diffDays} days`;
        }
        break;
      }

      case 'seat_request_created': {
        context.requester_email = request.custom_payload?.requester_email as string | undefined;
        break;
      }

      case 'seat_request_approved':
        break;

      case 'report_submitted_for_review':
      case 'report_approved':
      case 'report_rejected':
        if (request.report_id) {
          const { data: report } = await supabase
            .from('progress_reports')
            .select(`
              id,
              student:students(first_name, last_name),
              teacher:teacher_id(first_name, last_name)
            `)
            .eq('id', request.report_id)
            .single();

          if (report) {
            context.report_id = report.id;
            if (report.student) {
              context.student_name = `${report.student.first_name} ${report.student.last_name}`;
              context.student_id = request.student_id;
            }
            if (report.teacher) {
              context.teacher_name = `${report.teacher.first_name} ${report.teacher.last_name}`;
            }
            if (request.event_type === 'report_rejected') {
              context.rejection_reason = request.rejection_reason;
            }
          }
        }
        break;

      case 'new_invoice':
      case 'invoice_sent':
      case 'overdue_reminder':
      case 'payment_confirmed':
      case 'invoice_viewed':
        if (request.invoice_id) {
          const { data: invoice } = await supabase
            .from('invoices')
            .select(`
              id,
              invoice_number,
              total_amount,
              due_date,
              status,
              student:students(first_name, last_name),
              preschool:preschools(name)
            `)
            .eq('id', request.invoice_id)
            .single();

          if (invoice) {
            context.invoice_id = invoice.id;
            context.invoice_number = invoice.invoice_number;
            context.total_amount = invoice.total_amount;
            context.due_date = invoice.due_date;
            context.status = invoice.status;

            if (invoice.student) {
              context.student_name = `${invoice.student.first_name} ${invoice.student.last_name}`;
            }
            if (invoice.preschool) {
              context.school_name = invoice.preschool.name;
            }

            if (request.event_type === 'overdue_reminder' && invoice.due_date) {
              const dueDate = new Date(invoice.due_date);
              const now = new Date();
              const diffDays = Math.ceil((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
              context.overdue_days = diffDays > 0 ? diffDays : 0;
            }
          }
        }
        break;

      case 'incoming_call':
        context.call_id = request.call_id;
        context.caller_id = request.caller_id;
        context.caller_name = request.caller_name;
        context.call_type = request.call_type || 'voice';
        context.meeting_url = request.meeting_url;
        break;

      case 'lesson_assigned':
        // Get assignment and student details for notification
        if (request.assignment_id) {
          const { data: assignment } = await supabase
            .from('lesson_assignments')
            .select(`
              id,
              lesson:lessons(id, title, subject),
              student:students(id, first_name, last_name)
            `)
            .eq('id', request.assignment_id)
            .single();

          if (assignment) {
            context.assignment_id = assignment.id;
            if (assignment.lesson) {
              context.assignment_title = assignment.lesson.title;
              context.subject = assignment.lesson.subject;
            }
            if (assignment.student) {
              context.student_id = assignment.student.id;
              context.student_name = `${assignment.student.first_name} ${assignment.student.last_name}`;
            }
          }
        } else if (request.student_id) {
          // Fallback to student_id if no assignment_id
          const { data: student } = await supabase
            .from('students')
            .select('id, first_name, last_name')
            .eq('id', request.student_id)
            .single();

          if (student) {
            context.student_id = student.id;
            context.student_name = `${student.first_name} ${student.last_name}`;
          }
        }
        break;
    }
  } catch (error) {
    console.error('Error getting notification context:', error);
  }

  return context;
}

interface ExpoNotificationPayload {
  to: string[];
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: string | null;
  badge?: number;
  priority?: string;
  channelId?: string;
  ttl?: number;
  _contentAvailable?: boolean;
  categoryId?: string;
}

interface ExpoResult {
  success?: boolean;
  data?: { id?: string };
  error?: string;
}

/**
 * Send push notification via Expo
 */
async function sendExpoNotification(notification: ExpoNotificationPayload): Promise<ExpoResult> {
  if (!EXPO_ACCESS_TOKEN) {
    console.warn('Expo access token not configured, skipping push notification');
    return { success: false, error: 'No Expo access token configured' };
  }

  console.log('Sending Expo notification:', {
    recipients: notification.to.length,
    title: notification.title
  });

  try {
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${EXPO_ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(notification)
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Expo push notification error:', error);
      throw new Error(`Expo API error: ${response.status} ${error}`);
    }

    const result = await response.json();
    console.log('Expo notification sent successfully:', result);
    return result;
  } catch (error) {
    console.error('Error sending Expo notification:', error);
    throw error;
  }
}

/**
 * Record notification in database
 */
async function recordNotification(
  userIds: string[],
  template: NotificationTemplate,
  request: NotificationRequest,
  expoResult?: ExpoResult
): Promise<void> {
  try {
    for (const userId of userIds) {
      await supabase.from('push_notifications').insert({
        recipient_user_id: userId,
        title: template.title,
        body: template.body,
        data: template.data,
        status: expoResult?.success === false ? 'failed' : 'sent',
        expo_receipt_id: expoResult?.data?.id,
        notification_type: request.event_type,
        preschool_id: request.preschool_id
      });
    }
  } catch (error) {
    console.error('Error recording notification:', error);
  }
}

/**
 * Track analytics events for notifications
 */
async function trackAnalyticsEvent(eventName: string, properties: Record<string, unknown>): Promise<void> {
  try {
    console.log(`Analytics: ${eventName}`, properties);
  } catch (error) {
    console.error('Error tracking analytics event:', error);
  }
}

/**
 * Enhanced email sending with signature support
 */
async function sendEnhancedEmailNotification(
  userIds: string[],
  subject: string,
  body: string,
  _eventType: string
): Promise<void> {
  const emails = await getEmailsForUsers(userIds);
  if (emails.length === 0) return;

  const emailsWithSignatures: Array<{ email: string; signature: string | null }> = [];
  for (let i = 0; i < Math.min(userIds.length, emails.length); i++) {
    const userId = userIds[i];
    const email = emails[i];
    const signature = await getUserSignature(userId);
    emailsWithSignatures.push({ email, signature });
  }

  const firstSignature = emailsWithSignatures.find((e) => e.signature)?.signature;
  const emailHtml = `<p>${body}</p>${firstSignature ? `<br><img src="${firstSignature}" alt="Signature" style="max-width: 200px; height: auto;">` : ''}`;

  await sendEmailNotification(emails, subject, emailHtml, body);
}

/**
 * Track notification engagement event
 */
async function trackNotificationEvent(userIds: string[], request: NotificationRequest): Promise<void> {
  try {
    for (const userId of userIds) {
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('preschool_id')
          .eq('id', userId)
          .single();

        if (profile) {
          await supabase.from('parent_engagement_events').insert({
            preschool_id: profile.preschool_id,
            parent_id: userId,
            event_type: 'notification_sent',
            metadata: {
              notification_type: request.event_type,
              context: {
                thread_id: request.thread_id,
                message_id: request.message_id,
                announcement_id: request.announcement_id,
                assignment_id: request.assignment_id,
                student_id: request.student_id
              }
            }
          });
        }
      } catch {
        // ignore
      }
    }
  } catch (error) {
    console.error('Error tracking notification event:', error);
  }
}

/**
 * Filter users based on their notification preferences for invoice events
 */
async function filterUsersByPreferences(
  userIds: string[],
  eventType: string,
  channel: string = 'email'
): Promise<string[]> {
  if (![
    'new_invoice',
    'invoice_sent',
    'overdue_reminder',
    'payment_confirmed',
    'invoice_viewed',
    'payment_required',
    'subscription_pending_payment'
  ].includes(eventType)) {
    return userIds;
  }

  const filteredUsers: string[] = [];

  try {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, invoice_notification_preferences')
      .in('id', userIds);

    if (profiles) {
      for (const profile of profiles) {
        const prefs = profile.invoice_notification_preferences || {};
        const channelEnabled = prefs.channels?.[channel] !== false;
        const eventEnabled = prefs.events?.[eventType]?.[channel] !== false;

        if (channelEnabled && eventEnabled) {
          filteredUsers.push(profile.id);
        }
      }
    }
  } catch (error) {
    console.error('Error filtering users by preferences:', error);
    return userIds;
  }

  return filteredUsers;
}

/**
 * Get signature for a user if they have email_include_signature enabled
 */
async function getUserSignature(userId: string): Promise<string | null> {
  try {
    const { data: profile } = await supabase
      .from('profiles')
      .select('invoice_notification_preferences, signature_public_id')
      .eq('id', userId)
      .single();

    if (profile?.invoice_notification_preferences?.email_include_signature && profile.signature_public_id) {
      const { data: signedUrlData } = await supabase.storage
        .from('signatures')
        .createSignedUrl(profile.signature_public_id, 3600);

      return signedUrlData?.signedUrl || null;
    }
  } catch (error) {
    console.error('Error getting user signature:', error);
  }

  return null;
}

/**
 * Main notification dispatch handler
 */
async function dispatchNotification(request: Request): Promise<Response> {
  try {
    const notificationRequest: NotificationRequest = await request.json();
    console.log('Processing notification request:', notificationRequest);

    // Handle test notifications
    if (notificationRequest.test) {
      const targetUserId = notificationRequest.target_user_id;
      if (!targetUserId) {
        return new Response(
          JSON.stringify({ error: 'target_user_id required for test notifications' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      const context: NotificationContext = {
        invoice_number: 'TEST-001',
        invoice_id: 'test-invoice-id',
        total_amount: 150.00
      };

      const template = getNotificationTemplate(notificationRequest.event_type, context);

      if (notificationRequest.template_override) {
        Object.assign(template, notificationRequest.template_override);
      }

      const channel = notificationRequest.channel || 'email';

      if (channel === 'email') {
        const emails = await getEmailsForUsers([targetUserId]);
        if (emails.length > 0) {
          const signature = await getUserSignature(targetUserId);
          const emailHtml = `<p>${template.body}</p>${signature ? `<br><img src="${signature}" alt="Signature" style="max-width: 200px; height: auto;">` : ''}`;
          await sendEmailNotification(emails, `[TEST] ${template.title}`, emailHtml, template.body);
        }
      } else {
        const pushTokens = await getPushTokensForUsers([targetUserId]);
        if (pushTokens.length > 0) {
          await sendExpoNotification({
            to: pushTokens.map((t) => t.expo_push_token),
            title: `[TEST] ${template.title}`,
            body: template.body,
            data: template.data
          });
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          test: true,
          event_type: notificationRequest.event_type,
          channel: channel,
          recipients: 1
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const userIds = await getUsersToNotify(notificationRequest);

    if (userIds.length === 0) {
      await trackAnalyticsEvent('edudash.notifications.skipped', {
        event_type: notificationRequest.event_type,
        reason: 'no_recipients',
        count: 0
      });

      return new Response(
        JSON.stringify({ success: true, message: 'No users to notify', recipients: 0 }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const filteredUserIds = await filterUsersByPreferences(userIds, notificationRequest.event_type, 'email');

    if (filteredUserIds.length === 0) {
      await trackAnalyticsEvent('edudash.notifications.skipped', {
        event_type: notificationRequest.event_type,
        reason: 'disabled_by_preferences',
        count: userIds.length
      });

      return new Response(
        JSON.stringify({
          success: true,
          message: 'All users have disabled notifications for this event',
          recipients: 0,
          original_recipients: userIds.length
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const pushTokens = await getPushTokensForUsers(filteredUserIds);

    if (pushTokens.length === 0 && !notificationRequest.include_email) {
      await trackAnalyticsEvent('edudash.notifications.skipped', {
        event_type: notificationRequest.event_type,
        reason: 'no_push_tokens',
        count: filteredUserIds.length
      });

      return new Response(
        JSON.stringify({ success: true, message: 'No push tokens found for users', recipients: 0 }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const context = await getNotificationContext(notificationRequest);
    let template = getNotificationTemplate(notificationRequest.event_type, context);

    if (notificationRequest.template_override) {
      template = { ...template, ...notificationRequest.template_override };
    }

    const enhancedData = { ...template.data || {} };

    const expoNotifications: ExpoNotificationPayload[] = pushTokens.map((tokenInfo) => ({
      to: [tokenInfo.expo_push_token],
      title: template.title,
      body: template.body,
      data: {
        ...enhancedData,
        user_id: tokenInfo.user_id,
        recipient_id: tokenInfo.user_id,
        target_user_id: tokenInfo.user_id
      },
      sound: template.sound,
      badge: template.badge,
      priority: template.priority,
      channelId: template.channelId,
      ttl: 86400,
      ...(template._contentAvailable && { _contentAvailable: true }),
      ...(template.categoryId && { categoryId: template.categoryId })
    }));

    const expoResults: ExpoResult[] = [];

    if (notificationRequest.send_immediately !== false) {
      for (const notification of expoNotifications) {
        try {
          const result = await sendExpoNotification(notification);
          expoResults.push(result);
        } catch (error) {
          console.error('Failed to send notification to:', notification.to[0], error);
          expoResults.push({ success: false, error: String(error) });
        }
      }
    }

    const expoResult = expoResults.length > 0 ? expoResults[0] : undefined;
    await recordNotification(filteredUserIds, template, notificationRequest, expoResult);

    const isInvoiceEvent = [
      'new_invoice',
      'invoice_sent',
      'overdue_reminder',
      'payment_confirmed',
      'invoice_viewed',
      'payment_required',
      'subscription_pending_payment'
    ].includes(notificationRequest.event_type);

    if (isInvoiceEvent || notificationRequest.include_email) {
      try {
        await sendEnhancedEmailNotification(
          filteredUserIds,
          template.title,
          template.body,
          notificationRequest.event_type
        );
      } catch (emailError) {
        console.error('Error sending email notifications:', emailError);
      }
    }

    await trackAnalyticsEvent('edudash.notifications.sent', {
      event_type: notificationRequest.event_type,
      channel: isInvoiceEvent ? 'email' : 'push',
      recipients: filteredUserIds.length,
      success_count: pushTokens.length + (isInvoiceEvent ? filteredUserIds.length : 0),
      failure_count: 0
    });

    await trackNotificationEvent(filteredUserIds, notificationRequest);

    console.log(`Notification dispatched to ${pushTokens.length} devices and ${filteredUserIds.length} email recipients`);

    return new Response(
      JSON.stringify({
        success: true,
        recipients: pushTokens.length,
        email_recipients: isInvoiceEvent ? filteredUserIds.length : 0,
        user_count: filteredUserIds.length,
        original_user_count: userIds.length,
        event_type: notificationRequest.event_type,
        expo_result: expoResult,
        sent_immediately: notificationRequest.send_immediately !== false,
        preferences_filtered: userIds.length - filteredUserIds.length
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error dispatching notification:', error);
    return new Response(
      JSON.stringify({
        error: 'Failed to dispatch notification',
        details: (error as Error).message
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

interface DatabaseTriggerPayload {
  record: Record<string, unknown>;
  old_record?: Record<string, unknown>;
  type: string;
  table: string;
}

/**
 * Handle database triggers for automatic notifications
 */
async function handleDatabaseTrigger(request: Request): Promise<Response> {
  try {
    const { record, old_record, type, table }: DatabaseTriggerPayload = await request.json();
    console.log('Processing database trigger:', { type, table, record_id: record?.id });

    let notificationRequest: NotificationRequest | null = null;

    switch (table) {
      case 'messages':
        if (type === 'INSERT') {
          notificationRequest = {
            event_type: 'new_message',
            thread_id: record.thread_id as string,
            message_id: record.id as string,
            send_immediately: true
          };
        }
        break;

      case 'announcements':
        if (type === 'INSERT' && record.is_published) {
          notificationRequest = {
            event_type: 'new_announcement',
            preschool_id: record.preschool_id as string,
            announcement_id: record.id as string,
            send_immediately: true
          };
        }
        break;

      case 'homework_submissions':
        if (type === 'UPDATE' && record.status === 'graded' && old_record?.status !== 'graded') {
          notificationRequest = {
            event_type: 'homework_graded',
            student_id: record.student_id as string,
            assignment_id: record.assignment_id as string,
            send_immediately: true
          };
        }
        break;

      default:
        return new Response(
          JSON.stringify({ success: true, skipped: true }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
    }

    if (!notificationRequest) {
      return new Response(
        JSON.stringify({ success: true, skipped: true }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return await dispatchNotification(
      new Request('http://localhost', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(notificationRequest)
      })
    );
  } catch (error) {
    console.error('Error processing database trigger:', error);
    return new Response(
      JSON.stringify({
        error: 'Failed to process database trigger',
        details: (error as Error).message
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * Handle scheduled notifications (e.g., assignment reminders)
 */
async function handleScheduledNotifications(_request: Request): Promise<Response> {
  try {
    console.log('Running scheduled notification check');

    const now = new Date();
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    let trialsNotified = 0;

    try {
      const { data: trials } = await supabase
        .from('subscriptions')
        .select('id, school_id, plan_id, trial_end_date, status')
        .not('trial_end_date', 'is', null)
        .gte('trial_end_date', now.toISOString())
        .lte('trial_end_date', tomorrow.toISOString())
        .eq('status', 'active');

      if (trials) {
        for (const sub of trials) {
          try {
            const response = await dispatchNotification(
              new Request('http://localhost', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  event_type: 'trial_ending',
                  preschool_id: sub.school_id,
                  plan_tier: sub.plan_id,
                  role_targets: ['principal', 'principal_admin', 'superadmin'],
                  include_email: true,
                  custom_payload: { trial_end_date: sub.trial_end_date }
                })
              })
            );
            const result = await response.json();
            if (result.success) trialsNotified += result.recipients || 0;
          } catch (e) {
            console.error('Failed to notify trial ending', e);
          }
        }
      }
    } catch (e) {
      console.error('Trial ending query failed', e);
    }

    const { data: dueSoonAssignments } = await supabase
      .from('homework_assignments')
      .select('id, title, due_date, class_id, preschool_id')
      .gte('due_date', now.toISOString())
      .lte('due_date', tomorrow.toISOString())
      .eq('is_active', true);

    let notificationsSent = 0;

    if (dueSoonAssignments) {
      for (const assignment of dueSoonAssignments) {
        try {
          const response = await dispatchNotification(
            new Request('http://localhost', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                event_type: 'assignment_due_soon',
                assignment_id: assignment.id,
                preschool_id: assignment.preschool_id,
                send_immediately: true
              })
            })
          );
          const result = await response.json();
          if (result.success) {
            notificationsSent += result.recipients || 0;
          }
        } catch (error) {
          console.error(`Error sending due soon notification for assignment ${assignment.id}:`, error);
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        assignments_checked: dueSoonAssignments?.length || 0,
        notifications_sent: notificationsSent,
        trials_notified: trialsNotified
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error handling scheduled notifications:', error);
    return new Response(
      JSON.stringify({
        error: 'Failed to handle scheduled notifications',
        details: (error as Error).message
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * Main request handler
 */
async function handleRequest(request: Request): Promise<Response> {
  const url = new URL(request.url);

  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  if (url.pathname.includes('trigger')) {
    return await handleDatabaseTrigger(request);
  } else if (url.pathname.includes('scheduled')) {
    return await handleScheduledNotifications(request);
  } else {
    return await dispatchNotification(request);
  }
}

// Optional email support via Resend
async function getEmailsForUsers(userIds: string[]): Promise<string[]> {
  try {
    const { data } = await supabase
      .from('profiles')
      .select('id,email')
      .in('id', userIds);
    return (data || []).map((r: { email?: string }) => r.email).filter(Boolean) as string[];
  } catch (e) {
    console.error('Failed to fetch emails for users', e);
    return [];
  }
}

async function sendEmailNotification(
  to: string[],
  subject: string,
  html?: string,
  text?: string
): Promise<void> {
  try {
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    const EMAIL_FROM = Deno.env.get('EMAIL_FROM') || 'EduDash Pro <no-reply@edudashpro.org.za>';

    if (!RESEND_API_KEY) {
      console.warn('RESEND_API_KEY not configured; skipping email send');
      return;
    }

    const payload = {
      from: EMAIL_FROM,
      to,
      subject,
      html: html || undefined,
      text: text || undefined
    };

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      console.error('Resend API error', await res.text());
    }
  } catch (e) {
    console.error('Email send failed', e);
  }
}

// CORS configuration
const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': Deno.env.get('CORS_ALLOW_ORIGIN') || '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Vary': 'Origin'
};

// Start HTTP server with CORS handling and route dispatch
serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const res = await handleRequest(req);
    res.headers.set('Access-Control-Allow-Origin', corsHeaders['Access-Control-Allow-Origin']);
    res.headers.set('Access-Control-Allow-Headers', corsHeaders['Access-Control-Allow-Headers']);
    res.headers.set('Access-Control-Allow-Methods', corsHeaders['Access-Control-Allow-Methods']);
    res.headers.set('Vary', 'Origin');
    return res;
  } catch (error) {
    const res = new Response(
      JSON.stringify({
        error: 'Internal Server Error',
        details: (error as Error)?.message || String(error)
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
    res.headers.set('Access-Control-Allow-Origin', corsHeaders['Access-Control-Allow-Origin']);
    res.headers.set('Access-Control-Allow-Headers', corsHeaders['Access-Control-Allow-Headers']);
    res.headers.set('Access-Control-Allow-Methods', corsHeaders['Access-Control-Allow-Methods']);
    res.headers.set('Vary', 'Origin');
    return res;
  }
});
