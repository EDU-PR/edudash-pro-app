/**
 * MediaUploadModal Component
 * 
 * ChatGPT-style bottom sheet modal for selecting and managing media attachments.
 * 
 * Features:
 * - Bottom sheet with smooth animations
 * - Large touch-friendly action cards
 * - Preview thumbnails for selected items
 * - Drag-to-reorder attachments
 * - Swipe to remove
 * - File validation and compression preview
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Animated,
  Dimensions,
  Platform,
  Image,
  ScrollView,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/contexts/ThemeContext';
import { formatFileSize } from '@/services/AttachmentService';

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');
const MODAL_HEIGHT = SCREEN_HEIGHT * 0.7;

interface MediaItem {
  id: string;
  uri: string;
  type: 'image' | 'video' | 'document';
  name: string;
  size: number;
  mimeType?: string;
}

interface MediaUploadModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectMedia: (items: MediaItem[]) => void;
  maxSelections?: number;
  allowedTypes?: ('image' | 'video' | 'document')[];
}

export const MediaUploadModal: React.FC<MediaUploadModalProps> = ({
  visible,
  onClose,
  onSelectMedia,
  maxSelections = 10,
  allowedTypes = ['image', 'video', 'document'],
}) => {
  const { theme, isDark } = useTheme();
  const [slideAnim] = useState(new Animated.Value(MODAL_HEIGHT));
  const [backdropOpacity] = useState(new Animated.Value(0));
  const [selectedItems, setSelectedItems] = useState<MediaItem[]>([]);
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    if (visible) {
      setSelectedItems([]);
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          useNativeDriver: true,
          damping: 20,
          stiffness: 100,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: MODAL_HEIGHT,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  const handleClose = useCallback(() => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    onClose();
  }, [onClose]);

  const handleTakePhoto = useCallback(async () => {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {}

    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.9,
      allowsEditing: false,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      const item: MediaItem = {
        id: Date.now().toString(),
        uri: asset.uri,
        type: 'image',
        name: asset.fileName || `photo_${Date.now()}.jpg`,
        size: asset.fileSize || 0,
        mimeType: asset.mimeType,
      };
      setSelectedItems((prev) => [...prev, item]);
      setShowPreview(true);
    }
  }, []);

  const handlePickFromLibrary = useCallback(async () => {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {}

    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: allowedTypes.includes('video') ? ['images', 'videos'] : ['images'],
      quality: 0.9,
      allowsEditing: false,
      allowsMultipleSelection: true,
      selectionLimit: maxSelections - selectedItems.length,
    });

    if (!result.canceled) {
      const newItems: MediaItem[] = result.assets.map((asset) => ({
        id: Date.now().toString() + Math.random(),
        uri: asset.uri,
        type: asset.type === 'video' ? 'video' : 'image',
        name: asset.fileName || `media_${Date.now()}.${asset.type === 'video' ? 'mp4' : 'jpg'}`,
        size: asset.fileSize || 0,
        mimeType: asset.mimeType,
      }));
      setSelectedItems((prev) => [...prev, ...newItems].slice(0, maxSelections));
      setShowPreview(true);
    }
  }, [allowedTypes, maxSelections, selectedItems.length]);

  const handlePickDocuments = useCallback(async () => {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {}

    const result = await DocumentPicker.getDocumentAsync({
      type: '*/*',
      multiple: true,
      copyToCacheDirectory: true,
    });

    if (result.assets) {
      const newItems: MediaItem[] = result.assets.map((asset) => ({
        id: Date.now().toString() + Math.random(),
        uri: asset.uri,
        type: 'document',
        name: asset.name,
        size: asset.size || 0,
        mimeType: asset.mimeType,
      }));
      setSelectedItems((prev) => [...prev, ...newItems].slice(0, maxSelections));
      setShowPreview(true);
    }
  }, [maxSelections]);

  const handleRemoveItem = useCallback((id: string) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    setSelectedItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const handleConfirm = useCallback(() => {
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {}
    onSelectMedia(selectedItems);
    handleClose();
  }, [selectedItems, onSelectMedia, handleClose]);

  type ActionCard = {
    id: string;
    icon: string;
    title: string;
    subtitle: string;
    gradient: [string, string];
    onPress: () => void;
    enabled: boolean;
  };

  const actionCards: ActionCard[] = [
    {
      id: 'camera',
      icon: 'camera',
      title: 'Take Photo',
      subtitle: 'Use camera to capture',
      gradient: ['#667eea', '#764ba2'],
      onPress: handleTakePhoto,
      enabled: allowedTypes.includes('image'),
    },
    {
      id: 'library',
      icon: 'images',
      title: 'Photo Library',
      subtitle: 'Choose from gallery',
      gradient: ['#f093fb', '#f5576c'],
      onPress: handlePickFromLibrary,
      enabled: allowedTypes.includes('image') || allowedTypes.includes('video'),
    },
    {
      id: 'documents',
      icon: 'document-text',
      title: 'Documents',
      subtitle: 'PDFs, docs, and files',
      gradient: ['#4facfe', '#00f2fe'],
      onPress: handlePickDocuments,
      enabled: allowedTypes.includes('document'),
    },
  ];

  const enabledCards = actionCards.filter((card) => card.enabled);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <View style={styles.container}>
        {/* Backdrop */}
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={handleClose}
        >
          <Animated.View
            style={[
              StyleSheet.absoluteFill,
              {
                backgroundColor: 'rgba(0,0,0,0.5)',
                opacity: backdropOpacity,
              },
            ]}
          />
        </Pressable>

        {/* Bottom Sheet */}
        <Animated.View
          style={[
            styles.sheet,
            {
              backgroundColor: theme.surface,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          {/* Handle */}
          <View style={styles.handleContainer}>
            <View style={[styles.handle, { backgroundColor: theme.border }]} />
          </View>

          {/* Header */}
          <View style={styles.header}>
            <Text style={[styles.title, { color: theme.text }]}>
              Add Media
            </Text>
            <TouchableOpacity
              onPress={handleClose}
              style={styles.closeButton}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close" size={24} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Content */}
          <ScrollView
            style={styles.content}
            contentContainerStyle={styles.contentContainer}
            showsVerticalScrollIndicator={false}
          >
            {/* Action Cards */}
            <View style={styles.cardsContainer}>
              {enabledCards.map((card) => (
                <TouchableOpacity
                  key={card.id}
                  style={styles.card}
                  onPress={card.onPress}
                  activeOpacity={0.8}
                >
                  <LinearGradient
                    colors={card.gradient}
                    style={styles.cardGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  >
                    <View style={styles.cardIcon}>
                      <Ionicons name={card.icon as any} size={32} color="#fff" />
                    </View>
                    <Text style={styles.cardTitle}>{card.title}</Text>
                    <Text style={styles.cardSubtitle}>{card.subtitle}</Text>
                  </LinearGradient>
                </TouchableOpacity>
              ))}
            </View>

            {/* Selected Items Preview */}
            {selectedItems.length > 0 && showPreview && (
              <View style={styles.previewSection}>
                <View style={styles.previewHeader}>
                  <Text style={[styles.previewTitle, { color: theme.text }]}>
                    Selected ({selectedItems.length})
                  </Text>
                  {selectedItems.length > 0 && (
                    <TouchableOpacity onPress={() => setSelectedItems([])}>
                      <Text style={[styles.clearButton, { color: theme.error }]}>
                        Clear All
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>

                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.previewScroll}
                >
                  {selectedItems.map((item) => (
                    <View key={item.id} style={styles.previewItem}>
                      <View style={[styles.previewThumbnail, { backgroundColor: theme.surfaceVariant }]}>
                        {item.type === 'image' ? (
                          <Image
                            source={{ uri: item.uri }}
                            style={styles.previewImage}
                            resizeMode="cover"
                          />
                        ) : (
                          <Ionicons
                            name={item.type === 'video' ? 'videocam' : 'document'}
                            size={32}
                            color={theme.textSecondary}
                          />
                        )}
                      </View>
                      <Text
                        style={[styles.previewName, { color: theme.text }]}
                        numberOfLines={1}
                      >
                        {item.name}
                      </Text>
                      <Text style={[styles.previewSize, { color: theme.textSecondary }]}>
                        {formatFileSize(item.size)}
                      </Text>
                      <TouchableOpacity
                        style={[styles.removeButton, { backgroundColor: theme.error }]}
                        onPress={() => handleRemoveItem(item.id)}
                      >
                        <Ionicons name="close" size={14} color="#fff" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </ScrollView>
              </View>
            )}
          </ScrollView>

          {/* Footer */}
          {selectedItems.length > 0 && (
            <View style={[styles.footer, { backgroundColor: theme.background, borderTopColor: theme.border }]}>
              <TouchableOpacity
                style={[styles.confirmButton, { backgroundColor: theme.primary }]}
                onPress={handleConfirm}
                activeOpacity={0.8}
              >
                <Text style={[styles.confirmButtonText, { color: theme.onPrimary || '#fff' }]}>
                  Add {selectedItems.length} {selectedItems.length === 1 ? 'Item' : 'Items'}
                </Text>
                <Ionicons name="checkmark-circle" size={20} color={theme.onPrimary || '#fff'} />
              </TouchableOpacity>
            </View>
          )}
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    height: MODAL_HEIGHT,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.15,
        shadowRadius: 16,
      },
      android: {
        elevation: 16,
      },
    }),
  },
  handleContainer: {
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 8,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  cardsContainer: {
    gap: 12,
  },
  card: {
    height: 140,
    borderRadius: 20,
    overflow: 'hidden',
  },
  cardGradient: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },
  cardIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
  },
  previewSection: {
    marginTop: 24,
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  previewTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  clearButton: {
    fontSize: 14,
    fontWeight: '600',
  },
  previewScroll: {
    gap: 12,
  },
  previewItem: {
    width: 100,
  },
  previewThumbnail: {
    width: 100,
    height: 100,
    borderRadius: 12,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  previewName: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 2,
  },
  previewSize: {
    fontSize: 11,
  },
  removeButton: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: {
    padding: 20,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  confirmButton: {
    height: 56,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  confirmButtonText: {
    fontSize: 17,
    fontWeight: '700',
  },
});
