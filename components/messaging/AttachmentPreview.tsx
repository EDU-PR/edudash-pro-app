/**
 * Attachment Preview Component
 * 
 * Displays selected attachments with preview and remove option.
 * Supports images, videos, audio, and documents.
 */

import React from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { MessageAttachment } from './MessageAttachmentBar';

interface AttachmentPreviewProps {
  attachments: MessageAttachment[];
  onRemove: (id: string) => void;
  onPress?: (attachment: MessageAttachment) => void;
}

export function AttachmentPreview({ attachments, onRemove, onPress }: AttachmentPreviewProps) {
  const { theme } = useTheme();
  
  if (attachments.length === 0) return null;
  
  const formatFileSize = (bytes?: number): string => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };
  
  const formatDuration = (ms?: number): string => {
    if (!ms) return '';
    const secs = Math.floor(ms / 1000);
    const mins = Math.floor(secs / 60);
    const remainingSecs = secs % 60;
    return `${mins}:${remainingSecs.toString().padStart(2, '0')}`;
  };
  
  const getDocumentIcon = (mimeType: string): keyof typeof Ionicons.glyphMap => {
    if (mimeType.includes('pdf')) return 'document-text';
    if (mimeType.includes('word') || mimeType.includes('doc')) return 'document';
    if (mimeType.includes('sheet') || mimeType.includes('excel')) return 'grid-outline';
    if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return 'easel-outline';
    if (mimeType.includes('audio')) return 'musical-notes';
    return 'document-outline';
  };
  
  const renderAttachment = (attachment: MessageAttachment) => {
    switch (attachment.type) {
      case 'image':
        return (
          <TouchableOpacity
            key={attachment.id}
            style={[styles.imageContainer, { borderColor: theme.border }]}
            onPress={() => onPress?.(attachment)}
            activeOpacity={0.8}
          >
            <Image source={{ uri: attachment.uri }} style={styles.imagePreview} />
            <TouchableOpacity
              style={[styles.removeButton, { backgroundColor: theme.error }]}
              onPress={() => onRemove(attachment.id)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close" size={16} color="white" />
            </TouchableOpacity>
          </TouchableOpacity>
        );
        
      case 'video':
        return (
          <TouchableOpacity
            key={attachment.id}
            style={[styles.imageContainer, { borderColor: theme.border }]}
            onPress={() => onPress?.(attachment)}
            activeOpacity={0.8}
          >
            <Image source={{ uri: attachment.uri }} style={styles.imagePreview} />
            <View style={styles.videoOverlay}>
              <View style={styles.playIcon}>
                <Ionicons name="play" size={24} color="white" />
              </View>
              {attachment.duration && (
                <Text style={styles.videoDuration}>{formatDuration(attachment.duration)}</Text>
              )}
            </View>
            <TouchableOpacity
              style={[styles.removeButton, { backgroundColor: theme.error }]}
              onPress={() => onRemove(attachment.id)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close" size={16} color="white" />
            </TouchableOpacity>
          </TouchableOpacity>
        );
        
      case 'audio':
        return (
          <View
            key={attachment.id}
            style={[styles.audioContainer, { backgroundColor: theme.primary + '15', borderColor: theme.primary + '30' }]}
          >
            <View style={[styles.audioIcon, { backgroundColor: theme.primary }]}>
              <Ionicons name="mic" size={18} color="white" />
            </View>
            <View style={styles.audioInfo}>
              <Text style={[styles.audioName, { color: theme.text }]} numberOfLines={1}>
                {attachment.name}
              </Text>
              {attachment.duration && (
                <Text style={[styles.audioDuration, { color: theme.textSecondary }]}>
                  {formatDuration(attachment.duration)}
                </Text>
              )}
            </View>
            <TouchableOpacity
              style={[styles.removeButtonSmall, { backgroundColor: theme.error }]}
              onPress={() => onRemove(attachment.id)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close" size={14} color="white" />
            </TouchableOpacity>
          </View>
        );
        
      case 'document':
      default:
        return (
          <View
            key={attachment.id}
            style={[styles.documentContainer, { backgroundColor: theme.surface, borderColor: theme.border }]}
          >
            <View style={[styles.documentIcon, { backgroundColor: theme.primary + '15' }]}>
              <Ionicons name={getDocumentIcon(attachment.mimeType)} size={20} color={theme.primary} />
            </View>
            <View style={styles.documentInfo}>
              <Text style={[styles.documentName, { color: theme.text }]} numberOfLines={1}>
                {attachment.name}
              </Text>
              {attachment.size && (
                <Text style={[styles.documentSize, { color: theme.textSecondary }]}>
                  {formatFileSize(attachment.size)}
                </Text>
              )}
            </View>
            <TouchableOpacity
              style={[styles.removeButtonSmall, { backgroundColor: theme.error }]}
              onPress={() => onRemove(attachment.id)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close" size={14} color="white" />
            </TouchableOpacity>
          </View>
        );
    }
  };
  
  // Separate images/videos from other attachments
  const mediaAttachments = attachments.filter(a => a.type === 'image' || a.type === 'video');
  const otherAttachments = attachments.filter(a => a.type !== 'image' && a.type !== 'video');
  
  return (
    <View style={[styles.container, { backgroundColor: theme.surface, borderTopColor: theme.border }]}>
      {/* Media grid */}
      {mediaAttachments.length > 0 && (
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.mediaScroll}
        >
          {mediaAttachments.map(renderAttachment)}
        </ScrollView>
      )}
      
      {/* Other attachments list */}
      {otherAttachments.length > 0 && (
        <View style={styles.otherAttachments}>
          {otherAttachments.map(renderAttachment)}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderTopWidth: 1,
    paddingVertical: 8,
  },
  mediaScroll: {
    paddingHorizontal: 12,
    gap: 8,
  },
  imageContainer: {
    width: 80,
    height: 80,
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  imagePreview: {
    width: '100%',
    height: '100%',
  },
  removeButton: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  removeButtonSmall: {
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  playIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingLeft: 3,
  },
  videoDuration: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
    fontSize: 10,
    color: 'white',
    fontWeight: '600',
  },
  audioContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginHorizontal: 12,
    marginVertical: 4,
  },
  audioIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  audioInfo: {
    flex: 1,
    marginLeft: 10,
  },
  audioName: {
    fontSize: 14,
    fontWeight: '500',
  },
  audioDuration: {
    fontSize: 12,
    marginTop: 2,
  },
  documentContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginHorizontal: 12,
    marginVertical: 4,
  },
  documentIcon: {
    width: 40,
    height: 40,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  documentInfo: {
    flex: 1,
    marginLeft: 10,
  },
  documentName: {
    fontSize: 14,
    fontWeight: '500',
  },
  documentSize: {
    fontSize: 12,
    marginTop: 2,
  },
  otherAttachments: {
    marginTop: 4,
  },
});

export default AttachmentPreview;
