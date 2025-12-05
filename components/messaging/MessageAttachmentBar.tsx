/**
 * Message Attachment Bar Component
 * 
 * Provides media attachment options for messaging:
 * - Image picker (gallery)
 * - Camera capture
 * - Audio recording
 * - Document picker
 */

import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Pressable,
  ActivityIndicator,
  Platform,
  Alert,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { useTranslation } from 'react-i18next';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { Audio } from 'expo-av';

export interface MessageAttachment {
  id: string;
  uri: string;
  type: 'image' | 'video' | 'audio' | 'document';
  name: string;
  mimeType: string;
  size?: number;
  duration?: number; // For audio/video in ms
}

interface MessageAttachmentBarProps {
  onAttach: (attachments: MessageAttachment[]) => void;
  onStartRecording?: () => void;
  onStopRecording?: (uri: string, duration: number) => void;
  disabled?: boolean;
  maxAttachments?: number;
  currentAttachments?: MessageAttachment[];
}

export function MessageAttachmentBar({
  onAttach,
  onStartRecording,
  onStopRecording,
  disabled = false,
  maxAttachments = 5,
  currentAttachments = [],
}: MessageAttachmentBarProps) {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const [showOptions, setShowOptions] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  
  const recordingRef = useRef<Audio.Recording | null>(null);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  
  const canAddMore = currentAttachments.length < maxAttachments;
  
  // Pulse animation for recording indicator
  const startPulseAnimation = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.2,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
      ])
    ).start();
  };
  
  const stopPulseAnimation = () => {
    pulseAnim.stopAnimation();
    pulseAnim.setValue(1);
  };
  
  // Pick images from gallery
  const pickImages = async () => {
    if (!canAddMore) {
      Alert.alert(
        t('messages.maxAttachments', { defaultValue: 'Maximum Attachments' }),
        t('messages.maxAttachmentsDesc', { 
          defaultValue: `You can only attach up to ${maxAttachments} files.`,
          count: maxAttachments 
        })
      );
      return;
    }
    
    setShowOptions(false);
    setIsLoading(true);
    
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (!permissionResult.granted) {
        Alert.alert(
          t('common.permissionRequired', { defaultValue: 'Permission Required' }),
          t('messages.galleryPermission', { defaultValue: 'Please grant gallery access to attach images.' })
        );
        return;
      }
      
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.All,
        allowsMultipleSelection: true,
        quality: 0.8,
        selectionLimit: maxAttachments - currentAttachments.length,
      });
      
      if (!result.canceled && result.assets.length > 0) {
        const attachments: MessageAttachment[] = result.assets.map((asset, index) => ({
          id: `attach_${Date.now()}_${index}`,
          uri: asset.uri,
          type: asset.type === 'video' ? 'video' : 'image',
          name: asset.fileName || `${asset.type}_${Date.now()}.${asset.type === 'video' ? 'mp4' : 'jpg'}`,
          mimeType: asset.mimeType || (asset.type === 'video' ? 'video/mp4' : 'image/jpeg'),
          size: asset.fileSize,
          duration: asset.duration ? asset.duration * 1000 : undefined,
        }));
        
        onAttach(attachments);
      }
    } catch (error) {
      console.error('[MessageAttachment] Pick images error:', error);
      Alert.alert(
        t('common.error', { defaultValue: 'Error' }),
        t('messages.pickImageError', { defaultValue: 'Failed to pick images. Please try again.' })
      );
    } finally {
      setIsLoading(false);
    }
  };
  
  // Take photo with camera
  const takePhoto = async () => {
    if (!canAddMore) {
      Alert.alert(
        t('messages.maxAttachments', { defaultValue: 'Maximum Attachments' }),
        t('messages.maxAttachmentsDesc', { 
          defaultValue: `You can only attach up to ${maxAttachments} files.`,
          count: maxAttachments 
        })
      );
      return;
    }
    
    setShowOptions(false);
    setIsLoading(true);
    
    try {
      const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
      
      if (!permissionResult.granted) {
        Alert.alert(
          t('common.permissionRequired', { defaultValue: 'Permission Required' }),
          t('messages.cameraPermission', { defaultValue: 'Please grant camera access to take photos.' })
        );
        return;
      }
      
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.All,
        quality: 0.8,
        allowsEditing: true,
      });
      
      if (!result.canceled && result.assets.length > 0) {
        const asset = result.assets[0];
        const attachment: MessageAttachment = {
          id: `attach_${Date.now()}`,
          uri: asset.uri,
          type: asset.type === 'video' ? 'video' : 'image',
          name: asset.fileName || `camera_${Date.now()}.${asset.type === 'video' ? 'mp4' : 'jpg'}`,
          mimeType: asset.mimeType || (asset.type === 'video' ? 'video/mp4' : 'image/jpeg'),
          size: asset.fileSize,
          duration: asset.duration ? asset.duration * 1000 : undefined,
        };
        
        onAttach([attachment]);
      }
    } catch (error) {
      console.error('[MessageAttachment] Take photo error:', error);
      Alert.alert(
        t('common.error', { defaultValue: 'Error' }),
        t('messages.cameraError', { defaultValue: 'Failed to take photo. Please try again.' })
      );
    } finally {
      setIsLoading(false);
    }
  };
  
  // Pick documents
  const pickDocument = async () => {
    if (!canAddMore) {
      Alert.alert(
        t('messages.maxAttachments', { defaultValue: 'Maximum Attachments' }),
        t('messages.maxAttachmentsDesc', { 
          defaultValue: `You can only attach up to ${maxAttachments} files.`,
          count: maxAttachments 
        })
      );
      return;
    }
    
    setShowOptions(false);
    setIsLoading(true);
    
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        multiple: true,
        copyToCacheDirectory: true,
      });
      
      if (!result.canceled && result.assets.length > 0) {
        const attachments: MessageAttachment[] = result.assets
          .slice(0, maxAttachments - currentAttachments.length)
          .map((asset, index) => ({
            id: `attach_${Date.now()}_${index}`,
            uri: asset.uri,
            type: 'document' as const,
            name: asset.name,
            mimeType: asset.mimeType || 'application/octet-stream',
            size: asset.size,
          }));
        
        onAttach(attachments);
      }
    } catch (error) {
      console.error('[MessageAttachment] Pick document error:', error);
      Alert.alert(
        t('common.error', { defaultValue: 'Error' }),
        t('messages.pickDocumentError', { defaultValue: 'Failed to pick document. Please try again.' })
      );
    } finally {
      setIsLoading(false);
    }
  };
  
  // Start audio recording
  const startRecording = async () => {
    setShowOptions(false);
    
    try {
      // Request permissions
      const { status } = await Audio.requestPermissionsAsync();
      
      if (status !== 'granted') {
        Alert.alert(
          t('common.permissionRequired', { defaultValue: 'Permission Required' }),
          t('messages.micPermission', { defaultValue: 'Please grant microphone access to record audio.' })
        );
        return;
      }
      
      // Configure audio mode
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });
      
      // Start recording
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      
      recordingRef.current = recording;
      setIsRecording(true);
      setRecordingDuration(0);
      startPulseAnimation();
      
      // Start duration timer
      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);
      
      if (onStartRecording) {
        onStartRecording();
      }
    } catch (error) {
      console.error('[MessageAttachment] Start recording error:', error);
      Alert.alert(
        t('common.error', { defaultValue: 'Error' }),
        t('messages.recordingError', { defaultValue: 'Failed to start recording. Please try again.' })
      );
    }
  };
  
  // Stop audio recording
  const stopRecording = async () => {
    if (!recordingRef.current) return;
    
    try {
      stopPulseAnimation();
      
      // Clear timer
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
      
      // Stop and get URI
      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      const duration = recordingDuration * 1000; // Convert to ms
      
      // Reset audio mode
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
      });
      
      recordingRef.current = null;
      setIsRecording(false);
      setRecordingDuration(0);
      
      if (uri) {
        if (onStopRecording) {
          onStopRecording(uri, duration);
        } else {
          // Create attachment
          const attachment: MessageAttachment = {
            id: `attach_${Date.now()}`,
            uri,
            type: 'audio',
            name: `recording_${Date.now()}.m4a`,
            mimeType: 'audio/m4a',
            duration,
          };
          onAttach([attachment]);
        }
      }
    } catch (error) {
      console.error('[MessageAttachment] Stop recording error:', error);
      setIsRecording(false);
      setRecordingDuration(0);
    }
  };
  
  // Cancel recording
  const cancelRecording = async () => {
    if (!recordingRef.current) return;
    
    try {
      stopPulseAnimation();
      
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
      
      await recordingRef.current.stopAndUnloadAsync();
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
      });
      
      recordingRef.current = null;
      setIsRecording(false);
      setRecordingDuration(0);
    } catch (error) {
      console.error('[MessageAttachment] Cancel recording error:', error);
      setIsRecording(false);
      setRecordingDuration(0);
    }
  };
  
  // Format duration for display
  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };
  
  const options = [
    { id: 'gallery', icon: 'images-outline', label: t('messages.gallery', { defaultValue: 'Gallery' }), onPress: pickImages },
    { id: 'camera', icon: 'camera-outline', label: t('messages.camera', { defaultValue: 'Camera' }), onPress: takePhoto },
    { id: 'audio', icon: 'mic-outline', label: t('messages.recording', { defaultValue: 'Audio' }), onPress: startRecording },
    { id: 'document', icon: 'document-outline', label: t('messages.document', { defaultValue: 'Document' }), onPress: pickDocument },
  ];
  
  return (
    <>
      {/* Recording UI */}
      {isRecording && (
        <View style={[styles.recordingBar, { backgroundColor: theme.surface, borderTopColor: theme.border }]}>
          <TouchableOpacity style={styles.cancelRecordingBtn} onPress={cancelRecording}>
            <Ionicons name="trash-outline" size={24} color={theme.error} />
          </TouchableOpacity>
          
          <View style={styles.recordingInfo}>
            <Animated.View style={[styles.recordingDot, { transform: [{ scale: pulseAnim }] }]} />
            <Text style={[styles.recordingDuration, { color: theme.text }]}>
              {formatDuration(recordingDuration)}
            </Text>
            <Text style={[styles.recordingLabel, { color: theme.textSecondary }]}>
              {t('messages.recording', { defaultValue: 'Recording...' })}
            </Text>
          </View>
          
          <TouchableOpacity 
            style={[styles.stopRecordingBtn, { backgroundColor: theme.primary }]} 
            onPress={stopRecording}
          >
            <Ionicons name="stop" size={20} color={theme.onPrimary} />
          </TouchableOpacity>
        </View>
      )}
      
      {/* Attachment Button */}
      {!isRecording && (
        <TouchableOpacity
          style={[styles.attachButton, disabled && { opacity: 0.5 }]}
          onPress={() => setShowOptions(true)}
          disabled={disabled || isLoading}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color={theme.textSecondary} />
          ) : (
            <Ionicons name="add-circle-outline" size={28} color={theme.textSecondary} />
          )}
        </TouchableOpacity>
      )}
      
      {/* Options Modal */}
      <Modal
        visible={showOptions}
        transparent
        animationType="slide"
        onRequestClose={() => setShowOptions(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowOptions(false)}>
          <Pressable 
            style={[styles.optionsContainer, { backgroundColor: theme.surface }]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={[styles.optionsHandle, { backgroundColor: theme.border }]} />
            
            <Text style={[styles.optionsTitle, { color: theme.text }]}>
              {t('messages.attachOptions', { defaultValue: 'Add Attachment' })}
            </Text>
            
            <View style={styles.optionsGrid}>
              {options.map((option) => (
                <TouchableOpacity
                  key={option.id}
                  style={styles.optionItem}
                  onPress={option.onPress}
                  activeOpacity={0.7}
                >
                  <View style={[styles.optionIcon, { backgroundColor: theme.primary + '15' }]}>
                    <Ionicons name={option.icon as keyof typeof Ionicons.glyphMap} size={28} color={theme.primary} />
                  </View>
                  <Text style={[styles.optionLabel, { color: theme.text }]}>
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            
            <TouchableOpacity
              style={[styles.cancelButton, { backgroundColor: theme.border }]}
              onPress={() => setShowOptions(false)}
            >
              <Text style={[styles.cancelButtonText, { color: theme.text }]}>
                {t('common.cancel', { defaultValue: 'Cancel' })}
              </Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  attachButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  optionsContainer: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 34 : 24,
    paddingHorizontal: 20,
  },
  optionsHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  optionsTitle: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 20,
  },
  optionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
    marginBottom: 20,
  },
  optionItem: {
    alignItems: 'center',
    width: '25%',
    marginBottom: 16,
  },
  optionIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  optionLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  cancelButton: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  recordingBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
  },
  cancelRecordingBtn: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  recordingInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordingDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#EF4444',
    marginRight: 8,
  },
  recordingDuration: {
    fontSize: 18,
    fontWeight: '600',
    marginRight: 8,
  },
  recordingLabel: {
    fontSize: 14,
  },
  stopRecordingBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default MessageAttachmentBar;
