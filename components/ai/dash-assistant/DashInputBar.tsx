/**
 * DashInputBar Component
 * 
 * Input area for the Dash AI Assistant with text input, attachments, and send button.
 * Extracted from DashAssistant for better maintainability.
 */

import React from 'react';
import { 
  View, 
  TextInput, 
  TouchableOpacity, 
  ScrollView, 
  Text,
  ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { styles } from '../DashAssistant.styles';
import { useTheme } from '@/contexts/ThemeContext';
import type { DashAttachment } from '@/services/dash-ai/types';
import { getFileIconName, formatFileSize } from '@/services/AttachmentService';

interface DashInputBarProps {
  inputRef: React.RefObject<TextInput>;
  inputText: string;
  setInputText: (text: string) => void;
  selectedAttachments: DashAttachment[];
  isLoading: boolean;
  isUploading: boolean;
  onSend: () => void;
  onMicPress: () => void;
  onTakePhoto: () => void;
  onAttachFile: () => void;
  onRemoveAttachment: (attachmentId: string) => void;
}

export const DashInputBar: React.FC<DashInputBarProps> = ({
  inputRef,
  inputText,
  setInputText,
  selectedAttachments,
  isLoading,
  isUploading,
  onSend,
  onMicPress,
  onTakePhoto,
  onAttachFile,
  onRemoveAttachment,
}) => {
  const { theme } = useTheme();

  const renderAttachmentChips = () => {
    if (selectedAttachments.length === 0) return null;

    return (
      <View style={styles.attachmentChipsContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {selectedAttachments.map((attachment) => (
            <View 
              key={attachment.id} 
              style={[
                styles.attachmentChip,
                { 
                  backgroundColor: theme.surface,
                  borderColor: attachment.status === 'failed' ? theme.error : theme.border
                }
              ]}
            >
              <View style={styles.attachmentChipContent}>
                <Ionicons 
                  name={getFileIconName(attachment.kind)}
                  size={16} 
                  color={attachment.status === 'failed' ? theme.error : theme.text} 
                />
                <View style={styles.attachmentChipText}>
                  <Text 
                    style={[
                      styles.attachmentChipName, 
                      { color: attachment.status === 'failed' ? theme.error : theme.text }
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
                {attachment.status === 'uploading' && (
                  <View style={styles.attachmentProgressContainer}>
                    <ActivityIndicator size="small" color={theme.primary} />
                  </View>
                )}
                
                {/* Status indicator */}
                {attachment.status === 'uploaded' && (
                  <Ionicons name="checkmark-circle" size={16} color={theme.success} />
                )}
                
                {attachment.status === 'failed' && (
                  <Ionicons name="alert-circle" size={16} color={theme.error} />
                )}
                
                {/* Remove button */}
                {attachment.status !== 'uploading' && (
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
              {attachment.status === 'uploading' && attachment.uploadProgress !== undefined && (
                <View style={[styles.attachmentProgressBar, { backgroundColor: theme.surfaceVariant }]}>
                  <View 
                    style={[
                      styles.attachmentProgressFill,
                      { 
                        backgroundColor: theme.primary,
                        width: `${attachment.uploadProgress}%`
                      }
                    ]} 
                  />
                </View>
              )}
            </View>
          ))}
        </ScrollView>
      </View>
    );
  };

  const hasContent = inputText.trim() || selectedAttachments.length > 0;

  return (
    <View style={[styles.inputContainer, { backgroundColor: theme.surface, borderTopColor: theme.border }]}>
      {/* Attachment chips */}
      {renderAttachmentChips()}
      
      <View style={styles.inputRow}>
        {/* Camera button (outside input) */}
        <TouchableOpacity
          style={styles.cameraButton}
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
            size={24} 
            color={isLoading || isUploading ? theme.textTertiary : theme.textSecondary} 
          />
        </TouchableOpacity>
        
        {/* Input wrapper with paperclip inside */}
        <View style={[styles.inputWrapper, { backgroundColor: theme.inputBackground, borderColor: theme.inputBorder }]}>
          {/* Paperclip icon (inside left of input) */}
          <TouchableOpacity
            style={styles.inputLeftIcon}
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
              color={selectedAttachments.length > 0 ? theme.primary : theme.textTertiary} 
            />
            {selectedAttachments.length > 0 && (
              <View style={[styles.attachBadgeSmall, { backgroundColor: theme.primary }]}>
                <Text style={[styles.attachBadgeSmallText, { color: theme.onPrimary }]}>
                  {selectedAttachments.length}
                </Text>
              </View>
            )}
          </TouchableOpacity>
          
          <TextInput
            ref={inputRef}
            style={[
              styles.textInput,
              { 
                color: theme.inputText,
                paddingLeft: 36,
              }
            ]}
            placeholder={selectedAttachments.length > 0 ? "Add a message (optional)..." : "Ask Dash anything..."}
            placeholderTextColor={theme.inputPlaceholder}
            value={inputText}
            onChangeText={setInputText}
            multiline={true}
            maxLength={500}
            editable={!isLoading && !isUploading}
            onSubmitEditing={undefined}
            returnKeyType="default"
            blurOnSubmit={false}
          />
        </View>
        
        {/* Send or Mic button */}
        {hasContent ? (
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
              <ActivityIndicator size="small" color={theme.onPrimary} />
            ) : (
              <Ionicons name="send" size={20} color={theme.onPrimary} />
            )}
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.recordButton, { backgroundColor: theme.accent }]}
            onPress={onMicPress}
            disabled={isLoading}
            accessibilityLabel="Record voice message"
            accessibilityRole="button"
          >
            <Ionicons name="mic-outline" size={20} color={theme.onAccent} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};
