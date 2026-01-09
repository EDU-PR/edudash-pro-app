/**
 * useMessageActions Hook
 * 
 * Extracted from parent-message-thread.tsx to reduce file size per WARP.md.
 * Handles message actions: react, reply, copy, forward, delete, edit.
 */

import { useCallback } from 'react';
import { Alert } from 'react-native';
import { toast } from '@/components/ui/ToastProvider';
import { assertSupabase } from '@/lib/supabase';
import { logger } from '@/lib/logger';
import type { Message } from '@/components/messaging';

interface UseMessageActionsProps {
  selectedMessage: Message | null;
  user: { id: string } | null;
  refetch: () => void;
  setSelectedMessage: (msg: Message | null) => void;
  setShowMessageActions: (show: boolean) => void;
  setReplyingTo: (msg: Message | null) => void;
  setOptimisticMsgs: React.Dispatch<React.SetStateAction<Message[]>>;
}

export function useMessageActions({
  selectedMessage,
  user,
  refetch,
  setSelectedMessage,
  setShowMessageActions,
  setReplyingTo,
  setOptimisticMsgs,
}: UseMessageActionsProps) {
  const handleReact = useCallback(
    async (emoji: string) => {
      if (!selectedMessage?.id || !user?.id) {
        setShowMessageActions(false);
        setSelectedMessage(null);
        return;
      }

      try {
        const client = assertSupabase();

        // Delete any existing reaction from this user on this message first
        await client.from('message_reactions').delete().eq('message_id', selectedMessage.id).eq('user_id', user.id);

        // Add the new reaction
        await client.from('message_reactions').insert({
          message_id: selectedMessage.id,
          user_id: user.id,
          emoji: emoji,
        });

        // Refresh messages to show updated reactions
        refetch();
      } catch (err) {
        logger.error('MessageActions', 'Error reacting to message:', err);
        toast.error('Failed to add reaction');
      }

      setShowMessageActions(false);
      setSelectedMessage(null);
    },
    [selectedMessage, user?.id, refetch, setShowMessageActions, setSelectedMessage]
  );

  const handleReactionPress = useCallback(
    async (messageId: string, emoji: string) => {
      if (!user?.id) return;

      try {
        const client = assertSupabase();

        // Delete the user's reaction
        await client
          .from('message_reactions')
          .delete()
          .eq('message_id', messageId)
          .eq('user_id', user.id)
          .eq('emoji', emoji);

        // Refresh messages
        refetch();
        toast.success('Reaction removed');
      } catch (err) {
        logger.error('MessageActions', 'Error removing reaction:', err);
        toast.error('Failed to remove reaction');
      }
    },
    [user?.id, refetch]
  );

  const handleReply = useCallback(() => {
    if (selectedMessage) {
      setReplyingTo(selectedMessage);
    }
    setShowMessageActions(false);
    setSelectedMessage(null);
  }, [selectedMessage, setReplyingTo, setShowMessageActions, setSelectedMessage]);

  const handleCopy = useCallback(() => {
    setShowMessageActions(false);
    setSelectedMessage(null);
  }, [setShowMessageActions, setSelectedMessage]);

  const handleForward = useCallback(() => {
    toast.info('Forwarding is not yet implemented', 'Forward');
    setShowMessageActions(false);
    setSelectedMessage(null);
  }, [setShowMessageActions, setSelectedMessage]);

  const handleDelete = useCallback(
    async () => {
      if (!selectedMessage) return;

      Alert.alert('Delete Message', 'Are you sure you want to delete this message?', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const client = assertSupabase();
              const { error } = await client
                .from('messages')
                .update({ deleted_at: new Date().toISOString() })
                .eq('id', selectedMessage.id);

              if (error) throw error;

              // Remove from local state immediately
              setOptimisticMsgs((prev) => prev.filter((m) => m.id !== selectedMessage.id));
              // Trigger refetch to update from server
              refetch();
            } catch (err) {
              logger.error('MessageActions', 'Delete failed:', err);
              toast.error('Failed to delete message');
            }
          },
        },
      ]);
      setShowMessageActions(false);
      setSelectedMessage(null);
    },
    [selectedMessage, refetch, setOptimisticMsgs, setShowMessageActions, setSelectedMessage]
  );

  const handleEdit = useCallback(() => {
    setShowMessageActions(false);
    setSelectedMessage(null);
  }, [setShowMessageActions, setSelectedMessage]);

  return {
    handleReact,
    handleReactionPress,
    handleReply,
    handleCopy,
    handleForward,
    handleDelete,
    handleEdit,
  };
}
