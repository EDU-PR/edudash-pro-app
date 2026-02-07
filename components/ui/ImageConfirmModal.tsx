/**
 * ImageConfirmModal
 * 
 * Reusable modal shown after image selection (gallery or camera).
 * Displays a preview of the selected image with:
 *   - Optional "Crop" button to re-open the system editor
 *   - A configurable confirm button ("Set Photo", "Upload", "Send", etc.)
 *   - A cancel / close button
 *
 * Usage:
 *   <ImageConfirmModal
 *     visible={!!pendingImageUri}
 *     imageUri={pendingImageUri}
 *     onConfirm={(uri) => uploadImage(uri)}
 *     onCancel={() => setPendingImageUri(null)}
 *     confirmLabel="Set Photo"        // optional, default "Confirm"
 *     title="Preview Photo"           // optional, default "Preview"
 *     showCrop                        // optional – shows "Edit" button
 *     cropAspect={[1, 1]}             // optional – aspect ratio for crop
 *     loading={uploading}             // optional – shows spinner on confirm
 *   />
 */

import React, { useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';

// Safe spinner import
let EduDashSpinner: React.FC<any> = ({ size, color }: any) => null;
try {
  EduDashSpinner = require('@/components/ui/EduDashSpinner').default;
} catch {}

interface ImageConfirmModalProps {
  /** Whether the modal is visible */
  visible: boolean;
  /** The URI of the image to preview */
  imageUri: string | null;
  /** Called when user taps the confirm button – receives the (potentially cropped) URI */
  onConfirm: (uri: string) => void;
  /** Called when user cancels / closes the modal */
  onCancel: () => void;
  /** Label for the confirm button (default: "Confirm") */
  confirmLabel?: string;
  /** Modal title (default: "Preview") */
  title?: string;
  /** Whether to show the edit/crop button (default: false) */
  showCrop?: boolean;
  /** Aspect ratio for the crop editor (default: undefined = free-form) */
  cropAspect?: [number, number];
  /** Show a loading spinner on the confirm button */
  loading?: boolean;
  /** Icon name for the confirm button (default: "checkmark-circle-outline") */
  confirmIcon?: keyof typeof Ionicons.glyphMap;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const PREVIEW_SIZE = Math.min(SCREEN_WIDTH - 64, 340);

export const ImageConfirmModal: React.FC<ImageConfirmModalProps> = ({
  visible,
  imageUri,
  onConfirm,
  onCancel,
  confirmLabel = 'Confirm',
  title = 'Preview',
  showCrop = false,
  cropAspect,
  loading = false,
  confirmIcon = 'checkmark-circle-outline',
}) => {
  const [currentUri, setCurrentUri] = React.useState<string | null>(imageUri);

  // Sync external imageUri changes
  React.useEffect(() => {
    setCurrentUri(imageUri);
  }, [imageUri]);

  const handleCrop = useCallback(async () => {
    if (!currentUri) return;
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: cropAspect,
        quality: 0.8,
      });
      if (!result.canceled && result.assets?.[0]?.uri) {
        setCurrentUri(result.assets[0].uri);
      }
    } catch {
      // Silently fail – keep current image
    }
  }, [currentUri, cropAspect]);

  const handleConfirm = useCallback(() => {
    if (currentUri) {
      onConfirm(currentUri);
    }
  }, [currentUri, onConfirm]);

  if (!visible || !currentUri) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <View style={styles.card}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>{title}</Text>
            <TouchableOpacity onPress={onCancel} style={styles.closeBtn} hitSlop={{ top: 12, right: 12, bottom: 12, left: 12 }}>
              <Ionicons name="close" size={24} color="#94a3b8" />
            </TouchableOpacity>
          </View>

          {/* Image preview */}
          <View style={styles.previewContainer}>
            <Image
              source={{ uri: currentUri }}
              style={styles.preview}
              resizeMode="contain"
            />
          </View>

          {/* Action buttons */}
          <View style={styles.actions}>
            {showCrop && (
              <TouchableOpacity
                style={styles.cropBtn}
                onPress={handleCrop}
                activeOpacity={0.7}
              >
                <Ionicons name="crop-outline" size={20} color="#3b82f6" />
                <Text style={styles.cropText}>Edit</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[styles.confirmBtn, showCrop && { flex: 1.5 }]}
              onPress={handleConfirm}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <EduDashSpinner size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name={confirmIcon} size={20} color="#fff" />
                  <Text style={styles.confirmText}>{confirmLabel}</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#1e293b',
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.15)',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.4,
        shadowRadius: 16,
      },
      android: { elevation: 12 },
    }),
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#e2e8f0',
  },
  closeBtn: {
    padding: 4,
  },
  previewContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  preview: {
    width: PREVIEW_SIZE,
    height: PREVIEW_SIZE,
    borderRadius: 14,
    backgroundColor: '#0f172a',
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    paddingTop: 8,
  },
  cropBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.3)',
    backgroundColor: 'rgba(59, 130, 246, 0.08)',
  },
  cropText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3b82f6',
  },
  confirmBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: '#3b82f6',
  },
  confirmText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
});

export default ImageConfirmModal;
