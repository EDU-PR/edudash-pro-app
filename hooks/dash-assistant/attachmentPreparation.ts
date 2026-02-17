import { Platform } from 'react-native';
import * as LegacyFileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';

import type { DashAttachment } from '@/services/dash-ai/types';
import {
  MAX_IMAGE_BASE64_LEN,
  IMAGE_COMPRESS_STEPS,
} from '@/lib/dash-ai/imageCompression';

export const prepareAttachmentsForAI = async (attachments: DashAttachment[]) => {
  if (Platform.OS === 'web') return attachments;
  if (!attachments || attachments.length === 0) return attachments;

  const prepared: DashAttachment[] = [];

  for (const attachment of attachments) {
    if (attachment.kind !== 'image' || !attachment.previewUri) {
      prepared.push(attachment);
      continue;
    }

    const uri = attachment.previewUri || '';
    if (!uri) {
      prepared.push(attachment);
      continue;
    }

    let base64: string | null = null;
    let mediaType = 'image/jpeg';

    for (const step of IMAGE_COMPRESS_STEPS) {
      try {
        const result = await ImageManipulator.manipulateAsync(
          uri,
          [{ resize: { width: step.width } }],
          {
            compress: step.compress,
            format: ImageManipulator.SaveFormat.JPEG,
            base64: true,
          }
        );
        if (result.base64 && result.base64.length <= MAX_IMAGE_BASE64_LEN) {
          base64 = result.base64;
          mediaType = 'image/jpeg';
          break;
        }
      } catch {
        // Try next compression step.
      }
    }

    if (!base64) {
      try {
        const fallback = await LegacyFileSystem.readAsStringAsync(uri, {
          encoding: LegacyFileSystem.EncodingType.Base64,
        });
        if (fallback && fallback.length <= MAX_IMAGE_BASE64_LEN) {
          base64 = fallback;
          mediaType = attachment.mimeType || 'image/jpeg';
        }
      } catch {
        base64 = null;
      }
    }

    if (base64) {
      prepared.push({
        ...attachment,
        meta: {
          ...(attachment.meta || {}),
          image_base64: base64,
          image_media_type: mediaType,
        },
      });
    } else {
      prepared.push(attachment);
    }
  }

  return prepared;
};
