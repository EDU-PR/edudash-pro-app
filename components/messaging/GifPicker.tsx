/**
 * GifPicker — Lightweight GIF picker component.
 *
 * Phase 1: Opens the device gallery filtered to images (which includes GIFs).
 * Users can pick GIFs saved on their device or received from keyboards.
 *
 * Phase 2 (future): Full Tenor/Giphy integration with trending + search grid.
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '@/contexts/ThemeContext';
import { toast } from '@/components/ui/ToastProvider';
import { ensureImageLibraryPermission } from '@/lib/utils/mediaLibrary';

interface GifPickerProps {
  visible: boolean;
  onClose: () => void;
  onGifSelected: (uri: string, mimeType: string) => void;
}

export function GifPicker({ visible, onClose, onGifSelected }: GifPickerProps) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(false);

  const handlePickFromGallery = useCallback(async () => {
    try {
      setLoading(true);
      const hasPermission = await ensureImageLibraryPermission();
      if (!hasPermission) {
        toast.warn('Please grant gallery access to pick GIFs.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 1,
        allowsEditing: false,
      });

      if (!result.canceled && result.assets.length > 0) {
        const asset = result.assets[0];
        const mimeType = asset.mimeType || 'image/gif';
        onGifSelected(asset.uri, mimeType);
        onClose();
      }
    } catch (error) {
      console.error('[GifPicker] Error picking GIF:', error);
      toast.error('Failed to pick image. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [onGifSelected, onClose]);

  const styles = StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'flex-end',
    },
    container: {
      backgroundColor: theme.surface,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingTop: 16,
      paddingBottom: insets.bottom + 20,
      paddingHorizontal: 24,
    },
    handle: {
      width: 40,
      height: 4,
      backgroundColor: theme.border,
      borderRadius: 2,
      alignSelf: 'center',
      marginBottom: 20,
    },
    title: {
      fontSize: 18,
      fontWeight: '600',
      color: theme.text,
      textAlign: 'center',
      marginBottom: 20,
    },
    optionButton: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 16,
      borderRadius: 14,
      backgroundColor: theme.elevated,
      gap: 14,
      marginBottom: 12,
    },
    optionIcon: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: theme.primary + '18',
      alignItems: 'center',
      justifyContent: 'center',
    },
    optionTextWrapper: {
      flex: 1,
    },
    optionLabel: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.text,
    },
    optionDesc: {
      fontSize: 13,
      color: theme.textSecondary,
      marginTop: 2,
    },
    cancelButton: {
      paddingVertical: 14,
      borderRadius: 12,
      backgroundColor: theme.border,
      alignItems: 'center',
      marginTop: 4,
    },
    cancelText: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.text,
    },
  });

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <View style={styles.container}>
          <View style={styles.handle} />
          <Text style={styles.title}>Send a GIF</Text>

          <TouchableOpacity
            style={styles.optionButton}
            onPress={handlePickFromGallery}
            disabled={loading}
            activeOpacity={0.7}
          >
            <View style={styles.optionIcon}>
              {loading ? (
                <ActivityIndicator color={theme.primary} />
              ) : (
                <Ionicons name="images-outline" size={24} color={theme.primary} />
              )}
            </View>
            <View style={styles.optionTextWrapper}>
              <Text style={styles.optionLabel}>Choose from Gallery</Text>
              <Text style={styles.optionDesc}>Pick a GIF or image from your device</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
          </TouchableOpacity>

          <View style={[styles.optionButton, { opacity: 0.5 }]}>
            <View style={styles.optionIcon}>
              <Ionicons name="globe-outline" size={24} color={theme.primary} />
            </View>
            <View style={styles.optionTextWrapper}>
              <Text style={styles.optionLabel}>Search Online GIFs</Text>
              <Text style={styles.optionDesc}>Coming soon — Tenor integration</Text>
            </View>
            <Ionicons name="lock-closed-outline" size={16} color={theme.textSecondary} />
          </View>

          <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}
