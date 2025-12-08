/**
 * Chat Wallpaper Picker for React Native
 * Allows users to select gradient presets or upload custom images
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
  Image,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '@/contexts/ThemeContext';

export interface WallpaperSelection {
  type: 'preset' | 'url';
  value: string;
}

interface ChatWallpaperPickerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (selection: WallpaperSelection) => void;
}

// Gradient presets that match the PWA
export const WALLPAPER_PRESETS = [
  {
    key: 'purple-glow',
    label: 'Purple Glow',
    colors: ['#0f172a', '#1e1b4b', '#0f172a'],
  },
  {
    key: 'midnight',
    label: 'Midnight',
    colors: ['#0a0f1e', '#1a1a2e', '#0a0f1e'],
  },
  {
    key: 'ocean-deep',
    label: 'Ocean Deep',
    colors: ['#0c4a6e', '#164e63', '#0f172a'],
  },
  {
    key: 'forest-night',
    label: 'Forest Night',
    colors: ['#14532d', '#1e3a3a', '#0f172a'],
  },
  {
    key: 'sunset-warm',
    label: 'Sunset Warm',
    colors: ['#7c2d12', '#4a1d1d', '#0f172a'],
  },
  {
    key: 'dark-slate',
    label: 'Dark Slate',
    colors: ['#1e293b', '#0f172a', '#0f172a'],
  },
];

// Storage key for wallpaper preference
export const WALLPAPER_STORAGE_KEY = '@edudash_chat_wallpaper';

// Helper to get wallpaper colors from storage
export const getStoredWallpaper = async (): Promise<WallpaperSelection | null> => {
  try {
    const stored = await AsyncStorage.getItem(WALLPAPER_STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.error('Failed to get stored wallpaper:', e);
  }
  return null;
};

// Helper to save wallpaper to storage
export const saveWallpaper = async (selection: WallpaperSelection): Promise<void> => {
  try {
    await AsyncStorage.setItem(WALLPAPER_STORAGE_KEY, JSON.stringify(selection));
  } catch (e) {
    console.error('Failed to save wallpaper:', e);
  }
};

export const ChatWallpaperPicker: React.FC<ChatWallpaperPickerProps> = ({
  isOpen,
  onClose,
  onSelect,
}) => {
  const { theme, isDark } = useTheme();
  const [uploading, setUploading] = useState(false);

  const handlePresetSelect = async (presetKey: string) => {
    const selection: WallpaperSelection = { type: 'preset', value: presetKey };
    await saveWallpaper(selection);
    onSelect(selection);
    onClose();
  };

  const handleImageUpload = async () => {
    try {
      // Request permission
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        return;
      }

      setUploading(true);
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
        base64: true,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        // Use base64 for local storage (avoids bucket complexity)
        const dataUrl = asset.base64 
          ? `data:image/jpeg;base64,${asset.base64}`
          : asset.uri;
        
        const selection: WallpaperSelection = { type: 'url', value: dataUrl };
        await saveWallpaper(selection);
        onSelect(selection);
        onClose();
      }
    } catch (e) {
      console.error('Failed to upload wallpaper image:', e);
    } finally {
      setUploading(false);
    }
  };

  const styles = StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'flex-end',
    },
    container: {
      backgroundColor: theme.surface,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      paddingBottom: Platform.OS === 'ios' ? 34 : 16,
      maxHeight: '70%',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    title: {
      fontSize: 18,
      fontWeight: '700',
      color: theme.text,
    },
    closeButton: {
      padding: 4,
    },
    content: {
      padding: 16,
    },
    section: {
      marginBottom: 24,
    },
    sectionTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.textSecondary,
      marginBottom: 12,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    presetsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
    },
    presetItem: {
      width: '30%',
      aspectRatio: 1,
      borderRadius: 12,
      overflow: 'hidden',
      borderWidth: 2,
      borderColor: 'transparent',
    },
    presetGradient: {
      flex: 1,
      justifyContent: 'flex-end',
      padding: 8,
    },
    presetLabel: {
      fontSize: 11,
      fontWeight: '600',
      color: '#fff',
      textShadowColor: 'rgba(0,0,0,0.5)',
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 2,
    },
    uploadButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.primary,
      borderRadius: 12,
      padding: 16,
      gap: 8,
    },
    uploadButtonText: {
      fontSize: 15,
      fontWeight: '600',
      color: theme.onPrimary,
    },
    resetButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'transparent',
      borderRadius: 12,
      padding: 12,
      borderWidth: 1,
      borderColor: theme.border,
      gap: 8,
      marginTop: 12,
    },
    resetButtonText: {
      fontSize: 14,
      fontWeight: '500',
      color: theme.textSecondary,
    },
  });

  if (!isOpen) return null;

  return (
    <Modal
      visible={isOpen}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableOpacity 
        style={styles.overlay} 
        activeOpacity={1} 
        onPress={onClose}
      >
        <View style={styles.container} onStartShouldSetResponder={() => true}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Chat Wallpaper</Text>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Ionicons name="close" size={24} color={theme.text} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {/* Presets Section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Gradient Presets</Text>
              <View style={styles.presetsGrid}>
                {WALLPAPER_PRESETS.map((preset) => (
                  <TouchableOpacity
                    key={preset.key}
                    style={styles.presetItem}
                    onPress={() => handlePresetSelect(preset.key)}
                    activeOpacity={0.8}
                  >
                    <View
                      style={[
                        styles.presetGradient,
                        { backgroundColor: preset.colors[1] },
                      ]}
                    >
                      <Text style={styles.presetLabel}>{preset.label}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Upload Section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Custom Image</Text>
              <TouchableOpacity
                style={styles.uploadButton}
                onPress={handleImageUpload}
                disabled={uploading}
              >
                {uploading ? (
                  <ActivityIndicator size="small" color={theme.onPrimary} />
                ) : (
                  <>
                    <Ionicons name="image-outline" size={20} color={theme.onPrimary} />
                    <Text style={styles.uploadButtonText}>Upload Image</Text>
                  </>
                )}
              </TouchableOpacity>
              
              {/* Reset to default */}
              <TouchableOpacity
                style={styles.resetButton}
                onPress={() => handlePresetSelect('purple-glow')}
              >
                <Ionicons name="refresh-outline" size={18} color={theme.textSecondary} />
                <Text style={styles.resetButtonText}>Reset to Default</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </TouchableOpacity>
    </Modal>
  );
};

export default ChatWallpaperPicker;
