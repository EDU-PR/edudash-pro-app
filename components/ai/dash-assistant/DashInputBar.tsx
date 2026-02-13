/**
 * DashInputBar Component
 * 
 * Input area for the Dash AI Assistant with text input, attachments, and send button.
 * Extracted from DashAssistant for better maintainability.
 */

import React from 'react';
import { View, TextInput, TouchableOpacity, ScrollView, Text, Platform, Dimensions, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { inputStyles as styles } from './styles/input.styles';
import { useTheme } from '@/contexts/ThemeContext';
import type { DashAttachment } from '@/services/dash-ai/types';
import type { AttachmentProgress } from '@/hooks/useDashAttachments';
import { getFileIconName, formatFileSize } from '@/services/AttachmentService';
import { CosmicOrb } from '@/components/dash-orb/CosmicOrb';

import EduDashSpinner from '@/components/ui/EduDashSpinner';
interface LearnerContext {
  ageBand?: string | null;
  schoolType?: string | null;
  role?: string | null;
}

interface DashInputBarProps {
  inputRef: React.RefObject<TextInput>;
  inputText: string;
  setInputText: (text: string) => void;
  enterToSend?: boolean;
  selectedAttachments: DashAttachment[];
  attachmentProgress?: Map<string, AttachmentProgress>;
  learnerContext?: LearnerContext | null;
  isLoading: boolean;
  isUploading: boolean;
  isRecording?: boolean;
  isSpeaking?: boolean;
  partialTranscript?: string;
  bottomInset?: number;
  placeholder?: string;
  messages?: any[]; // Track conversation history
  onSend: () => void;
  onMicPress: () => void;
  onTakePhoto: () => void;
  onAttachFile: () => void;
  onOpenTools?: () => void;
  onRemoveAttachment: (attachmentId: string) => void;
  onQuickAction?: (text: string) => void;
  /** Cancel an in-progress AI generation */
  onCancel?: () => void;
  /** Hide quick chips when an empty state component already shows actions */
  hideQuickChips?: boolean;
}

export const DashInputBar: React.FC<DashInputBarProps> = ({
  inputRef,
  inputText,
  setInputText,
  enterToSend = true,
  selectedAttachments,
  attachmentProgress,
  learnerContext,
  isLoading,
  isUploading,
  isRecording = false,
  isSpeaking = false,
  partialTranscript = '',
  bottomInset = 0,
  placeholder,
  messages = [],
  onSend,
  onMicPress,
  onTakePhoto,
  onAttachFile,
  onOpenTools,
  onRemoveAttachment,
  onQuickAction,
  onCancel,
  hideQuickChips = false,
}) => {
  const { theme } = useTheme();
  const { width: screenWidth } = Dimensions.get('window');
  const orbSize = screenWidth < 360 ? 42 : screenWidth < 400 ? 46 : 48;
  const orbRingSize = orbSize + 14;

  const renderAttachmentChips = () => {
    if (selectedAttachments.length === 0) return null;

    return (
      <View style={styles.attachmentChipsContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {selectedAttachments.map((attachment) => {
            // Get real-time progress from the hook
            const progress = attachmentProgress?.get(attachment.id);
            const status = progress?.status || attachment.status || 'pending';
            const uploadProgress = progress?.progress ?? attachment.uploadProgress ?? 0;
            const isImage = attachment.kind === 'image';
            const imageUri = attachment.previewUri || attachment.uri;
            
            return (
              <View 
                key={attachment.id}
                style={[
                  isImage ? styles.attachmentImageCard : styles.attachmentChip,
                  { 
                    backgroundColor: theme.surface,
                    borderColor: status === 'failed' ? theme.error : theme.border
                  }
                ]}
              >
              {/* Image preview (ChatGPT style) */}
              {isImage && imageUri ? (
                <View style={styles.attachmentImageWrapper}>
                  <Image 
                    source={{ uri: imageUri }}
                    style={styles.attachmentImagePreview}
                    resizeMode="cover"
                  />
                  {/* Overlay for status */}
                  {status === 'uploading' && (
                    <View style={[styles.attachmentImageOverlay, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
                      <EduDashSpinner size="small" color="#FFFFFF" />
                    </View>
                  )}
                  {status === 'uploaded' && (
                    <View style={[styles.attachmentImageBadge, { backgroundColor: theme.success }]}>
                      <Ionicons name="checkmark" size={12} color="#FFFFFF" />
                    </View>
                  )}
                  {status === 'failed' && (
                    <View style={[styles.attachmentImageOverlay, { backgroundColor: 'rgba(220, 38, 38, 0.8)' }]}>
                      <Ionicons name="alert-circle" size={24} color="#FFFFFF" />
                    </View>
                  )}
                  {/* Remove button */}
                  {status !== 'uploading' && (
                    <TouchableOpacity
                      style={[styles.attachmentImageRemove, { backgroundColor: theme.error }]}
                      onPress={() => onRemoveAttachment(attachment.id)}
                      accessibilityLabel={`Remove ${attachment.name}`}
                    >
                      <Ionicons name="close" size={14} color="#FFFFFF" />
                    </TouchableOpacity>
                  )}
                  {/* File size label */}
                  <View style={[styles.attachmentImageSize, { backgroundColor: 'rgba(0,0,0,0.7)' }]}>
                    <Text style={styles.attachmentImageSizeText}>
                      {formatFileSize(attachment.size)}
                    </Text>
                  </View>
                </View>
              ) : (
                /* File/document chip (original style) */
                <>
              <View style={styles.attachmentChipContent}>
                <Ionicons 
                  name={getFileIconName(attachment.kind)}
                  size={16} 
                  color={status === 'failed' ? theme.error : theme.text} 
                />
                <View style={styles.attachmentChipText}>
                  <Text 
                    style={[
                      styles.attachmentChipName, 
                      { color: status === 'failed' ? theme.error : theme.text }
                    ]}
                    numberOfLines={1}
                  >
                    {attachment.name}
                  </Text>
                  <Text style={[styles.attachmentChipSize, { color: theme.textSecondary }]}>
                    {formatFileSize(attachment.size)}
                  </Text>
                </View>
                
                {/* Progress indicator */}
                {status === 'uploading' && (
                  <View style={styles.attachmentProgressContainer}>
                    <EduDashSpinner size="small" color={theme.primary} />
                  </View>
                )}
                
                {/* Status indicator */}
                {status === 'uploaded' && (
                  <Ionicons name="checkmark-circle" size={16} color={theme.success} />
                )}
                
                {status === 'failed' && (
                  <Ionicons name="alert-circle" size={16} color={theme.error} />
                )}
                
                {/* Remove button */}
                {status !== 'uploading' && (
                  <TouchableOpacity
                    style={styles.attachmentChipRemove}
                    onPress={() => onRemoveAttachment(attachment.id)}
                    accessibilityLabel={`Remove ${attachment.name}`}
                  >
                    <Ionicons name="close" size={14} color={theme.textSecondary} />
                  </TouchableOpacity>
                )}
              </View>
              
              {/* Progress bar */}
              {status === 'uploading' && uploadProgress !== undefined && (
                <View style={[styles.attachmentProgressBar, { backgroundColor: theme.surfaceVariant }]}>
                  <View 
                    style={[
                      styles.attachmentProgressFill,
                      { 
                        backgroundColor: theme.primary,
                        width: `${uploadProgress}%`
                      }
                    ]} 
                  />
                </View>
              )}
              </>
              )}
            </View>
            );
          })}
        </ScrollView>
      </View>
    );
  };

  const hasContent = inputText.trim() || selectedAttachments.length > 0;
  const hasMessages = messages && messages.length > 0;
  // Quick chips only show once (no messages) and never alongside the empty-state component
  const canShowTutorChips = !hideQuickChips && !hasContent && !isRecording && !isLoading && !hasMessages;
  const normalizedSchool = (learnerContext?.schoolType || '').toLowerCase();
  const isPreschool = normalizedSchool.includes('preschool') || normalizedSchool.includes('ecd') || normalizedSchool.includes('early') || ['3-5', '6-8'].includes(learnerContext?.ageBand || '');

  const quickChips = isPreschool
    ? [
        { id: 'explain', label: 'Story Time', icon: 'book-outline', prompt: 'Use a short story and ask one simple question. Keep it playful and age-appropriate for preschool.' },
        { id: 'practice', label: 'Play & Learn', icon: 'color-palette-outline', prompt: 'Give one playful practice question using colors, shapes, or counting. Wait for the answer before continuing.' },
        { id: 'quiz', label: 'Quick Quiz', icon: 'happy-outline', prompt: 'Quiz with 3 very easy questions using colors, shapes, or counting. Keep it fun.' },
        { id: 'summary', label: 'Recap', icon: 'sparkles-outline', prompt: 'Summarize in 3 simple bullet points with friendly tone, then ask one short check question.' },
      ]
    : [
        { id: 'explain', label: 'Explain', icon: 'bulb-outline', prompt: 'Explain this step-by-step in simple language. Ask one diagnostic question first.' },
        { id: 'practice', label: 'Practice', icon: 'pencil-outline', prompt: 'Give me one practice question and wait for my answer before continuing.' },
        { id: 'quiz', label: 'Quiz me', icon: 'school-outline', prompt: 'Quiz me with 5 questions, starting easy and getting harder.' },
        { id: 'summary', label: 'Summarize', icon: 'sparkles-outline', prompt: 'Summarize the key ideas in 5 bullet points and ask one quick check question.' },
      ];

  return (
    <View
      style={[
        styles.inputContainer,
        {
          backgroundColor: theme.surface,
          borderTopColor: theme.border,
          paddingBottom: Math.max(12, bottomInset),
        }
      ]}
    >
      {/* Attachment chips */}
      {renderAttachmentChips()}

      {(isRecording || partialTranscript) && (
        <View style={[styles.voiceStatusRow, { backgroundColor: theme.surfaceVariant, borderColor: theme.border }]}>
          <Ionicons
            name={isRecording ? 'mic' : 'chatbubble-ellipses-outline'}
            size={16}
            color={isRecording ? theme.error : theme.primary}
          />
          <View style={styles.voiceStatusContent}>
            <Text style={[styles.voiceStatusText, { color: theme.textSecondary }]}>
              {isRecording ? 'Listening' : 'Transcript ready'}
            </Text>
            {!!partialTranscript && (
              <Text style={[styles.voiceTranscript, { color: theme.text }]} numberOfLines={3}>
                {partialTranscript}
              </Text>
            )}
            <Text style={[styles.voiceHint, { color: theme.textTertiary }]}>
              Keep speaking naturally. Dash will prepare your response as soon as you finish.
            </Text>
          </View>
        </View>
      )}

      {/* Tutor quick chips */}
      {canShowTutorChips && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tutorChipRow}
        >
          {quickChips.map((chip) => (
            <TouchableOpacity
              key={chip.id}
              style={[styles.tutorChip, { backgroundColor: theme.surfaceVariant, borderColor: theme.border }]}
              onPress={() => onQuickAction?.(chip.prompt)}
              activeOpacity={0.8}
            >
              <Ionicons name={chip.icon as any} size={14} color={theme.primary} />
              <Text style={[styles.tutorChipText, { color: theme.text }]}>{chip.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
      
      <View style={styles.inputRow}>
        {/* Input wrapper */}
        <View style={[styles.inputWrapper, { backgroundColor: theme.inputBackground, borderColor: theme.inputBorder }]}>
          <View style={styles.inputAccessoryLeft}>
            {onOpenTools && (
              <TouchableOpacity
                style={styles.inputIconButton}
                onPress={async () => {
                  try {
                    await Haptics.selectionAsync();
                  } catch {}
                  onOpenTools();
                }}
                disabled={isLoading || isUploading}
                accessibilityLabel="Open tools"
                accessibilityRole="button"
              >
                <Ionicons
                  name="construct-outline"
                  size={20}
                  color={isLoading || isUploading ? theme.textTertiary : theme.textSecondary}
                />
              </TouchableOpacity>
            )}
            {/* Attach files button (inside input like WhatsApp) */}
            <TouchableOpacity
              style={styles.inputIconButton}
              onPress={async () => {
                try {
                  await Haptics.selectionAsync();
                } catch {}
                onAttachFile();
              }}
              disabled={isLoading || isUploading}
              accessibilityLabel="Attach files"
              accessibilityRole="button"
            >
              <Ionicons
                name="attach"
                size={20}
                color={selectedAttachments.length > 0 ? theme.primary : (isLoading || isUploading ? theme.textTertiary : theme.textSecondary)}
              />
              {selectedAttachments.length > 0 && (
                <View style={[styles.attachBadgeSmall, { backgroundColor: theme.primary }]}>
                  <Text style={[styles.attachBadgeSmallText, { color: theme.onPrimary }]}>
                    {selectedAttachments.length}
                  </Text>
                </View>
              )}
            </TouchableOpacity>

            {/* Camera button (hide while typing) */}
            {inputText.trim().length === 0 && !isRecording && (
              <TouchableOpacity
                style={styles.inputIconButton}
                onPress={async () => {
                  try {
                    await Haptics.selectionAsync();
                  } catch {}
                  onTakePhoto();
                }}
                disabled={isLoading || isUploading}
                accessibilityLabel="Take photo"
                accessibilityRole="button"
              >
                <Ionicons
                  name="camera-outline"
                  size={20}
                  color={isLoading || isUploading ? theme.textTertiary : theme.textSecondary}
                />
              </TouchableOpacity>
            )}
          </View>

          <TextInput
            ref={inputRef}
            style={[
              styles.textInput,
              {
                color: theme.inputText,
              }
            ]}
            placeholder={
              isRecording
                ? "🎤 Listening... tap stop when done"
                : selectedAttachments.length > 0
                  ? "Add a message (optional)..."
                  : (placeholder || "Ask Dash anything...")
            }
            placeholderTextColor={isRecording ? theme.primary : theme.inputPlaceholder}
            value={inputText}
            onChangeText={setInputText}
            onKeyPress={(e) => {
              if (!enterToSend || Platform.OS !== 'web') return;
              const nativeEvent = (e as any)?.nativeEvent || {};
              const key = nativeEvent.key;
              const shiftKey = nativeEvent.shiftKey;
              if (key === 'Enter' && !shiftKey) {
                (e as any).preventDefault?.();
                onSend();
              }
            }}
            multiline={true}
            maxLength={500}
            editable={!isLoading && !isUploading && !isRecording}
            onSubmitEditing={undefined}
            returnKeyType={enterToSend ? 'send' : 'default'}
            blurOnSubmit={false}
          />
        </View>
        
        {/* Dash Orb (voice) */}
        <TouchableOpacity
          style={[
            styles.orbButton,
            { opacity: isLoading ? 0.6 : 1, width: orbSize + 4, height: orbSize + 4 }
          ]}
          onPress={onMicPress}
          disabled={isLoading}
          accessibilityLabel={isRecording ? "Stop recording" : "Speak to Dash"}
          accessibilityRole="button"
          activeOpacity={0.85}
        >
          <CosmicOrb size={orbSize} isProcessing={isRecording || isLoading} isSpeaking={isSpeaking} />
          <View style={[
            styles.orbPulseRing,
            { 
              width: orbRingSize,
              height: orbRingSize,
              borderRadius: orbRingSize / 2,
              borderColor: isRecording ? theme.error : theme.primary,
              opacity: isRecording ? 0.7 : 0.2,
            }
          ]} />
        </TouchableOpacity>

        {/* Stop generation button — shown when AI is generating a response */}
        {isLoading && onCancel && !hasContent && (
          <TouchableOpacity
            style={[styles.sendButton, { backgroundColor: theme.error }]}
            onPress={async () => {
              try {
                await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              } catch {}
              onCancel();
            }}
            accessibilityLabel="Stop generating"
            accessibilityRole="button"
            activeOpacity={0.7}
          >
            <Ionicons name="stop" size={20} color={theme.onPrimary || '#fff'} />
          </TouchableOpacity>
        )}

        {/* Send button */}
        {hasContent && (
          <TouchableOpacity
            style={[styles.sendButton, { backgroundColor: theme.primary, opacity: (isLoading || isUploading) ? 0.5 : 1 }]}
            onPress={async () => {
              try {
                await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              } catch {}
              onSend();
            }}
            disabled={isLoading || isUploading}
            accessibilityLabel="Send message"
            accessibilityRole="button"
            activeOpacity={0.7}
          >
            {(isLoading || isUploading) ? (
              <EduDashSpinner size="small" color={theme.onPrimary} />
            ) : (
              <Ionicons name="send" size={20} color={theme.onPrimary} />
            )}
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};
