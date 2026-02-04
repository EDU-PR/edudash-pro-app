/**
 * useDashAttachments Hook
 * 
 * Manages file attachments for Dash AI.
 * Handles picking, uploading, compression, and preview.
 */

import { useState, useCallback } from 'react';
import type { DashAttachment, DashConversation } from '@/services/dash-ai/types';
import {
  pickDocuments,
  pickImages,
  takePhoto,
  uploadAttachment,
} from '@/services/AttachmentService';
import { compressImageForAI } from '@/lib/dash-ai/imageCompression';
import * as Haptics from 'expo-haptics';

export interface UseDashAttachmentsOptions {
  conversation: DashConversation | null;
  onShowAlert?: (config: {
    title: string;
    message: string;
    type: 'error' | 'success' | 'warning' | 'info';
    icon?: string;
    buttons?: Array<{
      text: string;
      onPress?: () => void;
      style?: 'default' | 'cancel' | 'destructive';
    }>;
  }) => void;
}

export interface AttachmentProgress {
  id: string;
  progress: number;
  status: 'idle' | 'uploading' | 'uploaded' | 'failed';
}

export interface UseDashAttachmentsReturn {
  selectedAttachments: DashAttachment[];
  setSelectedAttachments: React.Dispatch<React.SetStateAction<DashAttachment[]>>;
  isUploading: boolean;
  attachmentProgress: Map<string, AttachmentProgress>;
  
  // Actions
  handleTakePhoto: () => Promise<void>;
  handlePickImages: () => Promise<void>;
  handlePickDocuments: () => Promise<void>;
  handleAttachFile: () => Promise<void>;
  handleRemoveAttachment: (attachmentId: string) => void;
  uploadAttachments: (attachments: DashAttachment[]) => Promise<DashAttachment[]>;
  prepareAttachmentsForAI: (attachments: DashAttachment[]) => Promise<DashAttachment[]>;
}

export function useDashAttachments(options: UseDashAttachmentsOptions): UseDashAttachmentsReturn {
  const { conversation, onShowAlert } = options;
  
  const [selectedAttachments, setSelectedAttachments] = useState<DashAttachment[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [attachmentProgress, setAttachmentProgress] = useState<Map<string, AttachmentProgress>>(new Map());

  // Update attachment progress
  const updateAttachmentProgress = useCallback((
    attachmentId: string,
    progress: number,
    status: AttachmentProgress['status'] = 'uploading'
  ) => {
    setAttachmentProgress(prev => {
      const next = new Map(prev);
      next.set(attachmentId, { id: attachmentId, progress, status });
      return next;
    });
  }, []);

  // Take photo with camera
  const handleTakePhoto = useCallback(async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const photos = await takePhoto();
      if (photos && photos.length > 0) {
        setSelectedAttachments(prev => [...prev, ...photos]);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (error) {
      console.error('[Attachments] Failed to take photo:', error);
      onShowAlert?.({
        title: 'Camera Error',
        message: 'Failed to take photo. Please try again.',
        type: 'error',
        icon: 'camera-outline',
      });
    }
  }, [onShowAlert]);

  // Pick images from library
  const handlePickImages = useCallback(async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const images = await pickImages();
      if (images && images.length > 0) {
        setSelectedAttachments(prev => [...prev, ...images]);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (error) {
      console.error('[Attachments] Failed to pick images:', error);
      onShowAlert?.({
        title: 'Error',
        message: 'Failed to select images. Please try again.',
        type: 'error',
        icon: 'image-outline',
      });
    }
  }, [onShowAlert]);

  // Pick documents
  const handlePickDocuments = useCallback(async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const docs = await pickDocuments();
      if (docs && docs.length > 0) {
        setSelectedAttachments(prev => [...prev, ...docs]);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (error) {
      console.error('[Attachments] Failed to pick documents:', error);
      onShowAlert?.({
        title: 'Error',
        message: 'Failed to select documents. Please try again.',
        type: 'error',
        icon: 'document-outline',
      });
    }
  }, [onShowAlert]);

  // Generic attach file handler (shows options)
  const handleAttachFile = useCallback(async () => {
    onShowAlert?.({
      title: 'Add Attachment',
      message: 'Choose attachment type:',
      type: 'info',
      icon: 'attach-outline',
      buttons: [
        { text: 'Take Photo', onPress: handleTakePhoto, style: 'default' },
        { text: 'Choose Images', onPress: handlePickImages, style: 'default' },
        { text: 'Choose Documents', onPress: handlePickDocuments, style: 'default' },
        { text: 'Cancel', style: 'cancel' }, // No onPress - modal auto-closes
      ],
    });
  }, [handleTakePhoto, handlePickImages, handlePickDocuments, onShowAlert]);

  // Remove attachment
  const handleRemoveAttachment = useCallback((attachmentId: string) => {
    setSelectedAttachments(prev => prev.filter(a => a.id !== attachmentId));
    setAttachmentProgress(prev => {
      const next = new Map(prev);
      next.delete(attachmentId);
      return next;
    });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  // Upload attachments to storage
  const uploadAttachments = useCallback(async (attachments: DashAttachment[]): Promise<DashAttachment[]> => {
    if (!conversation?.id) {
      throw new Error('No active conversation');
    }

    setIsUploading(true);
    const uploaded: DashAttachment[] = [];

    try {
      for (const attachment of attachments) {
        updateAttachmentProgress(attachment.id, 0, 'uploading');
        
        try {
          const result = await uploadAttachment(
            attachment,
            conversation.id,
            (progress) => updateAttachmentProgress(attachment.id, progress, 'uploading')
          );
          
          updateAttachmentProgress(attachment.id, 100, 'uploaded');
          uploaded.push(result);
        } catch (error) {
          console.error(`[Attachments] Failed to upload ${attachment.name}:`, error);
          updateAttachmentProgress(attachment.id, 0, 'failed');
          
          onShowAlert?.({
            title: 'Upload Failed',
            message: `Failed to upload ${attachment.name}. Please try again.`,
            type: 'error',
            icon: 'cloud-offline-outline',
            buttons: [{ text: 'OK', style: 'default' }],
          });
        }
      }
    } finally {
      setIsUploading(false);
    }

    return uploaded;
  }, [conversation, updateAttachmentProgress, onShowAlert]);

  // Prepare attachments for AI (compress images)
  const prepareAttachmentsForAI = useCallback(async (attachments: DashAttachment[]): Promise<DashAttachment[]> => {
    const prepared: DashAttachment[] = [];

    for (const attachment of attachments) {
      // Only compress images on native platforms
      if (attachment.kind === 'image' && attachment.previewUri) {
        try {
          const compressed = await compressImageForAI(attachment.previewUri);
          prepared.push({
            ...attachment,
            meta: {
              ...attachment.meta,
              base64: compressed.base64,
              width: compressed.width,
              height: compressed.height,
              compressed: true,
            },
          });
        } catch (error) {
          console.error('[Attachments] Failed to compress image:', error);
          // Use original if compression fails
          prepared.push(attachment);
        }
      } else {
        prepared.push(attachment);
      }
    }

    return prepared;
  }, []);

  return {
    selectedAttachments,
    setSelectedAttachments,
    isUploading,
    attachmentProgress,
    handleTakePhoto,
    handlePickImages,
    handlePickDocuments,
    handleAttachFile,
    handleRemoveAttachment,
    uploadAttachments,
    prepareAttachmentsForAI,
  };
}
