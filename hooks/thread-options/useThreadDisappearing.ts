/**
 * useThreadDisappearing — Disappearing messages timer management
 */

import { useCallback, useMemo } from 'react';
import { assertSupabase } from '@/lib/supabase';
import { logger } from '@/lib/logger';
import { toast } from '@/components/ui/ToastProvider';

interface UseThreadDisappearingOptions {
  threadId: string;
  disappearAfterSeconds: number | null;
  setDisappearAfterSeconds: (v: number | null) => void;
  alert: { show: (...args: any[]) => void };
  setShowOptionsMenu: (show: boolean) => void;
}

export function useThreadDisappearing({
  threadId,
  disappearAfterSeconds,
  setDisappearAfterSeconds,
  alert,
  setShowOptionsMenu,
}: UseThreadDisappearingOptions) {

  const disappearingStatusLabel = useMemo(() => {
    if (!disappearAfterSeconds) return 'Off';
    if (disappearAfterSeconds === 86400) return 'On • 24h';
    if (disappearAfterSeconds === 604800) return 'On • 7d';
    if (disappearAfterSeconds === 7776000) return 'On • 90d';
    return `On • ${disappearAfterSeconds}s`;
  }, [disappearAfterSeconds]);

  const setDisappearTimer = useCallback(
    async (seconds: number | null) => {
      try {
        const supabase = assertSupabase();
        const { error } = await supabase
          .from('message_threads')
          .update({ disappear_after_seconds: seconds })
          .eq('id', threadId);

        if (error) throw error;
        setDisappearAfterSeconds(seconds);

        if (seconds === null) {
          toast.success('Disappearing messages turned off');
        } else if (seconds === 86400) {
          toast.success('Messages will disappear after 24 hours');
        } else if (seconds === 604800) {
          toast.success('Messages will disappear after 7 days');
        } else {
          toast.success('Messages will disappear after 90 days');
        }

        logger.debug('ThreadOptions', `Thread ${threadId} disappear_after_seconds=${seconds}`);
      } catch (error) {
        logger.error('ThreadOptions', 'DisappearTimer error:', error);
        toast.error('Failed to update disappearing messages');
      }
    },
    [threadId, setDisappearAfterSeconds]
  );

  const handleDisappearingMessages = useCallback(() => {
    alert.show(
      'Disappearing Messages',
      'Set messages to disappear after:',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Off', onPress: () => setDisappearTimer(null) },
        { text: '24 Hours', onPress: () => setDisappearTimer(86400) },
        { text: '7 Days', onPress: () => setDisappearTimer(604800) },
        { text: '90 Days', onPress: () => setDisappearTimer(7776000) },
      ],
      { type: 'info' }
    );
    setShowOptionsMenu(false);
  }, [alert, setShowOptionsMenu, setDisappearTimer]);

  return { disappearingStatusLabel, handleDisappearingMessages };
}
