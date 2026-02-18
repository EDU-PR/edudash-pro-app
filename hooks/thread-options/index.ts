/**
 * useThreadOptions — Orchestrator
 *
 * Composes sub-hooks for thread-level options: clear chat, mute, search,
 * export, media gallery, starred messages, disappearing messages, report,
 * block, and view contact.
 */

import { useCallback, useEffect, useState } from 'react';
import { useAlert } from '@/components/ui/StyledAlert';
import { toast } from '@/components/ui/ToastProvider';
import { assertSupabase } from '@/lib/supabase';
import { logger } from '@/lib/logger';
import type { Message } from '@/components/messaging';
import type { UseThreadOptionsProps } from './types';
import { loadThreadSettings } from './loadThreadSettings';
import { useThreadSearch } from './useThreadSearch';
import { useThreadExport } from './useThreadExport';
import { useThreadDisappearing } from './useThreadDisappearing';
import { useThreadModeration } from './useThreadModeration';

export type { UseThreadOptionsProps } from './types';

export function useThreadOptions({
  threadId,
  userId,
  otherUserId,
  schoolId,
  refetch,
  setShowOptionsMenu,
  setOptimisticMsgs,
  displayName,
}: UseThreadOptionsProps) {
  const alert = useAlert();

  // ─── Shared state ──────────────────────────────────────────────
  const [isMuted, setIsMuted] = useState(false);
  const [isUserBlocked, setIsUserBlocked] = useState(false);
  const [disappearAfterSeconds, setDisappearAfterSeconds] = useState<number | null>(null);
  const [inferredOtherUserId, setInferredOtherUserId] = useState<string | null>(null);
  const [showMediaGallery, setShowMediaGallery] = useState(false);
  const [showStarredMessages, setShowStarredMessages] = useState(false);

  const effectiveOtherUserId = otherUserId || inferredOtherUserId || undefined;

  // ─── Load settings on mount ────────────────────────────────────
  useEffect(() => {
    if (!threadId) return;
    let cancelled = false;

    loadThreadSettings(threadId, userId, otherUserId).then((settings) => {
      if (cancelled) return;
      setIsMuted(settings.isMuted);
      setIsUserBlocked(settings.isUserBlocked);
      setDisappearAfterSeconds(settings.disappearAfterSeconds);
      setInferredOtherUserId(settings.inferredOtherUserId);
    });

    return () => { cancelled = true; };
  }, [threadId, userId, otherUserId]);

  // ─── Sub-hooks ─────────────────────────────────────────────────
  const search = useThreadSearch({ threadId, setShowOptionsMenu });

  const { handleExportChat } = useThreadExport({
    threadId, displayName, alert, setShowOptionsMenu,
  });

  const { disappearingStatusLabel, handleDisappearingMessages } = useThreadDisappearing({
    threadId, disappearAfterSeconds, setDisappearAfterSeconds, alert, setShowOptionsMenu,
  });

  const moderation = useThreadModeration({
    threadId, userId, effectiveOtherUserId, displayName, schoolId,
    isUserBlocked, setIsUserBlocked, alert, setShowOptionsMenu,
  });

  // ─── Inline simple actions ─────────────────────────────────────
  const handleClearChat = useCallback(async () => {
    alert.show(
      'Clear Chat',
      'This will delete all messages in this conversation. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await assertSupabase()
                .from('messages')
                .delete()
                .eq('thread_id', threadId);
              if (error) throw error;
              setOptimisticMsgs([]);
              refetch();
              toast.success('Chat cleared');
            } catch (error) {
              logger.error('ThreadOptions', 'ClearChat error:', error);
              toast.error('Failed to clear chat');
            }
          },
        },
      ],
      { type: 'confirm' }
    );
    setShowOptionsMenu(false);
  }, [alert, threadId, refetch, setOptimisticMsgs, setShowOptionsMenu]);

  const handleMuteNotifications = useCallback(async () => {
    if (!userId) {
      toast.error('Not signed in');
      setShowOptionsMenu(false);
      return;
    }

    try {
      const newMuted = !isMuted;
      const { error } = await assertSupabase()
        .from('message_participants')
        .update({ is_muted: newMuted })
        .eq('thread_id', threadId)
        .eq('user_id', userId);

      if (error) throw error;
      setIsMuted(newMuted);
      toast.success(newMuted ? 'Notifications muted' : 'Notifications unmuted');
      logger.debug('ThreadOptions', `Thread ${threadId} muted=${newMuted}`);
    } catch (error) {
      logger.error('ThreadOptions', 'Mute error:', error);
      toast.error('Failed to update notification settings');
    }
    setShowOptionsMenu(false);
  }, [userId, threadId, isMuted, setShowOptionsMenu]);

  const handleMediaLinksAndDocs = useCallback(() => {
    setShowMediaGallery(true);
    setShowOptionsMenu(false);
  }, [setShowOptionsMenu]);

  const closeMediaGallery = useCallback(() => setShowMediaGallery(false), []);

  const handleStarredMessages = useCallback(() => {
    setShowStarredMessages(true);
    setShowOptionsMenu(false);
  }, [setShowOptionsMenu]);

  const closeStarredMessages = useCallback(() => setShowStarredMessages(false), []);

  // ─── Return (same public API) ──────────────────────────────────
  return {
    // Thread-level actions
    handleClearChat,
    handleMuteNotifications,
    handleSearchInChat: search.handleSearchInChat,
    handleExportChat,
    handleMediaLinksAndDocs,
    handleStarredMessages,
    handleDisappearingMessages,
    handleAddShortcut: moderation.handleAddShortcut,
    handleReport: moderation.handleReport,
    handleBlockUser: moderation.handleBlockUser,
    handleViewContact: moderation.handleViewContact,
    // Mute state
    isMuted,
    setIsMuted,
    isUserBlocked,
    disappearingStatusLabel,
    // Search overlay
    showSearchOverlay: search.showSearchOverlay,
    searchResults: search.searchResults,
    searchQuery: search.searchQuery,
    isSearching: search.isSearching,
    performSearch: search.performSearch,
    closeSearch: search.closeSearch,
    // Media gallery
    showMediaGallery,
    closeMediaGallery,
    // Starred messages
    showStarredMessages,
    closeStarredMessages,
  };
}
