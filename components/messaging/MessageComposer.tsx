/**
 * Message Composer Component
 * WhatsApp-style input with emoji, attachments, voice recording, and send
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Platform,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { toast } from '@/components/ui/ToastProvider';
import { ReplyPreview } from './ReplyPreview';
import { Message } from './types';
import { CYAN_BORDER, CYAN_PRIMARY, CYAN_GLOW } from './theme';

// Safe component imports
let VoiceRecorder: React.FC<any> | null = null;
let EmojiPicker: React.FC<any> | null = null;

try {
  VoiceRecorder = require('@/components/messaging/VoiceRecorder').VoiceRecorder;
} catch {}

try {
  EmojiPicker = require('@/components/messaging/EmojiPicker').EmojiPicker;
} catch {}

interface MessageComposerProps {
  onSend: (text: string) => Promise<void>;
  onVoiceRecording?: (uri: string, duration: number) => Promise<void>;
  sending: boolean;
  replyingTo?: Message | null;
  onCancelReply?: () => void;
  disabled?: boolean;
  placeholder?: string;
}

export const MessageComposer: React.FC<MessageComposerProps> = ({
  onSend,
  onVoiceRecording,
  sending,
  replyingTo,
  onCancelReply,
  disabled = false,
  placeholder = 'Message',
}) => {
  const [text, setText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  
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

  const handleSend = async () => {
    const content = text.trim();
    if (!content || sending) return;

    setText('');
    setShowEmojiPicker(false);
    onCancelReply?.();

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

  return (
    <View style={styles.container}>
      {/* Emoji Picker */}
      {EmojiPicker && (
        <EmojiPicker 
          visible={showEmojiPicker}
          onEmojiSelect={handleEmojiSelect} 
          onClose={() => setShowEmojiPicker(false)} 
        />
      )}
      
      {/* Reply Preview */}
      {replyingTo && (
        <ReplyPreview message={replyingTo} onClose={() => onCancelReply?.()} />
      )}
      
      <View style={styles.composerRow}>
        {/* Emoji button - hide when recording */}
        {!isRecording && (
          <TouchableOpacity 
            style={styles.composerBtn}
            onPress={() => setShowEmojiPicker(!showEmojiPicker)}
          >
            <Ionicons 
              name={showEmojiPicker ? 'close-outline' : 'happy-outline'} 
              size={32} 
              color="rgba(255,255,255,0.6)" 
            />
          </TouchableOpacity>
        )}
        
        {/* Input wrapper - hide when recording */}
        {!isRecording && (
          <>
            <View style={styles.inputWrapper}>
              <TextInput
                style={styles.textInput}
                placeholder={placeholder}
                placeholderTextColor="rgba(255,255,255,0.4)"
                value={text}
                onChangeText={setText}
                multiline
                maxLength={1000}
                editable={!sending && !disabled}
                onFocus={() => setShowEmojiPicker(false)}
              />
              
              {/* Camera button (hide when typing) */}
              {!text.trim() && (
                <TouchableOpacity 
                  style={styles.inlineBtn}
                  onPress={() => toast.info('Coming soon', 'Camera')}
                >
                  <Ionicons name="camera-outline" size={22} color="rgba(255,255,255,0.5)" />
                </TouchableOpacity>
              )}
              
              {/* Attachment button */}
              <TouchableOpacity 
                style={styles.inlineBtn}
                onPress={() => toast.info('Coming soon', 'Attachments')}
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
                    <ActivityIndicator size="small" color="#fff" />
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
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 6,
    paddingTop: 14,
    paddingBottom: 5,
  },
  composerRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 4,
  },
  composerBtn: {
    width: 36,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(30, 41, 59, 0.85)',
    borderRadius: 24,
    paddingLeft: 14,
    paddingRight: 8,
    paddingVertical: 8,
    minHeight: 50,
    marginLeft: -4,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.2)',
    bottom: -12,
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    color: '#fff',
    maxHeight: 100,
    minHeight: 36,
    paddingVertical: 8,
  },
  inlineBtn: {
    padding: 6,
    marginLeft: 2,
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
    shadowColor: '#021129ff',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.8,
    shadowRadius: 8,
    elevation: 6,
    bottom: -12,
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
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    bottom: -12,
  },
  recordingWrapper: {
    flex: 1,
  },
  micGlow: {
    position: 'absolute',
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: CYAN_GLOW,
  },
});
