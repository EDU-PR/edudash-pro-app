/**
 * DashAIChat - ChatGPT-Style AI Assistant Interface
 * 
 * A full-screen chat interface with:
 * - Clean message bubbles with proper markdown rendering
 * - Voice Orb for speech input/output (like ChatGPT voice mode)
 * - Azure Speech Services integration for TTS/STT
 * - Smooth animations and professional design
 * - Persistent conversation history via AsyncStorage
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { assertSupabase } from '../../../lib/supabase';
import { router } from 'expo-router';
import { styles } from './DashAIChat.styles';
import { ChatMessage, ChatMessageData } from './ChatMessage';
import { ChatInput } from './ChatInput';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DASH_WELCOME_MESSAGE, TOOL_MESSAGES } from '../../../lib/ai/constants';

// Storage keys
const CHAT_HISTORY_KEY = '@dash_ai_chat_history';
const MAX_STORED_MESSAGES = 50; // Limit to prevent storage bloat

// Conditional import for VoiceOrb
const isWeb = Platform.OS === 'web';
let VoiceOrb: React.ForwardRefExoticComponent<any> | null = null;

if (!isWeb) {
  // Only import on native platforms - use new refactored voice-orb module
  const voiceOrbModule = require('../voice-orb');
  VoiceOrb = voiceOrbModule.VoiceOrb;
}

// Import VoiceOrbRef type for the ref
type VoiceOrbRefType = {
  speakText: (text: string) => Promise<void>;
  stopSpeaking: () => Promise<void>;
  isSpeaking: boolean;
};

interface DashAIChatProps {
  /** Initial system context for the AI */
  systemContext?: string;
  /** Callback when chat is closed */
  onClose?: () => void;
  /** Show as modal or full screen */
  mode?: 'modal' | 'screen';
}

