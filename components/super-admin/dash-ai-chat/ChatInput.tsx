import React, { useRef } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { styles } from './DashAIChat.styles';

interface ChatInputProps {
  inputText: string;
  setInputText: (text: string) => void;
  onSend: () => void;
  isProcessing: boolean;
  isVoiceMode: boolean;
  onToggleVoiceMode: () => void;
}

export const ChatInput: React.FC<ChatInputProps> = ({
  inputText,
  setInputText,
  onSend,
  isProcessing,
  isVoiceMode,
  onToggleVoiceMode,
}) => {
  const { theme } = useTheme();
  const inputRef = useRef<TextInput>(null);
  const isWeb = Platform.OS === 'web';

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
    >
      <View style={[styles.inputContainer, { 
        backgroundColor: theme.surface,
        borderTopColor: theme.border 
      }]}>
        {/* Voice Mode Button - Only on native platforms */}
        {!isWeb && (
          <TouchableOpacity
            style={[styles.voiceButton, { backgroundColor: isVoiceMode ? theme.primary : theme.background }]}
            onPress={onToggleVoiceMode}
          >
            <Ionicons 
              name={isVoiceMode ? 'mic' : 'mic-outline'} 
              size={22} 
              color={isVoiceMode ? '#fff' : theme.text} 
            />
          </TouchableOpacity>
        )}

        {/* Text Input */}
        <TextInput
          ref={inputRef}
          style={[styles.textInput, { 
            backgroundColor: theme.background,
            color: theme.text 
          }]}
          placeholder="Ask Dash anything..."
          placeholderTextColor={theme.textSecondary}
          value={inputText}
          onChangeText={setInputText}
          onSubmitEditing={onSend}
          returnKeyType="send"
          multiline
          maxLength={1000}
          editable={!isProcessing}
        />

        {/* Send Button */}
        <TouchableOpacity
          style={[
            styles.sendButton,
            { backgroundColor: inputText.trim() && !isProcessing ? theme.primary : theme.border }
          ]}
          onPress={onSend}
          disabled={!inputText.trim() || isProcessing}
        >
          {isProcessing ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Ionicons name="arrow-up" size={20} color="#fff" />
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};
