/**
 * Message Composer Component
 * WhatsApp-style input with emoji, attachments, voice recording, and send
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Platform, Animated, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { toast } from '@/components/ui/ToastProvider';
import { ensureImageLibraryPermission } from '@/lib/utils/mediaLibrary';
import { ReplyPreview } from './ReplyPreview';
import { Message } from './types';
import { CYAN_GLOW } from './theme';
import type { ParentAlertApi } from '@/components/ui/parentAlert';

import EduDashSpinner from '@/components/ui/EduDashSpinner';
import { ImageConfirmModal } from '@/components/ui/ImageConfirmModal';
// Safe component imports
let VoiceRecorder: React.FC<any> | null = null;
let EmojiPicker: React.FC<any> | null = null;

try {
  VoiceRecorder = require('@/components/messaging/VoiceRecorder').VoiceRecorder;
} catch (e) {
  console.error('[MessageComposer] Failed to load VoiceRecorder:', e);
}

try {
  EmojiPicker = require('@/components/messaging/EmojiPicker').EmojiPicker;
} catch {}

interface MessageComposerProps {
  onSend: (text: string) => Promise<void>;
  onVoiceRecording?: (uri: string, duration: number) => Promise<void>;
  onImageAttach?: (uri: string, mimeType: string) => Promise<void>;
  sending: boolean;
  replyingTo?: Message | null;
  onCancelReply?: () => void;
  disabled?: boolean;
  placeholder?: string;
  /** Called when user is typing (for typing indicators) */
  onTyping?: () => void;
  /** When set, the composer switches to edit mode with this message's content */
  editingMessage?: Message | null;
  /** Called to cancel editing */
  onCancelEdit?: () => void;
  /** Optional modal alert API (used by parent flows to avoid native alerts) */
  showAlert?: ParentAlertApi;
}

const COMPOSER_IMAGE_ASPECT: [number, number] = [4, 3];

const getImageDimensions = (uri: string): Promise<{ width: number; height: number }> =>
  new Promise((resolve, reject) => {
    Image.getSize(
      uri,
      (width, height) => resolve({ width, height }),
      (error) => reject(error),
    );
  });

const centerCropToAspect = async (uri: string, aspect: [number, number]): Promise<string> => {
  try {
    const { width, height } = await getImageDimensions(uri);
    if (!width || !height) return uri;

    const targetRatio = aspect[0] / aspect[1];
    const currentRatio = width / height;

    let cropWidth = width;
    let cropHeight = height;

    if (currentRatio > targetRatio) {
      cropWidth = Math.max(1, Math.round(height * targetRatio));
    } else if (currentRatio < targetRatio) {
      cropHeight = Math.max(1, Math.round(width / targetRatio));
    } else {
      return uri;
    }

    const originX = Math.max(0, Math.round((width - cropWidth) / 2));
    const originY = Math.max(0, Math.round((height - cropHeight) / 2));

    const result = await manipulateAsync(
      uri,
      [{ crop: { originX, originY, width: cropWidth, height: cropHeight } }],
      { compress: 0.9, format: SaveFormat.JPEG },
    );

    return result.uri || uri;
  } catch (error) {
    console.warn('[MessageComposer] Aspect crop fallback:', error);
    return uri;
  }
};

