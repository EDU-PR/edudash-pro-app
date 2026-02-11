/**
 * Scroll & Side-Effects
 *
 * UI side-effects: scroll to bottom, auto-scroll on new messages,
 * unread count tracking, focus refresh, and cleanup on unmount.
 *
 * @module hooks/dash-assistant/useScrollAndEffects
 * @max-lines 200
 */

import { useCallback, useEffect } from 'react';
import { Platform } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { DashMessage, DashConversation } from '@/services/dash-ai/types';
import type { IDashAIAssistant } from '@/services/dash-ai/DashAICompat';
import type { SharedRefs } from './types';

interface UseScrollParams {
  refs: Pick<
    SharedRefs,
    | 'flashListRef'
    | 'scrollTimeoutRef'
    | 'prevLengthRef'
    | 'messagesLengthRef'
    | 'isSpeakingStateRef'
  >;
  messages: DashMessage[];
  isInitialized: boolean;
  isLoading: boolean;
  loadingStatus: string | null;
  isNearBottom: boolean;
  isSpeaking: boolean;
  dashInstance: IDashAIAssistant | null;
  conversation: DashConversation | null;
  setUnreadCount: (count: number) => void;
  setMessages: (v: DashMessage[] | ((prev: DashMessage[]) => DashMessage[])) => void;
  setConversation: (conv: DashConversation | null) => void;
  stopSpeaking: () => Promise<void>;
  loadChatPrefs: () => Promise<void>;
  normalizeConversationMessages: (items: DashMessage[]) => DashMessage[];
  persistConversationSnapshot: (conv?: DashConversation | null) => Promise<void>;
}

export function useScrollAndEffects(params: UseScrollParams) {
  const {
    refs,
    messages,
    isInitialized,
    isLoading,
    loadingStatus,
    isNearBottom,
    isSpeaking,
    dashInstance,
    conversation,
    setUnreadCount,
    setMessages,
    setConversation,
    stopSpeaking,
    loadChatPrefs,
    normalizeConversationMessages,
    persistConversationSnapshot,
  } = params;

  // Scroll utility
  const scrollToBottom = useCallback(
    (opts?: { animated?: boolean; delay?: number }) => {
      const delay = opts?.delay ?? 120;
      const animated = opts?.animated ?? true;

      if (refs.scrollTimeoutRef.current) {
        clearTimeout(refs.scrollTimeoutRef.current);
        refs.scrollTimeoutRef.current = null;
      }

      const performScroll = () => {
        const list = refs.flashListRef.current;
        if (!list) return;
        try {
          if (typeof list.scrollToEnd === 'function') list.scrollToEnd({ animated });
          if (typeof list.scrollToOffset === 'function')
            list.scrollToOffset({ offset: 999999, animated: false });
          const lastIndex = Math.max(0, (messages?.length || 1) - 1);
          if (typeof list.scrollToIndex === 'function')
            list.scrollToIndex({ index: lastIndex, animated, viewPosition: 1 });
        } catch (e) {
          console.debug('[useScrollAndEffects] scrollToBottom failed:', e);
        }
      };

      refs.scrollTimeoutRef.current = setTimeout(() => {
        requestAnimationFrame(() => {
          performScroll();
          setTimeout(() => performScroll(), animated ? 250 : 0);
        });
      }, delay);
    },
    [messages?.length, refs],
  );

  // Auto-scroll on init
  useEffect(() => {
    if (isInitialized && messages.length > 0 && refs.flashListRef.current) {
      scrollToBottom({ animated: false, delay: 300 });
    }
  }, [isInitialized]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-scroll on loading
  useEffect(() => {
    const isTypingActive = isLoading || !!loadingStatus;
    if (isTypingActive && refs.flashListRef.current) {
      scrollToBottom({ animated: false, delay: 0 });
      const timer = setTimeout(() => scrollToBottom({ animated: true, delay: 0 }), 100);
      return () => clearTimeout(timer);
    }
  }, [isLoading, loadingStatus, scrollToBottom]); // eslint-disable-line react-hooks/exhaustive-deps

  // Unread count tracking
  useEffect(() => {
    if (!isInitialized) return;
    const prevLen = refs.prevLengthRef.current || 0;
    const currLen = messages.length;
    if (currLen > prevLen) {
      if (isNearBottom) {
        setUnreadCount(0);
      } else {
        setUnreadCount(Math.min(999, currLen - prevLen));
      }
    }
    refs.prevLengthRef.current = currLen;
  }, [messages.length, isNearBottom, isInitialized, setUnreadCount, refs]);

  // Sync refs
  useEffect(() => {
    refs.messagesLengthRef.current = messages.length;
  }, [messages.length, refs]);

  useEffect(() => {
    refs.isSpeakingStateRef.current = isSpeaking;
  }, [isSpeaking, refs]);

  // Focus effect for conversation refresh
  useFocusEffect(
    useCallback(() => {
      loadChatPrefs();
      let active = true;

      if (dashInstance && conversation?.id) {
        dashInstance
          .getConversation(conversation.id)
          .then((updatedConv: any) => {
            if (!active) return;
            const currentLength = refs.messagesLengthRef.current;
            if (updatedConv && updatedConv.messages.length !== currentLength) {
              setMessages(normalizeConversationMessages(updatedConv.messages));
              setConversation(updatedConv);
              persistConversationSnapshot(updatedConv).catch(() => {});
            }
          })
          .catch(() => {});
      }

      return () => {
        active = false;
        if (refs.isSpeakingStateRef.current) {
          stopSpeaking().catch(() => {});
        }
      };
    }, [
      dashInstance,
      conversation?.id,
      loadChatPrefs,
      stopSpeaking,
      normalizeConversationMessages,
      persistConversationSnapshot,
      setMessages,
      setConversation,
      refs,
    ]),
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (refs.scrollTimeoutRef.current) clearTimeout(refs.scrollTimeoutRef.current);
      if (dashInstance) {
        stopSpeaking().catch(() => {});
        dashInstance.cleanup();
      }
    };
  }, [dashInstance, stopSpeaking, refs]);

  // Web beforeunload handler
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (dashInstance && isSpeaking) stopSpeaking().catch(() => {});
    };
    if (
      Platform.OS === 'web' &&
      typeof window !== 'undefined' &&
      typeof window.addEventListener === 'function'
    ) {
      window.addEventListener('beforeunload', handleBeforeUnload);
      return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }
    return undefined;
  }, [dashInstance, isSpeaking, stopSpeaking]);

  return { scrollToBottom };
}
