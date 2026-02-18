/**
 * Load Thread Settings
 * Fetches mute status, block status, disappearing timer, and inferred other user.
 */

import { assertSupabase } from '@/lib/supabase';
import { logger } from '@/lib/logger';
import type { ThreadSettingsState } from './types';

export async function loadThreadSettings(
  threadId: string,
  userId?: string,
  otherUserId?: string,
): Promise<ThreadSettingsState> {
  const result: ThreadSettingsState = {
    isMuted: false,
    isUserBlocked: false,
    disappearAfterSeconds: null,
    inferredOtherUserId: null,
  };

  try {
    const supabase = assertSupabase();
    let targetOtherUserId = otherUserId || undefined;

    if (userId) {
      // Load mute status
      const { data: participantData, error: participantError } = await supabase
        .from('message_participants')
        .select('is_muted')
        .eq('thread_id', threadId)
        .eq('user_id', userId)
        .maybeSingle();

      if (!participantError && typeof participantData?.is_muted === 'boolean') {
        result.isMuted = participantData.is_muted;
      }

      // Infer other user if not provided
      if (!targetOtherUserId) {
        const { data: otherParticipantData, error: otherParticipantError } = await supabase
          .from('message_participants')
          .select('user_id')
          .eq('thread_id', threadId)
          .neq('user_id', userId)
          .limit(1)
          .maybeSingle();

        if (!otherParticipantError) {
          const inferredId = (otherParticipantData as any)?.user_id ?? null;
          result.inferredOtherUserId = inferredId;
          targetOtherUserId = inferredId || undefined;
        }
      }
    }

    // Load disappearing timer
    const { data: threadData, error: threadError } = await supabase
      .from('message_threads')
      .select('disappear_after_seconds')
      .eq('id', threadId)
      .maybeSingle();

    if (!threadError) {
      result.disappearAfterSeconds = (threadData as any)?.disappear_after_seconds ?? null;
    }

    // Load block status
    if (userId && targetOtherUserId) {
      const { data: blockData, error: blockError } = await supabase
        .from('user_blocks')
        .select('is_active, expires_at')
        .eq('blocker_id', userId)
        .eq('blocked_id', targetOtherUserId)
        .eq('block_type', 'communication')
        .maybeSingle();

      if (!blockError) {
        const expiryMs = blockData?.expires_at ? new Date(blockData.expires_at).getTime() : null;
        const isExpired = !!expiryMs && expiryMs < Date.now();
        result.isUserBlocked = Boolean(blockData?.is_active) && !isExpired;
      }
    }
  } catch (error) {
    logger.warn('ThreadOptions', 'Failed to load thread options state:', error);
  }

  return result;
}
