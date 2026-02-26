/**
 * HomeworkAttachments
 *
 * Displays attachment files and image previews for a homework assignment.
 * Extracted from homework-detail.tsx for reuse and maintainability.
 */

import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { AttachmentItem } from '@/hooks/homework/useHomeworkDetail';

interface HomeworkAttachmentsProps {
  theme: any;
  attachments: AttachmentItem[];
  imageAttachments: AttachmentItem[];
  resolvingAttachments: boolean;
  onOpenAttachment: (url: string) => void;
}

export function HomeworkAttachments({
  theme,
  attachments,
  imageAttachments,
  resolvingAttachments,
  onOpenAttachment,
}: HomeworkAttachmentsProps) {
  return (
    <>
      {resolvingAttachments && <Text style={[styles.bodyText, { color: theme.textSecondary }]}>Loading files...</Text>}

      {imageAttachments.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.previewRow}>
          {imageAttachments.map((attachment, index) => (
            <TouchableOpacity key={`image-${index}`} onPress={() => void onOpenAttachment(attachment.url)}>
              <Image source={{ uri: attachment.url }} style={styles.previewImage} />
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      <View style={{ gap: 8, marginTop: 10 }}>
        {attachments.map((attachment, index) => (
          <TouchableOpacity
            key={`attachment-${index}`}
            style={[styles.fileRow, { borderColor: theme.border, backgroundColor: theme.background }]}
            onPress={() => void onOpenAttachment(attachment.url)}
          >
            <View style={styles.fileMeta}>
              <Ionicons name={attachment.isImage ? 'image-outline' : 'document-outline'} size={18} color={theme.primary} />
              <Text style={[styles.fileLabel, { color: theme.text }]}>Attachment {index + 1}</Text>
            </View>
            <Ionicons name="open-outline" size={18} color={theme.textSecondary} />
          </TouchableOpacity>
        ))}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  bodyText: {
    fontSize: 14,
    lineHeight: 20,
  },
  previewRow: {
    gap: 8,
    paddingVertical: 4,
  },
  previewImage: {
    width: 170,
    height: 110,
    borderRadius: 10,
    backgroundColor: '#0f172a',
  },
  fileRow: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  fileMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  fileLabel: {
    fontSize: 14,
    fontWeight: '600',
    maxWidth: '88%',
  },
});
