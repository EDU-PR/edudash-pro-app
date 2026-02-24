import { useState, useCallback } from 'react';
import { assertSupabase } from '@/lib/supabase';
import type { DisplayRow } from './types';

interface UseUniformMessagingOptions {
  userId: string | undefined;
  schoolId: string | null;
  profile: any;
  showAlert: (opts: any) => void;
}

async function getOrCreateThread(userId: string, schoolId: string, payload: {
  studentId: string; parentId: string; subject: string;
}): Promise<string | null> {
  const supabase = assertSupabase();
  const { data } = await supabase
    .from('message_threads')
    .select('id, message_participants(user_id, role)')
    .eq('preschool_id', schoolId)
    .eq('type', 'parent-principal')
    .eq('student_id', payload.studentId);

  const threads = (data as any[] | null) || [];
  const existing = threads.find((thread) => {
    const ids = new Set(((thread.message_participants || []) as Array<{ user_id: string }>).map((p) => p.user_id));
    return ids.has(payload.parentId) && ids.has(userId);
  });
  if (existing?.id) return existing.id as string;

  const { data: created, error } = await supabase
    .from('message_threads')
    .insert({
      preschool_id: schoolId, created_by: userId, subject: payload.subject,
      type: 'parent-principal', student_id: payload.studentId, last_message_at: new Date().toISOString(),
    })
    .select('id').single();
  if (error) throw error;
  const threadId = created?.id as string;

  const { error: pErr } = await supabase.from('message_participants').insert([
    { thread_id: threadId, user_id: userId, role: 'principal' },
    { thread_id: threadId, user_id: payload.parentId, role: 'parent' },
  ]);
  if (pErr) throw pErr;
  return threadId;
}

async function sendPush(params: {
  threadId: string; messageId: string; senderId: string;
  senderName: string; messageContent: string; recipientIds: string[];
}) {
  const recipients = params.recipientIds.filter((id) => id && id !== params.senderId);
  if (!recipients.length) return;
  try {
    const supabase = assertSupabase();
    const { data: sess } = await supabase.auth.getSession();
    const token = sess?.session?.access_token;
    if (!token) return;
    const body = params.messageContent.length > 100 ? params.messageContent.substring(0, 97) + '...' : params.messageContent;
    await supabase.functions.invoke('notifications-dispatcher', {
      body: {
        event_type: 'new_message', user_ids: recipients,
        thread_id: params.threadId, message_id: params.messageId, send_immediately: true,
        custom_payload: { dedupe_by_user: true },
        template_override: {
          title: '\uD83D\uDCAC ' + params.senderName, body,
          data: { type: 'message', thread_id: params.threadId, message_id: params.messageId,
            sender_id: params.senderId, sender_name: params.senderName, screen: 'messages' },
        },
      },
      headers: { Authorization: 'Bearer ' + token },
    });
  } catch (err) {
    console.warn('[PrincipalUniforms] Push notification failed:', err);
  }
}