export const MessageComposer: React.FC<MessageComposerProps> = React.memo(({
  onSend,
  onVoiceRecording,
  onImageAttach,
  sending,
  replyingTo,
  onCancelReply,
  disabled = false,
  placeholder = 'Message',
  onTyping,
  editingMessage,
  onCancelEdit,
  showAlert,
}) => {
  const [text, setText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [pendingImage, setPendingImage] = useState<{ uri: string; mimeType: string } | null>(null);
  const [sendingImage, setSendingImage] = useState(false);
  
  // Mic glow animation
  const micGlowAnim = useRef(new Animated.Value(0.1)).current;
  
  useEffect(() => {
    const glowLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(micGlowAnim, { toValue: 1, duration: 1200, useNativeDriver: false }),
        Animated.timing(micGlowAnim, { toValue: 0.4, duration: 1200, useNativeDriver: false }),
      ])
    );
    glowLoop.start();
    return () => glowLoop.stop();
  }, [micGlowAnim]);

  // Edit mode: pre-fill text when editingMessage changes
  useEffect(() => {
    if (editingMessage) {
      setText(editingMessage.content || '');
    }
  }, [editingMessage]);

  const isEditing = !!editingMessage;

  const showComposerAlert = useCallback((
    title: string,
    message: string,
    type: 'info' | 'warning' | 'error' | 'success' = 'info',
  ) => {
    if (showAlert) {
      showAlert({ title, message, type });
      return;
    }

    if (type === 'error') {
      toast.error(message, title);
      return;
    }
    if (type === 'warning') {
      toast.warn(message, title);
      return;
    }
    if (type === 'success') {
      toast.success(message, title);
      return;
    }
    toast.info(message, title);
  }, [showAlert]);

  const handleSend = async () => {
    const content = text.trim();
    if (!content || sending) return;

    setText('');
    setShowEmojiPicker(false);
    if (!isEditing) {
      onCancelReply?.();
    }

    await onSend(content);
  };

  const handleVoiceComplete = async (uri: string, duration: number) => {
    setIsRecording(false);
    if (onVoiceRecording) {
      await onVoiceRecording(uri, duration);
    }
  };

  const handleVoiceCancel = () => {
    setIsRecording(false);
  };

  const handleEmojiSelect = (emoji: string) => {
    setText(prev => prev + emoji);
  };

  // Handle camera capture
  const handleCamera = useCallback(async () => {
    if (!onImageAttach) {
      toast.info('Image attachments not supported in this chat', 'Camera');
      return;
    }
    
    try {
      const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
      
      if (!permissionResult.granted) {
        showComposerAlert(
          'Permission Required',
          'Please grant camera access to take photos.',
          'warning',
        );
        return;
      }
      
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
        allowsEditing: false,
      });
      if (!result.canceled && result.assets.length > 0) {
        const asset = result.assets[0];
        const mimeType = asset.mimeType || 'image/jpeg';
        setPendingImage({ uri: asset.uri, mimeType });
      }
    } catch (error) {
      console.error('[MessageComposer] Camera error:', error);
      toast.error('Failed to take photo. Please try again.', 'Camera');
    }
  }, [showComposerAlert]);

  // Handle gallery/attachment picker
  const handleAttachment = useCallback(async () => {
    if (!onImageAttach) {
      toast.info('Image attachments not supported in this chat', 'Attachments');
      return;
    }
    
    try {
      const hasPermission = await ensureImageLibraryPermission();
      
      if (!hasPermission) {
        showComposerAlert(
          'Permission Required',
          'Please grant gallery access to attach images.',
          'warning',
        );
        return;
      }
      
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
        allowsEditing: false,
        allowsMultipleSelection: false,
      });
      
      if (!result.canceled && result.assets.length > 0) {
        const asset = result.assets[0];
        const mimeType = asset.mimeType || 'image/jpeg';
        setPendingImage({ uri: asset.uri, mimeType });
      }
    } catch (error) {
      console.error('[MessageComposer] Attachment error:', error);
      toast.error('Failed to pick image. Please try again.', 'Attachments');
    }
  }, [showComposerAlert]);

  const handleConfirmImage = useCallback(async (uri: string) => {
    if (!onImageAttach || !pendingImage) return;
    try {
      setSendingImage(true);
      const croppedUri = await centerCropToAspect(uri, COMPOSER_IMAGE_ASPECT);
      await onImageAttach(croppedUri, pendingImage.mimeType);
    } finally {
      setSendingImage(false);
      setPendingImage(null);
    }
  }, [onImageAttach, pendingImage]);

  return (
    <View style={styles.container}>
      {/* Image preview/confirm modal */}
      <ImageConfirmModal
        visible={!!pendingImage}
        imageUri={pendingImage?.uri ?? null}
        onConfirm={handleConfirmImage}
        onCancel={() => setPendingImage(null)}
        title="Send Photo"
        confirmLabel="Send"
        confirmIcon="send"
        showCrop
        cropAspect={COMPOSER_IMAGE_ASPECT}
        loading={sendingImage}
      />

      {/* Emoji Picker */}
      {EmojiPicker && (
        <EmojiPicker 
          visible={showEmojiPicker}
          onEmojiSelect={handleEmojiSelect} 
          onClose={() => setShowEmojiPicker(false)} 
        />
      )}
      
      {/* Reply Preview */}
      {replyingTo && !isEditing && (
        <ReplyPreview message={replyingTo} onClose={() => onCancelReply?.()} />
      )}
      
      {/* Edit Mode Banner */}
      {isEditing && (
        <View style={styles.editBanner}>
          <Ionicons name="pencil" size={16} color="#6366f1" />
          <View style={styles.editBannerText}>
            <Text style={styles.editLabel}>Editing message</Text>
            <Text style={styles.editContent} numberOfLines={1}>
              {editingMessage?.content}
            </Text>
          </View>
          <TouchableOpacity onPress={() => { onCancelEdit?.(); setText(''); }} hitSlop={12}>
            <Ionicons name="close" size={20} color="#9ca3af" />
          </TouchableOpacity>
        </View>
      )}
      
      <View style={styles.composerRow}>
        {/* Input wrapper - hide when recording */}
        {!isRecording && (
          <>
            <View style={styles.inputWrapper}>
              {/* Emoji toggle inside the input field */}
              <TouchableOpacity
                style={styles.inlineBtnLeft}
                onPress={() => setShowEmojiPicker(!showEmojiPicker)}
                accessibilityLabel={showEmojiPicker ? 'Close emoji picker' : 'Open emoji picker'}
              >
                <Ionicons
                  name={showEmojiPicker ? 'close-outline' : 'happy-outline'}
                  size={22}
                  color="rgba(255,255,255,0.65)"
                />
              </TouchableOpacity>

              <TextInput
                style={styles.textInput}
                placeholder={placeholder}
                placeholderTextColor="rgba(255,255,255,0.55)"
                value={text}
                onChangeText={(newText) => {
                  setText(newText);
                  // Notify parent about typing activity
                  if (newText.trim() && onTyping) {
                    onTyping();
                  }
                }}
                multiline
                maxLength={1000}
                editable={!sending && !disabled}
                onFocus={() => setShowEmojiPicker(false)}
              />
              
              {/* Camera button (hide when typing) */}
              {!text.trim() && (
                <TouchableOpacity 
                  style={styles.inlineBtn}
                  onPress={handleCamera}
                >
                  <Ionicons name="camera-outline" size={22} color="rgba(255,255,255,0.5)" />
                </TouchableOpacity>
              )}
              
              {/* Attachment button */}
              <TouchableOpacity 
                style={styles.inlineBtn}
                onPress={handleAttachment}
              >
                <Ionicons name="attach-outline" size={22} color="rgba(255,255,255,0.5)" />
              </TouchableOpacity>
            </View>
            
            {/* Send Button - only when there's text */}
            {text.trim() && (
              <TouchableOpacity
                style={styles.actionButton}
                onPress={handleSend}
                disabled={sending}
                activeOpacity={0.8}
              >
                <LinearGradient 
                  colors={['#3b82f6', '#2563eb']} 
                  style={styles.gradientButton}
                >
                  {sending ? (
                    <EduDashSpinner size="small" color="#fff" />
                  ) : (
                    <Ionicons name="send" size={20} color="#fff" />
                  )}
                </LinearGradient>
              </TouchableOpacity>
            )}
          </>
        )}
        
        {/* Voice Recorder - ChatGPT-style inline (takes full width when recording/previewing) */}
        {!text.trim() && VoiceRecorder && (
          <View style={isRecording ? styles.recordingWrapper : undefined}>
            <VoiceRecorder
              onRecordingComplete={handleVoiceComplete}
              onRecordingCancel={handleVoiceCancel}
              disabled={sending || disabled}
              onRecordingStateChange={setIsRecording}
            />
          </View>
        )}
        
        {/* Fallback mic button if VoiceRecorder not available */}
        {!text.trim() && !VoiceRecorder && (
          <View style={styles.micContainer}>
            <Animated.View style={[styles.micGlow, { opacity: micGlowAnim }]} />
            <TouchableOpacity 
              style={styles.actionButton} 
              onPress={() => toast.warn('Voice recording not available', 'Voice')}
            >
              <LinearGradient 
                colors={['#0776d1ff', '#043c85ff']} 
                style={[styles.gradientButton, styles.micButton]}
              >
                <Ionicons name="mic" size={22} color="#fff" />
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 6,
    paddingTop: 4,
    paddingBottom: 4,
  },
  composerRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  inputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.46)',
    borderRadius: 24,
    paddingLeft: 8,
    paddingRight: 6,
    paddingVertical: 6,
    minHeight: 48,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.24)',
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    color: '#fff',
    maxHeight: 100,
    minHeight: 36,
    paddingVertical: 8,
    paddingHorizontal: 6,
  },
  inlineBtnLeft: {
    padding: 8,
    marginRight: 2,
  },
  inlineBtn: {
    padding: 8,
  },
  actionButton: {
    width: 48,
    height: 48,
  },
  gradientButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#020617',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.45,
    shadowRadius: 10,
    elevation: 7,
  },
  micButton: {
    borderWidth: 1.5,
    borderColor: 'rgba(2, 17, 66, 0.5)',
    shadowColor: '#010635ff',
    shadowOpacity: 0.9,
    shadowRadius: 12,
    elevation: 8,
  },
  micContainer: {
    width: 46,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordingWrapper: {
    flex: 1,
  },
  micGlow: {
    position: 'absolute',
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: CYAN_GLOW,
  },
  editBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(99, 102, 241, 0.14)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginHorizontal: 8,
    marginBottom: 4,
    borderRadius: 10,
    borderLeftWidth: 3,
    borderLeftColor: '#6366f1',
    gap: 8,
  },
  editBannerText: {
    flex: 1,
  },
  editLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6366f1',
  },
  editContent: {
    fontSize: 13,
    color: '#9ca3af',
    marginTop: 1,
  },
});
