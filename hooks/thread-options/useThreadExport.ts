/**
 * useThreadExport — Export chat history as text file
 */

import { useCallback } from 'react';
import { Share, Platform } from 'react-native';
import { assertSupabase } from '@/lib/supabase';
import { logger } from '@/lib/logger';
import { toast } from '@/components/ui/ToastProvider';

interface UseThreadExportOptions {
  threadId: string;
  displayName: string;
  alert: { show: (...args: any[]) => void };
  setShowOptionsMenu: (show: boolean) => void;
}

export function useThreadExport({
  threadId,
  displayName,
  alert,
  setShowOptionsMenu,
}: UseThreadExportOptions) {

  const exportChat = useCallback(
    async (includeMedia: boolean) => {
      try {
        const supabase = assertSupabase();
        const { data, error } = await supabase
          .from('messages')
          .select(
            `content, content_type, voice_url, created_at,
             sender:profiles!messages_sender_id_fkey(first_name, last_name)`
          )
          .eq('thread_id', threadId)
          .is('deleted_at', null)
          .order('created_at', { ascending: true });

        if (error) throw error;

        if (!data || data.length === 0) {
          toast.info('No messages to export');
          return;
        }

        const lines = (data as any[]).map((m: any) => {
          const time = new Date(m.created_at).toLocaleString();
          const sender = Array.isArray(m.sender) ? m.sender[0] : m.sender;
          const name = sender
            ? `${sender.first_name || ''} ${sender.last_name || ''}`.trim() || 'Unknown'
            : 'Unknown';
          const body =
            m.content_type === 'voice'
              ? '[Voice Message]'
              : m.content_type === 'image'
              ? '[Image]'
              : m.content_type === 'file'
              ? '[File]'
              : m.content || '';

          if (!includeMedia) {
            return `[${time}] ${name}: ${body}`;
          }

          const mediaRefs: string[] = [];
          const imageMatches = typeof m.content === 'string'
            ? [...m.content.matchAll(/\[image\]\((.+?)\)/g)].map((match) => match[1])
            : [];

          if (imageMatches.length > 0) {
            imageMatches.forEach((url: string) => mediaRefs.push(`Image: ${url}`));
          }

          if (m.voice_url) {
            mediaRefs.push(`Voice: ${m.voice_url}`);
          }

          if (mediaRefs.length === 0) {
            return `[${time}] ${name}: ${body}`;
          }

          return `[${time}] ${name}: ${body}\n  ${mediaRefs.join('\n  ')}`;
        });

        const header = includeMedia
          ? `Chat Export (With Media Links) — ${displayName}`
          : `Chat Export — ${displayName}`;
        const text = `${header}\n${'─'.repeat(40)}\n${lines.join('\n')}`;

        if (Platform.OS === 'web') {
          const blob = new Blob([text], { type: 'text/plain' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `chat-${displayName.replace(/\s+/g, '_')}${includeMedia ? '-with-media' : ''}.txt`;
          a.click();
          URL.revokeObjectURL(url);
        } else {
          await Share.share({
            message: text,
            title: `Chat with ${displayName}`,
          });
        }

        toast.success(includeMedia ? 'Chat exported with media links' : 'Chat exported');
      } catch (error) {
        logger.error('ThreadOptions', 'Export error:', error);
        toast.error('Failed to export chat');
      }
    },
    [threadId, displayName]
  );

  const handleExportChat = useCallback(() => {
    alert.show(
      'Export Chat',
      'Export chat history as a text file?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Without Media', onPress: () => exportChat(false) },
        { text: 'Include Media Links', onPress: () => exportChat(true) },
      ],
      { type: 'info' }
    );
    setShowOptionsMenu(false);
  }, [alert, exportChat, setShowOptionsMenu]);

  return { handleExportChat };
}
