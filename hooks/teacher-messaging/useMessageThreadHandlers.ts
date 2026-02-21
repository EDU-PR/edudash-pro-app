/**
 * Teacher Message Thread — Handler Functions
 * All callback handlers for send, reactions, star, voice, calls, scroll.
 * ≤200 lines per WARP standard.
 */
import { useCallback } from 'react';
import {
  Vibration,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
  type LayoutChangeEvent,
} from 'react-native';
import { toast } from '@/components/ui/ToastProvider';
import { type Message } from '@/components/messaging';
import { COMPOSER_OVERLAY_HEIGHT } from '@/features/teacher-messaging/teacher-message-thread.styles';
import type { useMessageThreadState } from './useMessageThreadState';

// Safe import for voice upload
let uploadVoiceNote: ((uri: string, duration: number, conversationId?: string) => Promise<{ publicUrl: string; storagePath: string }>) | null = null;
try { uploadVoiceNote = require('@/services/VoiceStorageService').uploadVoiceNote; } catch {}

type ThreadState = ReturnType<typeof useMessageThreadState>;

export function useMessageThreadHandlers(state: ThreadState) {
  const {
    threadId, user, selectedMsg, setSelectedMsg,
    replyTo, setReplyTo, setShowActions, setSending,
    sendMessage, refetch, clearTyping, listRef, isAtBottomRef,
    composerHeight, setComposerHeight,
    callContext, parentId, displayName,
  } = state;

  const handleSend = useCallback(async (content: string) => {
    if (!content.trim() || !threadId || !user?.id) return;
    const replyToId = replyTo?.id;
    setSending(true);
    setReplyTo(null);
    try {
      await sendMessage({ threadId, content, replyToId });
      refetch();
      clearTyping();
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 60);
    } catch {
      toast.error('Failed to send message');
    } finally {
      setSending(false);
    }
  }, [threadId, user?.id, sendMessage, refetch, clearTyping, listRef, setSending, setReplyTo, replyTo]);

  const handleVoiceRecording = useCallback(async (uri: string, dur: number) => {
    if (!threadId || !user?.id) return;
    const durationSecs = Math.round(dur / 1000);
    setSending(true);
    try {
      if (uploadVoiceNote) {
        const result = await uploadVoiceNote(uri, dur, threadId);
        // Store storagePath (not publicUrl) — signed URLs expire!
        await sendMessage({
          threadId, content: `🎤 Voice (${durationSecs}s)`,
          voiceUrl: result.storagePath, voiceDuration: durationSecs,
        });
      } else {
        await sendMessage({ threadId, content: `🎤 Voice message (${durationSecs}s)` });
      }
      refetch();
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 60);
    } catch (error) {
      console.error('Voice send error:', error);
      toast.error('Failed to send voice message');
    } finally {
      setSending(false);
    }
  }, [threadId, user?.id, sendMessage, refetch, listRef, setSending]);

  const handleLongPress = useCallback((msg: Message) => {
    setSelectedMsg(msg);
    setShowActions(true);
    Vibration.vibrate(30);
  }, [setSelectedMsg, setShowActions]);

  const handleReply = useCallback(() => {
    if (selectedMsg) {
      setReplyTo(selectedMsg);
      setShowActions(false);
    }
  }, [selectedMsg, setReplyTo, setShowActions]);

  // Only one reaction per user per message
  const handleReact = useCallback(async (emoji: string) => {
    if (!selectedMsg?.id || !user?.id) { setShowActions(false); return; }
    try {
      const client = require('@/lib/supabase').assertSupabase();
      // Remove any existing reaction first
      await client.from('message_reactions').delete()
        .eq('message_id', selectedMsg.id).eq('user_id', user.id);
      await client.from('message_reactions').insert({
        message_id: selectedMsg.id, user_id: user.id, emoji,
      });
      refetch();
    } catch (err) {
      console.error('Error reacting:', err);
      toast.error('Failed to add reaction');
    }
    setShowActions(false);
  }, [selectedMsg, user?.id, refetch, setShowActions]);

  const handleReactionPress = useCallback(async (messageId: string, emoji: string) => {
    if (!user?.id) return;
    try {
      const client = require('@/lib/supabase').assertSupabase();
      await client.from('message_reactions').delete()
        .eq('message_id', messageId).eq('user_id', user.id).eq('emoji', emoji);
      refetch();
      toast.success('Reaction removed');
    } catch (err) {
      console.error('Error removing reaction:', err);
      toast.error('Failed to remove reaction');
    }
  }, [user?.id, refetch]);

  const handleToggleStar = useCallback(async () => {
    if (!selectedMsg?.id || !user?.id) { setShowActions(false); return; }
    try {
      const client = require('@/lib/supabase').assertSupabase();
      const isStarred = !!(selectedMsg as any).is_starred;
      const { error } = await client.from('messages')
        .update({ is_starred: !isStarred }).eq('id', selectedMsg.id);
      if (error) throw error;
      refetch();
      toast.success(!isStarred ? 'Message starred' : 'Star removed');
    } catch (error) {
      console.error('Error toggling star:', error);
      toast.error('Failed to update star');
    } finally {
      setShowActions(false);
      setSelectedMsg(null);
    }
  }, [selectedMsg, user?.id, refetch, setShowActions, setSelectedMsg]);

  const handleVoiceCall = useCallback(() => {
    if (!callContext) { toast.warn('Voice calling is not available', 'Voice Call'); return; }
    if (!parentId) { toast.warn('Cannot identify recipient', 'Voice Call'); return; }
    callContext.startVoiceCall(parentId, displayName, { threadId });
  }, [callContext, parentId, displayName, threadId]);

  const handleVideoCall = useCallback(() => {
    if (!callContext) { toast.warn('Video calling is not available', 'Video Call'); return; }
    if (!parentId) { toast.warn('Cannot identify recipient', 'Video Call'); return; }
    callContext.startVideoCall(parentId, displayName, { threadId });
  }, [callContext, parentId, displayName, threadId]);

  const handleScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
    const paddingToBottom = 120;
    isAtBottomRef.current =
      layoutMeasurement.height + contentOffset.y >= contentSize.height - paddingToBottom;
  }, [isAtBottomRef]);

  const handleComposerLayout = useCallback((event: LayoutChangeEvent) => {
    const nextHeight = Math.ceil(event.nativeEvent.layout.height);
    if (nextHeight > 0 && Math.abs(nextHeight - composerHeight) > 1) {
      setComposerHeight(nextHeight);
    }
  }, [composerHeight, setComposerHeight]);

  return {
    handleSend, handleVoiceRecording, handleLongPress, handleReply,
    handleReact, handleReactionPress, handleToggleStar,
    handleVoiceCall, handleVideoCall, handleScroll, handleComposerLayout,
  };
}
