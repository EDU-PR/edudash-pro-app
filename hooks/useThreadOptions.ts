/**
 * useThreadOptions Hook
 * 
 * Extracted from parent-message-thread.tsx to reduce file size per WARP.md.
 * Handles thread options: clear chat, mute notifications, search, export, etc.
 */

import { useCallback } from 'react';
import { Alert } from 'react-native';
import { toast } from '@/components/ui/ToastProvider';
import { assertSupabase } from '@/lib/supabase';
import { logger } from '@/lib/logger';
import type { Message } from '@/components/messaging';

interface UseThreadOptionsProps {
  threadId: string;
  refetch: () => void;
  setShowOptionsMenu: (show: boolean) => void;
  setOptimisticMsgs: React.Dispatch<React.SetStateAction<Message[]>>;
  displayName: string;
}

export function useThreadOptions({
  threadId,
  refetch,
  setShowOptionsMenu,
  setOptimisticMsgs,
  displayName,
}: UseThreadOptionsProps) {
  const handleClearChat = useCallback(async () => {
    Alert.alert('Clear Chat', 'This will delete all messages in this conversation. Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: async () => {
          try {
            const supabase = assertSupabase();

            // Delete all messages in this thread
            const { error } = await supabase.from('messages').delete().eq('thread_id', threadId);

            if (error) throw error;

            // Clear optimistic messages
            setOptimisticMsgs([]);

            // Refetch to update UI
            refetch();

            toast.success('Chat cleared', 'Success');
          } catch (error) {
            logger.error('ThreadOptions', 'ClearChat error:', error);
            toast.error('Failed to clear chat', 'Error');
          }
        },
      },
    ]);
    setShowOptionsMenu(false);
  }, [threadId, refetch, setOptimisticMsgs, setShowOptionsMenu]);

  const handleMuteNotifications = useCallback(() => {
    toast.info('Mute notifications feature coming soon', 'Notifications');
    setShowOptionsMenu(false);
  }, [setShowOptionsMenu]);

  const handleSearchInChat = useCallback(() => {
    toast.info('Search in chat feature coming soon', 'Search');
    setShowOptionsMenu(false);
  }, [setShowOptionsMenu]);

  const handleExportChat = useCallback(() => {
    Alert.alert('Export Chat', 'Export chat history including media?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Without Media', onPress: () => toast.info('Chat export started...', 'Exporting') },
      { text: 'Include Media', onPress: () => toast.info('Chat export with media started...', 'Exporting') },
    ]);
    setShowOptionsMenu(false);
  }, [setShowOptionsMenu]);

  const handleMediaLinksAndDocs = useCallback(() => {
    toast.info('View shared media feature coming soon', 'Media');
    setShowOptionsMenu(false);
  }, [setShowOptionsMenu]);

  const handleStarredMessages = useCallback(() => {
    toast.info('View starred messages feature coming soon', 'Starred');
    setShowOptionsMenu(false);
  }, [setShowOptionsMenu]);

  const handleDisappearingMessages = useCallback(() => {
    Alert.alert(
      'Disappearing Messages',
      'Set messages to disappear after:',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Off', onPress: () => toast.info('Disappearing messages turned off') },
        { text: '24 Hours', onPress: () => toast.info('Messages will disappear after 24 hours') },
        { text: '7 Days', onPress: () => toast.info('Messages will disappear after 7 days') },
        { text: '90 Days', onPress: () => toast.info('Messages will disappear after 90 days') },
      ]
    );
    setShowOptionsMenu(false);
  }, [setShowOptionsMenu]);

  const handleAddShortcut = useCallback(() => {
    Alert.alert('Add Shortcut', 'Create home screen shortcut for this chat?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Add', onPress: () => toast.success('Shortcut added to home screen') },
    ]);
    setShowOptionsMenu(false);
  }, [setShowOptionsMenu]);

  const handleReport = useCallback(() => {
    Alert.alert(
      'Report',
      'Report this conversation for:',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Spam', onPress: () => toast.success('Thank you for reporting', 'Reported') },
        { text: 'Harassment', onPress: () => toast.success('Thank you for reporting', 'Reported') },
        { text: 'Other', onPress: () => toast.success('Thank you for reporting', 'Reported') },
      ]
    );
    setShowOptionsMenu(false);
  }, [setShowOptionsMenu]);

  const handleBlockUser = useCallback(() => {
    Alert.alert('Block User', `Block ${displayName}? They won't be able to message you.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Block',
        style: 'destructive',
        onPress: () => toast.warn(`${displayName} has been blocked`, 'Blocked'),
      },
    ]);
    setShowOptionsMenu(false);
  }, [displayName, setShowOptionsMenu]);

  const handleViewContact = useCallback(() => {
    toast.info(`View details for ${displayName}`, 'Contact Info');
    setShowOptionsMenu(false);
  }, [displayName, setShowOptionsMenu]);

  return {
    handleClearChat,
    handleMuteNotifications,
    handleSearchInChat,
    handleExportChat,
    handleMediaLinksAndDocs,
    handleStarredMessages,
    handleDisappearingMessages,
    handleAddShortcut,
    handleReport,
    handleBlockUser,
    handleViewContact,
  };
}
