/**
 * Message Composer Component
 * WhatsApp-style input with emoji, attachments, voice recording, and send
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Platform, Animated, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { toast } from '@/components/ui/ToastProvider';
import { ensureImageLibraryPermission } from '@/lib/utils/mediaLibrary';
import { ReplyPreview } from './ReplyPreview';
import { Message } from './types';
import { CYAN_BORDER, CYAN_PRIMARY, CYAN_GLOW } from './theme';

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
}

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
        Alert.alert(
          'Permission Required',
          'Please grant camera access to take photos.'
        );
        return;
      }
      
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
        allowsEditing: true,
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
  }, []);

  // Handle gallery/attachment picker
  const handleAttachment = useCallback(async () => {
    if (!onImageAttach) {
      toast.info('Image attachments not supported in this chat', 'Attachments');
      return;
    }
    
    try {
      const hasPermission = await ensureImageLibraryPermission();
      
      if (!hasPermission) {
        Alert.alert(
          'Permission Required',
          'Please grant gallery access to attach images.'
        );
        return;
      }
      
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
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
  }, []);

  const handleConfirmImage = useCallback(async (uri: string) => {
    if (!onImageAttach || !pendingImage) return;
    try {
      setSendingImage(true);
      await onImageAttach(uri, pendingImage.mimeType);
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
                placeholderTextColor="rgba(255,255,255,0.4)"
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
    paddingHorizontal: 10,
    paddingTop: 10,
    paddingBottom: 8,
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
    backgroundColor: 'rgba(30, 41, 59, 0.85)',
    borderRadius: 24,
    paddingLeft: 8,
    paddingRight: 6,
    paddingVertical: 6,
    minHeight: 48,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.2)',
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
    width: 46,
    height: 46,
  },
  gradientButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#021129ff',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.8,
    shadowRadius: 8,
    elevation: 6,
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
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
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
