import { useCallback, useEffect, useRef, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { encodeMediaContent } from './messageContent';
import { uploadMessageAttachment } from './attachmentUploader';
import { useVoiceRecorder } from './useVoiceRecorder';

export const EMOJI_OPTIONS = [
  '😊',
  '🙂',
  '🙌',
  '🎉',
  '✨',
  '👍',
  '👌',
  '❤️',
  '💖',
  '🤩',
  '🤗',
  '👏',
  '🧠',
  '📚',
  '✏️',
  '🎨',
  '🧮',
  '🧪',
  '🎧',
  '📎',
];

interface ComposerEnhancementsOptions {
  supabase: SupabaseClient;
  threadId: string | null;
  userId?: string;
  onRefresh?: () => void;
  onEmojiInsert: (emoji: string) => void;
}

export const useComposerEnhancements = ({
  supabase,
  threadId,
  userId,
  onRefresh,
  onEmojiInsert,
}: ComposerEnhancementsOptions) => {
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const emojiButtonRef = useRef<HTMLButtonElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [attachmentUploading, setAttachmentUploading] = useState(false);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    onRefresh?.();
  }, [onRefresh]);

  const sendMediaMessage = useCallback(
    async (payload: Parameters<typeof encodeMediaContent>[0]) => {
      if (!threadId || !userId) {
        throw new Error('Missing conversation context');
      }

      await supabase.from('messages').insert({
        thread_id: threadId,
        sender_id: userId,
        content: encodeMediaContent(payload),
        content_type: 'text',
      });

      await supabase
        .from('message_threads')
        .update({ last_message_at: new Date().toISOString() })
        .eq('id', threadId);

      refresh();
    },
    [refresh, supabase, threadId, userId]
  );

  const handleEmojiSelect = (emoji: string) => {
    onEmojiInsert(emoji);
    setShowEmojiPicker(false);
  };

  const triggerFilePicker = () => {
    if (!threadId || !userId) {
      setAttachmentError('Select a conversation before sharing media.');
      return;
    }
    fileInputRef.current?.click();
  };

  const handleAttachmentChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file) return;
    if (!threadId || !userId) {
      setAttachmentError('Select a conversation before sharing media.');
      return;
    }

    setAttachmentUploading(true);
    setAttachmentError(null);

    try {
      const uploaded = await uploadMessageAttachment(file, {
        filenameHint: file.name,
        contentType: file.type,
        pathPrefix: file.type.startsWith('audio/') ? 'audio' : file.type.startsWith('image/') ? 'images' : 'files',
      });

      const mediaType = file.type.startsWith('image/')
        ? 'image'
        : file.type.startsWith('audio/')
          ? 'audio'
          : 'file';

      await sendMediaMessage({
        mediaType,
        url: uploaded.url,
        name: file.name,
        mimeType: uploaded.mimeType,
        size: file.size,
      });
    } catch (error) {
      console.error('Attachment upload failed', error);
      setAttachmentError('Failed to upload media. Please try again.');
    } finally {
      setAttachmentUploading(false);
    }
  };

  const { isRecording, toggleRecording, recorderError } = useVoiceRecorder({
    onRecordingComplete: async (blob, durationMs) => {
      if (!threadId || !userId) return;
      setAttachmentUploading(true);
      try {
        const uploaded = await uploadMessageAttachment(blob, {
          contentType: blob.type || 'audio/webm',
          pathPrefix: 'voice-notes',
        });

        await sendMediaMessage({
          mediaType: 'audio',
          url: uploaded.url,
          name: 'Voice note',
          mimeType: uploaded.mimeType,
          durationMs,
        });
      } catch (error) {
        console.error('Voice note upload failed', error);
        setAttachmentError('Failed to send voice note. Please try again.');
      } finally {
        setAttachmentUploading(false);
      }
    },
  });

  const handleMicClick = async () => {
    if (!threadId || !userId) {
      setAttachmentError('Select a conversation before recording.');
      return;
    }

    await toggleRecording();
  };

  useEffect(() => {
    if (!showEmojiPicker) return;

    const handler = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        emojiPickerRef.current?.contains(target) ||
        emojiButtonRef.current?.contains(target)
      ) {
        return;
      }
      setShowEmojiPicker(false);
    };

    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showEmojiPicker]);

  const statusMessage = attachmentError || recorderError || null;

  return {
    emojiButtonRef,
    emojiPickerRef,
    showEmojiPicker,
    setShowEmojiPicker,
    handleEmojiSelect,
    triggerFilePicker,
    fileInputRef,
    handleAttachmentChange,
    attachmentUploading,
    isRecording,
    handleMicClick,
    statusMessage,
  };
};