export function useUniformMessaging(opts: UseUniformMessagingOptions) {
  const { userId, schoolId, profile, showAlert } = opts;
  const [bulkMessaging, setBulkMessaging] = useState<null | 'missing' | 'unpaid' | 'no_order' | 'confirm_numbers'>(null);
  const [singleMessagingTargetId, setSingleMessagingTargetId] = useState<string | null>(null);

  const senderName = (profile as any)?.full_name
    || ((profile as any)?.first_name || '') + ' ' + ((profile as any)?.last_name || '').trim()
    || 'School';

  const sendBulk = useCallback(async (
    targets: DisplayRow[],
    type: 'missing' | 'unpaid' | 'no_order' | 'confirm_numbers',
    buildContent: (row: DisplayRow) => { content: string; subject: string },
  ) => {
    if (!userId || !schoolId || bulkMessaging) return;
    if (!targets.length) {
      showAlert({
        title:
          type === 'missing' || type === 'no_order'
            ? 'No Parents Found'
            : 'No Unpaid Orders',
        message:
          type === 'missing' || type === 'no_order'
            ? 'No parents with missing uniform orders have a linked contact.'
            : 'There are no unpaid uniform orders with a linked parent contact.',
        type: type === 'missing' || type === 'no_order' ? 'warning' : 'info',
        buttons: [{ text: 'OK' }],
      });
      return;
    }
    const label =
      type === 'missing' ? 'missing uniform sizes'
      : type === 'no_order' ? 'no uniform orders'
      : type === 'confirm_numbers' ? 'new T-shirt numbers to confirm'
      : 'unpaid uniform orders';
    showAlert({
      title:
        type === 'missing'
          ? 'Message Missing Sizes'
          : type === 'no_order'
            ? 'Message No-Order Parents'
            : type === 'confirm_numbers'
              ? 'Confirm T-shirt Numbers'
              : 'Message Unpaid Uniform Orders',
      message: 'Send an in-app message to ' + targets.length + ' parent(s) with ' + label + '?',
      type: 'warning',
      buttons: [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Send', onPress: async () => {
          setBulkMessaging(type);
          const supabase = assertSupabase();
          let sent = 0, failed = 0;
          for (const row of targets) {
            try {
              const { content, subject } = buildContent(row);
              const threadId = await getOrCreateThread(userId, schoolId, {
                studentId: row.studentId, parentId: row.parentId, subject,
              });
              if (!threadId) { failed++; continue; }
              const { data: msg, error } = await supabase.from('messages')
                .insert({ thread_id: threadId, sender_id: userId, content, content_type: 'text' })
                .select('id, content').single();
              if (error) throw error;
              await sendPush({
                threadId, messageId: msg.id, senderId: userId,
                senderName, messageContent: msg.content, recipientIds: [row.parentId],
              });
              sent++;
            } catch { failed++; }
          }
          setBulkMessaging(null);
          showAlert({
            title: 'Bulk Message Complete',
            message: failed ? 'Sent ' + sent + ' message(s). Failed: ' + failed + '.' : 'Sent ' + sent + ' message(s).',
            type: failed ? 'warning' : 'success',
            buttons: [{ text: 'OK' }],
          });
        }},
      ],
    });
  }, [userId, schoolId, bulkMessaging, senderName, showAlert]);

  const bulkMessageMissing = useCallback(async (missingRows: DisplayRow[]) => {
    const targets = missingRows.filter((r) => r.parentId);
    await sendBulk(targets, 'missing', (row) => {
      const codeLine = row.studentCode ? ' Student code: ' + row.studentCode + '.' : '';
      return {
        content: 'Hi ' + (row.parentName || 'Parent') + ', please submit ' + row.childName + "'s uniform size and quantities in the app." + codeLine + ' Thank you.',
        subject: 'Uniform Reminder \u2022 ' + row.childName,
      };
    });
  }, [sendBulk]);

  const bulkMessageUnpaid = useCallback(async (submittedRows: DisplayRow[]) => {
    const targets = submittedRows.filter((r) => r.paymentStatus === 'unpaid' && r.parentId);
    await sendBulk(targets, 'unpaid', (row) => {
      const codeLine = row.studentCode ? ' Student code: ' + row.studentCode + '.' : '';
      return {
        content: 'Hi ' + (row.parentName || 'Parent') + ", please complete uniform payment (or upload proof of payment) for " + row.childName + "'s uniform order in the app." + codeLine + ' Thank you.',
        subject: 'Uniform Payment \u2022 ' + row.childName,
      };
    });
  }, [sendBulk]);

  const bulkMessageNoOrder = useCallback(async (missingRows: DisplayRow[]) => {
    const targets = missingRows.filter((r) => r.parentId);
    await sendBulk(targets, 'no_order', (row) => {
      const codeLine = row.studentCode ? ' Student code: ' + row.studentCode + '.' : '';
      return {
        content:
          'Hi ' + (row.parentName || 'Parent') +
          ', we still need ' + row.childName +
          "'s uniform order. Please submit size, quantities, and select whether your child has a previous back number (or no number)." +
          codeLine + ' Thank you.',
        subject: 'Uniform Order Needed • ' + row.childName,
      };
    });
  }, [sendBulk]);

  const bulkMessageConfirmNumbers = useCallback(async (assignedRows: DisplayRow[]) => {
    const targets = assignedRows.filter((r) => r.parentId);
    await sendBulk(targets, 'confirm_numbers', (row) => {
      const codeLine = row.studentCode ? ' Student code: ' + row.studentCode + '.' : '';
      const numberLine = row.tshirtNumber ? ' Their current T-shirt number is ' + row.tshirtNumber + '.' : '';
      return {
        content:
          'Hi ' + (row.parentName || 'Parent') +
          ', we have assigned a uniform back number for ' + row.childName + '.' +
          numberLine +
          ' Please confirm that this number matches the shirt your child will use, or update the T-shirt number in the app if needed.' +
          codeLine + ' Thank you.',
        subject: 'Uniform Number • ' + row.childName,
      };
    });
  }, [sendBulk]);

  const messageSingleParent = useCallback(async (row: DisplayRow) => {
    if (!userId || !schoolId) return;
    if (!row.parentId) {
      showAlert({
        title: 'No Parent Linked',
        message: 'This learner does not have a linked parent contact yet.',
        type: 'warning',
        buttons: [{ text: 'OK' }],
      });
      return;
    }
    if (singleMessagingTargetId || bulkMessaging) return;

    const isMissingOrder = row.status === 'missing';
    const isOutstanding = !isMissingOrder && row.paymentStatus !== 'paid';
    const codeLine = row.studentCode ? ' Student code: ' + row.studentCode + '.' : '';
    const subject = isMissingOrder
      ? 'Uniform Order Needed • ' + row.childName
      : isOutstanding
        ? 'Uniform Payment • ' + row.childName
        : 'Uniform Follow-up • ' + row.childName;
    const content = isMissingOrder
      ? 'Hi ' + (row.parentName || 'Parent') +
        ', we assigned a uniform order follow-up for ' + row.childName +
        ". Please submit size, quantities, and select whether your child has a previous back number (or no number)." +
        codeLine + ' Thank you.'
      : isOutstanding
        ? 'Hi ' + (row.parentName || 'Parent') +
          ", this is a reminder to complete uniform payment (or upload proof of payment) for " + row.childName +
          "'s uniform order." + codeLine + ' Thank you.'
        : 'Hi ' + (row.parentName || 'Parent') +
          ', this is a quick uniform follow-up for ' + row.childName +
          '. Please confirm the saved order details and back number in the app.' +
          codeLine + ' Thank you.';

    showAlert({
      title: isMissingOrder ? 'Assign Uniform Request' : 'Message Parent',
      message:
        (isMissingOrder
          ? 'Send this parent an individual uniform order assignment message?'
          : 'Send this parent an individual uniform follow-up message?'),
      type: 'info',
      buttons: [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send',
          onPress: async () => {
            setSingleMessagingTargetId(row.id);
            try {
              const threadId = await getOrCreateThread(userId, schoolId, {
                studentId: row.studentId,
                parentId: row.parentId,
                subject,
              });
              if (!threadId) {
                throw new Error('Unable to find or create a message thread.');
              }
              const supabase = assertSupabase();
              const { data: msg, error } = await supabase
                .from('messages')
                .insert({ thread_id: threadId, sender_id: userId, content, content_type: 'text' })
                .select('id, content')
                .single();
              if (error) throw error;

              await sendPush({
                threadId,
                messageId: msg.id,
                senderId: userId,
                senderName,
                messageContent: msg.content,
                recipientIds: [row.parentId],
              });

              showAlert({
                title: 'Message Sent',
                message: 'The parent was notified successfully.',
                type: 'success',
                buttons: [{ text: 'OK' }],
              });
            } catch (error: any) {
              showAlert({
                title: 'Send Failed',
                message: error?.message || 'Could not send message right now.',
                type: 'error',
                buttons: [{ text: 'OK' }],
              });
            } finally {
              setSingleMessagingTargetId(null);
            }
          },
        },
      ],
    });
  }, [userId, schoolId, showAlert, singleMessagingTargetId, bulkMessaging, senderName]);

  return {
    bulkMessaging,
    singleMessagingTargetId,
    bulkMessageMissing,
    bulkMessageUnpaid,
    bulkMessageNoOrder,
    bulkMessageConfirmNumbers,
    messageSingleParent,
  };
}