export default function DashAIChat({ 
  systemContext,
  onClose,
  mode = 'screen' 
}: DashAIChatProps) {
  const { theme } = useTheme();
  
  const [messages, setMessages] = useState<ChatMessageData[]>([]);
  const [inputText, setInputText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isVoiceMode, setIsVoiceMode] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  
  const scrollViewRef = useRef<ScrollView>(null);
  const voiceOrbRef = useRef<VoiceOrbRefType>(null);
  const isVoiceModeRef = useRef(false);

  // Welcome message content
  const welcomeMessage: ChatMessageData = {
    id: 'welcome',
    role: 'assistant',
    content: DASH_WELCOME_MESSAGE,
    timestamp: new Date(),
  };

  // Load conversation history from AsyncStorage on mount
  useEffect(() => {
    const loadChatHistory = async () => {
      try {
        const stored = await AsyncStorage.getItem(CHAT_HISTORY_KEY);
        if (stored) {
          const parsed = JSON.parse(stored) as ChatMessageData[];
          // Convert timestamp strings back to Date objects
          const messagesWithDates = parsed.map(msg => ({
            ...msg,
            timestamp: new Date(msg.timestamp),
          }));
          console.log('[DashAIChat] Loaded', messagesWithDates.length, 'messages from storage');
          
          // If history exists but doesn't start with welcome, prepend it
          if (messagesWithDates.length > 0 && messagesWithDates[0].id !== 'welcome') {
            console.log('[DashAIChat] Continuing previous conversation');
            setMessages(messagesWithDates);
          } else if (messagesWithDates.length === 0) {
            // Empty history, show welcome
            setMessages([welcomeMessage]);
          } else {
            // Already has welcome, use as-is
            setMessages(messagesWithDates);
          }
        } else {
          // No history, show welcome message
          setMessages([welcomeMessage]);
        }
      } catch (error) {
        console.error('[DashAIChat] Failed to load chat history:', error);
        setMessages([welcomeMessage]);
      } finally {
        setIsLoaded(true);
      }
    };
    
    loadChatHistory();
  }, []);

  // Save conversation history to AsyncStorage when messages change
  useEffect(() => {
    if (!isLoaded || messages.length === 0) return;
    
    const saveChatHistory = async () => {
      try {
        // Only save last N messages to prevent storage bloat
        const messagesToSave = messages.slice(-MAX_STORED_MESSAGES);
        await AsyncStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(messagesToSave));
        console.log('[DashAIChat] Saved', messagesToSave.length, 'messages to storage');
      } catch (error) {
        console.error('[DashAIChat] Failed to save chat history:', error);
      }
    };
    
    saveChatHistory();
  }, [messages, isLoaded]);

  // Clear chat and reset to welcome message
  const clearChat = useCallback(async () => {
    try {
      await AsyncStorage.removeItem(CHAT_HISTORY_KEY);
      setMessages([welcomeMessage]);
      console.log('[DashAIChat] Chat history cleared');
    } catch (error) {
      console.error('[DashAIChat] Failed to clear chat history:', error);
    }
  }, []);

  // Keep ref in sync with state for use in async functions
  useEffect(() => {
    isVoiceModeRef.current = isVoiceMode;
    console.log('[DashAIChat] Voice mode changed:', isVoiceMode);
  }, [isVoiceMode]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, [messages]);

  /**
   * Send message to the superadmin-ai Edge Function
   * WITH STREAMING for faster voice responses
   */
  const sendMessage = async (text: string) => {
    if (!text.trim() || isProcessing) return;

    const userMessage: ChatMessageData = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setIsProcessing(true);

    // Add placeholder for assistant response with loading indicator
    const assistantId = `assistant-${Date.now()}`;
    setMessages(prev => [...prev, {
      id: assistantId,
      role: 'assistant',
      content: TOOL_MESSAGES.FETCHING, // Show loading message
      timestamp: new Date(),
      isStreaming: true,
    }]);

    // Prepare history from previous messages (limit to last 10 for speed)
    const history = messages
      .filter(m => m.role === 'user' || m.role === 'assistant')
      .slice(-10) // Only last 10 messages for faster response
      .map(m => ({ role: m.role, content: m.content }));

    try {
      const supabase = assertSupabase();
      const { data: { session } } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error('Please log in to continue');
      }

      // Use streaming for voice mode, regular for text
    // Streaming enabled for voice mode to provide faster, more natural responses
    const useStreaming = isVoiceModeRef.current;      if (useStreaming) {
        // STREAMING MODE - for natural conversation
        await sendMessageStreaming(text.trim(), history, assistantId, session.access_token);
      } else {
        // REGULAR MODE - wait for full response
        await sendMessageRegular(text.trim(), history, assistantId, session.access_token);
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Something went wrong';
      
      setMessages(prev => prev.map(msg =>
        msg.id === assistantId
          ? {
              ...msg,
              content: `❌ **Error:** ${errorMessage}\n\nPlease try again.`,
              isStreaming: false,
            }
          : msg
      ));
    } finally {
      setIsProcessing(false);
    }
  };

  /**
   * Regular non-streaming message send
   */
  const sendMessageRegular = async (text: string, history: any[], assistantId: string, token: string) => {
    // Show "thinking" state
    setMessages(prev => prev.map(msg =>
      msg.id === assistantId
        ? { ...msg, content: '🤔 Thinking...', isStreaming: true }
        : msg
    ));
    
    const response = await fetch(
      `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/superadmin-ai`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          action: 'chat',
          message: text,
          history: history,
          max_tokens: 800, // Limit for faster response
        }),
      }
    );

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.error || 'Request failed');
    }

    // If tool calls were made, log but don't speak them
    if (data.tool_calls && data.tool_calls.length > 0) {
      const toolNames = data.tool_calls.map((t: any) => t.name).join(', ');
      console.log('[DashAIChat] Tools used:', toolNames);
      // Don't add tool info to response text - it will be filtered by TTS preprocessing
    }

    // Update with actual response
    setMessages(prev => prev.map(msg =>
      msg.id === assistantId
        ? {
            ...msg,
            content: data.response, // Clean response without tool metadata
            isStreaming: false,
            toolsUsed: data.tool_calls?.map((t: any) => t.name),
          }
        : msg
    ));

    // If in voice mode, speak the response (use ref to get latest value)
    console.log('[DashAIChat] Checking TTS - isVoiceModeRef:', isVoiceModeRef.current, 'hasResponse:', !!data.response);
    if (isVoiceModeRef.current && data.response) {
      console.log('[DashAIChat] Triggering TTS for response');
      speakResponse(data.response);
    }
  };

  /**
   * Streaming message send with progressive TTS
   * Starts speaking as soon as first sentence arrives
   */
  const sendMessageStreaming = async (text: string, history: any[], assistantId: string, token: string) => {
    const response = await fetch(
      `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/superadmin-ai`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          action: 'chat',
          message: text,
          history: history,
          stream: true, // Request streaming
          max_tokens: 600, // Shorter for voice (faster)
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Request failed: ${response.status}`);
    }

    // Check if streaming is supported
    if (!response.body) {
      // Fallback to regular if no streaming
      const data = await response.json();
      setMessages(prev => prev.map(msg =>
        msg.id === assistantId
          ? { ...msg, content: data.response, isStreaming: false }
          : msg
      ));
      if (data.response) speakResponse(data.response);
      return;
    }

    // Process streaming response
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullResponse = '';
    let sentenceBuffer = '';
    let hasStartedSpeaking = false;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (!line.trim() || !line.startsWith('data: ')) continue;
          
          const data = line.substring(6).trim();
          if (data === '[DONE]') continue;

            try {
            const parsed = JSON.parse(data);
            const content = parsed.delta || parsed.content || '';
            
            // Check if AI is using a tool
            if (parsed.type === 'tool_use' || parsed.tool_name) {
              const toolName = parsed.tool_name || parsed.name || 'a tool';
              console.log('[DashAIChat] AI using tool:', toolName);
              setMessages(prev => prev.map(msg =>
                msg.id === assistantId
                  ? { ...msg, content: `🔍 Searching (${toolName})...`, isStreaming: true }
                  : msg
              ));
              continue; // Don't add tool usage to response text
            }
            
            fullResponse += content;
            sentenceBuffer += content;

            // Update message progressively
            setMessages(prev => prev.map(msg =>
              msg.id === assistantId
                ? { ...msg, content: fullResponse, isStreaming: true }
                : msg
            ));            // Check if we have a complete sentence for TTS
            const sentenceEnd = /[.!?]\s/.test(sentenceBuffer);
            if (sentenceEnd && sentenceBuffer.trim().length > 20 && !hasStartedSpeaking) {
              // Start speaking first sentence ASAP
              const firstSentence = sentenceBuffer.trim();
              console.log('[DashAIChat] Starting TTS with first sentence:', firstSentence.substring(0, 50) + '...');
              speakResponse(firstSentence);
              hasStartedSpeaking = true;
              sentenceBuffer = '';
            }
          } catch (e) {
            // Skip invalid JSON
          }
        }
      }

      // Mark as complete
      setMessages(prev => prev.map(msg =>
        msg.id === assistantId
          ? { ...msg, content: fullResponse, isStreaming: false }
          : msg
      ));

      // If we haven't started speaking yet (short response), speak now
      if (!hasStartedSpeaking && fullResponse.trim()) {
        console.log('[DashAIChat] Speaking complete response');
        speakResponse(fullResponse);
      }

    } catch (error) {
      console.error('[DashAIChat] Streaming error:', error);
      throw error;
    }
  };

  /**
   * Handle voice input from VoiceOrb
   */
  const handleVoiceInput = useCallback((transcript: string) => {
    if (transcript.trim()) {
      sendMessage(transcript);
    }
  }, []);

  /**
   * Speak response using Azure TTS via VoiceOrb
   * Includes retry logic in case ref isn't ready yet
   */
  const speakResponse = useCallback(async (text: string, retryCount = 0) => {
    // Only speak if in voice mode (use ref for latest value)
    if (!isVoiceModeRef.current) {
      console.log('[DashAIChat] Skipping TTS - not in voice mode (ref:', isVoiceModeRef.current, ')');
      return;
    }
    
    // Wait for ref to be available with retry
    if (!voiceOrbRef.current) {
      if (retryCount < 3) {
        console.log('[DashAIChat] VoiceOrb ref not ready, retrying in 500ms... (attempt', retryCount + 1, ')');
        setTimeout(() => speakResponse(text, retryCount + 1), 500);
        return;
      }
      console.log('[DashAIChat] VoiceOrb ref still not available after retries, skipping TTS');
      return;
    }
    
    try {
      setIsSpeaking(true);
      console.log('[DashAIChat] Speaking response via VoiceOrb, length:', text.length);
      // Strip markdown for cleaner TTS
      const cleanText = text
        .replace(/\*\*/g, '')
        .replace(/\*/g, '')
        .replace(/#{1,6}\s/g, '')
        .replace(/`[^`]+`/g, '')
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
        .replace(/>\s/g, '')
        .trim();
      await voiceOrbRef.current.speakText(cleanText);
    } catch (error) {
      console.error('[DashAIChat] TTS error:', error);
    } finally {
      setIsSpeaking(false);
    }
  }, []); // No deps - uses refs for latest values

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <TouchableOpacity 
          onPress={onClose || (() => router.back())}
          style={styles.headerButton}
        >
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        
        <View style={styles.headerCenter}>
          <View style={[styles.headerIcon, { backgroundColor: theme.primary }]}>
            <Ionicons name="sparkles" size={18} color="#fff" />
          </View>
          <View>
            <Text style={[styles.headerTitle, { color: theme.text }]}>Dash AI</Text>
            <Text style={[styles.headerSubtitle, { color: theme.textSecondary }]}>
              {isProcessing ? 'Thinking...' : isSpeaking ? 'Speaking...' : 'Online'}
            </Text>
          </View>
        </View>
        
        <TouchableOpacity 
          style={styles.headerButton}
          onPress={clearChat}
        >
          <Ionicons name="refresh" size={22} color={theme.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* Messages */}
      <ScrollView
        ref={scrollViewRef}
        style={styles.messagesContainer}
        contentContainerStyle={styles.messagesContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {messages.map(message => (
          <ChatMessage key={message.id} message={message} />
        ))}
        <View style={{ height: 20 }} />
      </ScrollView>

      {/* Voice Mode Overlay - Only on native platforms */}
      {isVoiceMode && VoiceOrb && (
        <View style={[styles.voiceModeOverlay, { backgroundColor: theme.background + 'F5' }]}>
          <VoiceOrb
            ref={voiceOrbRef}
            isListening={isListening}
            isSpeaking={isSpeaking}
            onStartListening={() => setIsListening(true)}
            onStopListening={() => setIsListening(false)}
            onTranscript={handleVoiceInput}
            onTTSStart={() => setIsSpeaking(true)}
            onTTSEnd={() => setIsSpeaking(false)}
            autoStartListening={true}
            autoRestartAfterTTS={true}
          />
          {/* Close button for voice mode */}
          <TouchableOpacity
            style={styles.voiceModeCloseButton}
            onPress={() => setIsVoiceMode(false)}
          >
            <Ionicons name="close" size={24} color={theme.text} />
          </TouchableOpacity>
        </View>
      )}

      {/* Input Area */}
      <ChatInput
        inputText={inputText}
        setInputText={setInputText}
        onSend={() => sendMessage(inputText)}
        isProcessing={isProcessing}
        isVoiceMode={isVoiceMode}
        onToggleVoiceMode={() => setIsVoiceMode(!isVoiceMode)}
      />
    </SafeAreaView>
  );
}
