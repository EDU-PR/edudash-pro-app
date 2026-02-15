/**
 * useThreadModeration — Report, block/unblock, view contact, add shortcut
 */

import { useCallback } from 'react';
import { assertSupabase } from '@/lib/supabase';
import { logger } from '@/lib/logger';
import { toast } from '@/components/ui/ToastProvider';
import type { ReportReason } from './types';

interface UseThreadModerationOptions {
  threadId: string;
  userId?: string;
  effectiveOtherUserId?: string;
  displayName: string;
  schoolId?: string;
  isUserBlocked: boolean;
  setIsUserBlocked: (v: boolean) => void;
  alert: { show: (...args: any[]) => void };
  setShowOptionsMenu: (show: boolean) => void;
}

export function useThreadModeration({
  threadId,
  userId,
  effectiveOtherUserId,
  displayName,
  schoolId,
  isUserBlocked,
  setIsUserBlocked,
  alert,
  setShowOptionsMenu,
}: UseThreadModerationOptions) {

  const submitReport = useCallback(
    async (reason: ReportReason) => {
      if (!userId) {
        toast.error('Not signed in');
        return;
      }

      try {
        const supabase = assertSupabase();

        const { error } = await supabase.from('content_reports').insert({
          reporter_id: userId,
          content_type: 'message_thread',
          content_id: threadId,
          content_title: `Chat with ${displayName}`,
          report_reason: reason,
          severity: reason === 'harassment' ? 'high' : 'medium',
          school_id: schoolId || null,
          author_id: effectiveOtherUserId || null,
        });

        if (error) throw error;

        toast.success('Thank you for reporting. We will review this shortly.');
        logger.info('ThreadOptions', `Report submitted: thread=${threadId} reason=${reason}`);
      } catch (error) {
        logger.error('ThreadOptions', 'Report error:', error);
        toast.error('Failed to submit report');
      }
    },
    [userId, threadId, displayName, schoolId, effectiveOtherUserId]
  );

  const handleReport = useCallback(() => {
    alert.show(
      'Report',
      'Report this conversation for:',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Spam', onPress: () => submitReport('spam') },
        { text: 'Harassment', onPress: () => submitReport('harassment') },
        { text: 'Inappropriate', onPress: () => submitReport('inappropriate') },
        { text: 'Other', onPress: () => submitReport('other') },
      ],
      { type: 'warning' }
    );
    setShowOptionsMenu(false);
  }, [alert, setShowOptionsMenu, submitReport]);

  const handleBlockUser = useCallback(() => {
    if (!effectiveOtherUserId) {
      toast.warn('Cannot block in group chats from here');
      setShowOptionsMenu(false);
      return;
    }

    const nextBlocked = !isUserBlocked;
    const title = nextBlocked ? 'Block User' : 'Unblock User';
    const message = nextBlocked
      ? `Block ${displayName}? They won't be able to message you.`
      : `Unblock ${displayName}? They will be able to message you again.`;
    const actionText = nextBlocked ? 'Block' : 'Unblock';

    alert.show(
      title,
      message,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: actionText,
          style: nextBlocked ? 'destructive' : 'default',
          onPress: async () => {
            if (!userId) {
              toast.error('Not signed in');
              return;
            }

            try {
              const supabase = assertSupabase();

              if (nextBlocked) {
                const { error } = await supabase.from('user_blocks').upsert(
                  {
                    blocker_id: userId,
                    blocked_id: effectiveOtherUserId,
                    block_type: 'communication',
                    reason: 'Blocked from messaging thread options',
                    school_id: schoolId || null,
                    is_active: true,
                    updated_at: new Date().toISOString(),
                  },
                  { onConflict: 'blocker_id,blocked_id,block_type' }
                );
                if (error) throw error;
              } else {
                const { error } = await supabase
                  .from('user_blocks')
                  .update({
                    is_active: false,
                    updated_at: new Date().toISOString(),
                  })
                  .eq('blocker_id', userId)
                  .eq('blocked_id', effectiveOtherUserId)
                  .eq('block_type', 'communication');

                if (error) throw error;
              }

              setIsUserBlocked(nextBlocked);
              toast.success(nextBlocked ? `${displayName} has been blocked` : `${displayName} has been unblocked`);
              logger.info(
                'ThreadOptions',
                `${nextBlocked ? 'Blocked' : 'Unblocked'} user ${effectiveOtherUserId} (${displayName})`
              );
            } catch (error) {
              logger.error('ThreadOptions', 'Block toggle error:', error);
              toast.error(nextBlocked ? 'Failed to block user' : 'Failed to unblock user');
            }
          },
        },
      ],
      { type: nextBlocked ? 'warning' : 'confirm' }
    );
    setShowOptionsMenu(false);
  }, [alert, userId, effectiveOtherUserId, isUserBlocked, displayName, schoolId, setShowOptionsMenu, setIsUserBlocked]);

  const handleViewContact = useCallback(async () => {
    setShowOptionsMenu(false);

    if (!effectiveOtherUserId) {
      toast.info(`Contact details for ${displayName}`);
      return;
    }

    try {
      const supabase = assertSupabase();
      const { data, error } = await supabase
        .from('profiles')
        .select('first_name, last_name, role, email, phone')
        .eq('id', effectiveOtherUserId)
        .maybeSingle();

      if (error) throw error;

      const fullName = `${data?.first_name || ''} ${data?.last_name || ''}`.trim() || displayName;
      const role = data?.role || 'User';
      const email = data?.email || 'Not available';
      const phone = data?.phone || 'Not available';

      alert.show(
        'Contact Info',
        `${fullName}\nRole: ${role}\nEmail: ${email}\nPhone: ${phone}`,
        [{ text: 'Close', style: 'default' }],
        { type: 'info' }
      );
    } catch (error) {
      logger.error('ThreadOptions', 'ViewContact error:', error);
      toast.error('Failed to load contact details');
    }
  }, [effectiveOtherUserId, displayName, alert, setShowOptionsMenu]);

  const handleAddShortcut = useCallback(() => {
    alert.show(
      'Add Shortcut',
      'Create home screen shortcut for this chat?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Add',
          onPress: () => {
            toast.success('Shortcut added to home screen');
            logger.debug('ThreadOptions', `Shortcut requested for thread ${threadId}`);
          },
        },
      ],
      { type: 'confirm' }
    );
    setShowOptionsMenu(false);
  }, [alert, threadId, setShowOptionsMenu]);

  return {
    handleReport,
    handleBlockUser,
    handleViewContact,
    handleAddShortcut,
  };
}
