/**
 * DashTutorVoiceChat - Voice Chat (Simple Voice-First Interface)
 *
 * Lightweight voice-first chat for quick conversations:
 * - Voice Orb for STT/TTS with language switching
 * - Streaming responses for quicker feedback
 * - Multilingual support (English, Afrikaans, isiZulu)
 * - Persistent chat history
 * 
 * Note: This is different from full "Dash Tutor" (homework helper with image upload)
 */

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { FlashList, type FlashListRef } from '@shopify/flash-list';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { assertSupabase } from '@/lib/supabase';
import { getWelcomeMessage } from '@/lib/ai/constants';
import { formatTranscript } from '@/lib/voice/formatTranscript';
import { styles } from '@/components/super-admin/dash-ai-chat/DashAIChat.styles';
import { ChatMessage, ChatMessageData } from '@/components/super-admin/dash-ai-chat/ChatMessage';
import { ChatInput } from '@/components/super-admin/dash-ai-chat/ChatInput';
import type { SupportedLanguage } from '@/components/super-admin/voice-orb/useVoiceSTT';
import { SUPPORTED_LANGUAGES } from '@/components/super-admin/voice-orb/useVoiceSTT';

const CHAT_HISTORY_KEY = '@dash_tutor_voice_history';
const MAX_STORED_MESSAGES = 50;

const isWeb = Platform.OS === 'web';
let VoiceOrb: React.ForwardRefExoticComponent<any> | null = null;
if (!isWeb) {
  const voiceOrbModule = require('../super-admin/voice-orb');
  VoiceOrb = voiceOrbModule.VoiceOrb;
}

type VoiceOrbRefType = {
  speakText: (text: string, language?: SupportedLanguage) => Promise<void>;
  stopSpeaking: () => Promise<void>;
  isSpeaking: boolean;
};

const cleanForTTS = (text: string) =>
  text
    .replace(/\*\*/g, '')
    .replace(/\*/g, '')
    .replace(/#{1,6}\s/g, '')
    .replace(/`[^`]+`/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/>\s/g, '')
    .trim();

/**
 * Remove any raw JSON artifacts that might have slipped through
 * This is a safety net to prevent displaying technical data to users
 */
const cleanRawJSON = (text: string): string => {
  // If text looks like pure JSON, try to extract the actual message
  if (text.trim().startsWith('{') && text.includes('content_block_delta')) {
    const lines = text.split('\n');
    let extracted = '';
    
    for (const line of lines) {
      try {
        const parsed = JSON.parse(line);
        if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
          extracted += parsed.delta.text;
        } else if (parsed.delta?.text) {
          extracted += parsed.delta.text;
        } else if (parsed.text) {
          extracted += parsed.text;
        } else if (parsed.content) {
          extracted += parsed.content;
        }
      } catch {
        // Not JSON, keep as is
        if (!line.includes('content_block_delta') && !line.includes('"type"')) {
          extracted += line + '\n';
        }
      }
    }
    
    return extracted.trim() || text;
  }
  
  // Remove any inline JSON artifacts
  return text
    .replace(/\{"type":"content_block_delta"[^}]*\}/g, '')
    .replace(/\{"delta":\{"text":"[^"]*"\}\}/g, '')
    .trim();
};

const findLanguageName = (code: SupportedLanguage | null) => {
  if (!code) return null;
  const match = SUPPORTED_LANGUAGES.find((lang) => lang.code === code);
  return match?.name || code;
};

export default function DashTutorVoiceChat() {
  const { theme } = useTheme();
  const { profile } = useAuth();
  const normalizedRole = String(profile?.role || 'parent').toLowerCase();

  const [messages, setMessages] = useState<ChatMessageData[]>([]);
  const [inputText, setInputText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isVoiceMode, setIsVoiceMode] = useState(true);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [preferredLanguage, setPreferredLanguage] = useState<SupportedLanguage | null>(null);

  const listRef = useRef<FlashListRef<ChatMessageData>>(null);
  const voiceOrbRef = useRef<VoiceOrbRefType>(null);
  const isVoiceModeRef = useRef(true);
  const isSpeakingRef = useRef(false);
  const speechQueueRef = useRef<string[]>([]);

  const welcomeMessage: ChatMessageData = useMemo(() => ({
    id: 'welcome',
    role: 'assistant',
    content: getWelcomeMessage(normalizedRole),
    timestamp: new Date(),
  }), [normalizedRole]);

  useEffect(() => {
    isVoiceModeRef.current = isVoiceMode;
  }, [isVoiceMode]);

  useEffect(() => {
    isSpeakingRef.current = isSpeaking;
  }, [isSpeaking]);

  const languageLabel = useMemo(
    () => findLanguageName(preferredLanguage),
    [preferredLanguage]
  );

  useEffect(() => {
    const loadChatHistory = async () => {
      try {
        const stored = await AsyncStorage.getItem(CHAT_HISTORY_KEY);
        if (stored) {
          const parsed = JSON.parse(stored) as ChatMessageData[];
          const messagesWithDates = parsed.map((msg) => ({
            ...msg,
            timestamp: new Date(msg.timestamp),
          }));
          if (messagesWithDates.length > 0 && messagesWithDates[0].id !== 'welcome') {
            setMessages(messagesWithDates);
          } else if (messagesWithDates.length === 0) {
            setMessages([welcomeMessage]);
          } else {
            setMessages(messagesWithDates);
          }
        } else {
          setMessages([welcomeMessage]);
        }
      } catch (error) {
        console.error('[DashTutorVoiceChat] Failed to load chat history:', error);
        setMessages([welcomeMessage]);
      } finally {
        setIsLoaded(true);
      }
    };

    loadChatHistory();
  }, [welcomeMessage]);

  useEffect(() => {
    if (!isLoaded || messages.length === 0) return;
    const saveChatHistory = async () => {
      try {
        const messagesToSave = messages.slice(-MAX_STORED_MESSAGES);
        await AsyncStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(messagesToSave));
      } catch (error) {
        console.error('[DashTutorVoiceChat] Failed to save chat history:', error);
      }
    };
    saveChatHistory();
  }, [messages, isLoaded]);

  const scrollToBottom = useCallback((animated = true) => {
    // Use requestAnimationFrame for smoother, more reliable scrolling
    requestAnimationFrame(() => {
      listRef.current?.scrollToEnd({ animated });
    });
  }, []);

  useEffect(() => {
    // Scroll immediately when messages change (including "Thinking..." indicator)
    scrollToBottom(true);
  }, [messages, scrollToBottom]);

  useEffect(() => {
    if (!isVoiceMode) {
      speechQueueRef.current = [];
      voiceOrbRef.current?.stopSpeaking?.().catch(() => {});
    }
  }, [isVoiceMode]);

  const buildTutorContext = useCallback(() => {
    const context: string[] = [];
    
    // Enhanced personality and teaching approach
    context.push('You are Dash, an intelligent, friendly AI tutor for South African learners.');
    context.push('\\n**Your Teaching Style:**');
    context.push('- Patient and encouraging - celebrate small wins! 🎉');
    context.push('- Break complex topics into simple, bite-sized explanations');
    context.push('- Use the Socratic method - ask guiding questions instead of giving direct answers');
    context.push('- Provide culturally relevant examples from South African life');
    context.push('\\n**Guidelines:**');
    context.push('- Keep responses concise (2-3 short paragraphs unless explaining complex concepts)');
    context.push('- Use emojis sparingly to stay engaging 😊');
    context.push('- If learner is wrong, give hints and guide them to the answer');
    context.push("- Adapt language complexity to the learner's level");
    context.push('- Ask one question at a time, wait for response');
    context.push('- Encourage curiosity and critical thinking');
    
    if (preferredLanguage) {
      const name = findLanguageName(preferredLanguage) || preferredLanguage;
      context.push(`\\n**Language:** User prefers ${name}. Always respond in ${name}.`);
    }
    
    return context.join('\\n');
  }, [preferredLanguage]);

  const speakResponse = useCallback(async (text: string) => {
    if (!isVoiceModeRef.current) return;
    if (!voiceOrbRef.current) return;
    const cleanText = cleanForTTS(text);
    if (!cleanText) return;
    try {
      setIsSpeaking(true);
      // Pass preferred language for correct pronunciation (critical for language learning)
      await voiceOrbRef.current.speakText(cleanText, preferredLanguage || undefined);
    } catch (error) {
      console.error('[DashTutorVoiceChat] TTS error:', error);
    } finally {
      setIsSpeaking(false);
    }
  }, [preferredLanguage]);

  const processSpeechQueue = useCallback(async () => {
    if (!isVoiceModeRef.current || isSpeakingRef.current) return;
    const next = speechQueueRef.current.shift();
    if (!next) return;
    await speakResponse(next);
    if (speechQueueRef.current.length > 0) {
      processSpeechQueue();
    }
  }, [speakResponse]);

  const enqueueSpeech = useCallback((text: string) => {
    const cleanText = cleanForTTS(text);
    if (!cleanText) return;
    speechQueueRef.current.push(cleanText);
    processSpeechQueue();
  }, [processSpeechQueue]);

  const clearChat = useCallback(async () => {
    try {
      await AsyncStorage.removeItem(CHAT_HISTORY_KEY);
      setMessages([welcomeMessage]);
    } catch (error) {
      console.error('[DashTutorVoiceChat] Failed to clear chat history:', error);
    }
  }, [welcomeMessage]);

  const sendMessageRegular = async (
    text: string,
    history: ChatMessageData[],
    assistantId: string,
    token: string
  ) => {
    const payloadMessages = [
      ...history.map((msg) => ({ role: msg.role, content: msg.content })),
      { role: 'user', content: text },
    ];

    const response = await fetch(
      `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/ai-proxy`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          scope: normalizedRole || 'parent',
          service_type: 'dash_conversation',
          payload: {
            messages: payloadMessages,
            context: buildTutorContext(),
          },
          stream: false,
          enable_tools: true,
          metadata: {
            role: normalizedRole,
            source: 'dash_voice_orb',
            language: preferredLanguage || undefined,
          },
        }),
      }
    );

    const data = await response.json();
    if (!response.ok || !data?.success) {
      throw new Error(data?.message || data?.error || 'Request failed');
    }

    const responseText = data.content || data.response || '';
    setMessages((prev) =>
      prev.map((msg) =>
        msg.id === assistantId
          ? { ...msg, content: responseText, isStreaming: false }
          : msg
      )
    );

    if (isVoiceModeRef.current && responseText) {
      enqueueSpeech(responseText);
    }
  };

  const sendMessageStreaming = async (
    text: string,
    history: ChatMessageData[],
    assistantId: string,
    token: string
  ) => {
    const payloadMessages = [
      ...history.map((msg) => ({ role: msg.role, content: msg.content })),
      { role: 'user', content: text },
    ];

    const response = await fetch(
      `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/ai-proxy`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          scope: normalizedRole || 'parent',
          service_type: 'dash_conversation',
          payload: {
            messages: payloadMessages,
            context: buildTutorContext(),
          },
          stream: true,
          enable_tools: true,
          metadata: {
            role: normalizedRole,
            source: 'dash_voice_orb',
            language: preferredLanguage || undefined,
          },
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData?.message || errorData?.error || `Request failed: ${response.status}`);
    }

    if (!response.body) {
      const fallbackText = await response.text();
      // Parse the fallback text to extract actual content, not raw JSON
      let cleaned = fallbackText;
      
      // Remove SSE formatting
      cleaned = cleaned.replace(/data:\s*/g, '').replace(/\[DONE\]/g, '');
      
      // Try to parse JSON chunks and extract text
      const lines = cleaned.split('\n').filter(l => l.trim());
      let extractedText = '';
      
      for (const line of lines) {
        try {
          const parsed = JSON.parse(line);
          if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
            extractedText += parsed.delta.text;
          } else if (typeof parsed.content === 'string') {
            extractedText += parsed.content;
          } else if (typeof parsed.text === 'string') {
            extractedText += parsed.text;
          }
        } catch {
          // If not JSON, use as-is (but only if we haven't extracted anything yet)
          if (!extractedText && !line.includes('content_block_delta')) {
            extractedText = line;
          }
        }
      }
      
      const finalText = extractedText.trim() || cleaned.trim();
      const cleanedText = cleanRawJSON(finalText);
      
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantId
            ? { ...msg, content: cleanedText, isStreaming: false }
            : msg
        )
      );
      if (isVoiceModeRef.current && cleanedText) {
        enqueueSpeech(cleanedText);
      }
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullResponse = '';
    let sentenceBuffer = '';
    let pendingFlush: ReturnType<typeof setTimeout> | null = null;

    const scheduleFlush = () => {
      if (pendingFlush) return;
      pendingFlush = setTimeout(() => {
        pendingFlush = null;
        const cleanedResponse = cleanRawJSON(fullResponse);
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantId
              ? { ...msg, content: cleanedResponse, isStreaming: false }
              : msg
          )
        );
      }, 50);
    };

    const parseStreamDelta = (data: string) => {
      if (!data || data === '[DONE]') return '';
      try {
        const parsed = JSON.parse(data);
        
        // Skip tool use events
        if (parsed.type === 'tool_use' || parsed.tool_name) return '';
        
        // Handle content_block_delta format (Claude streaming)
        if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
          return parsed.delta.text;
        }
        
        // Handle other delta formats
        if (typeof parsed.delta === 'string') return parsed.delta;
        if (parsed.delta && typeof parsed.delta.text === 'string') return parsed.delta.text;
        
        // Handle direct content/text
        if (typeof parsed.content === 'string') return parsed.content;
        if (typeof parsed.text === 'string') return parsed.text;
        
        // If we see raw content_block_delta in message, it means parsing failed earlier
        // Return empty to avoid showing raw JSON
        if (parsed.type === 'content_block_delta') return '';
        
      } catch {
        return '';
      }
      return '';
    };

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

          const delta = parseStreamDelta(data);
          if (!delta) continue;

          fullResponse += delta;
          sentenceBuffer += delta;
          scheduleFlush();

          const sentenceEnd = /[.!?]\s/.test(sentenceBuffer);
          if (sentenceEnd && isVoiceModeRef.current) {
            const sentence = sentenceBuffer.trim();
            if (sentence.length > 12) {
              enqueueSpeech(sentence);
              sentenceBuffer = '';
            }
          }
        }
      }

      if (sentenceBuffer.trim() && isVoiceModeRef.current) {
        enqueueSpeech(sentenceBuffer.trim());
      }

      if (pendingFlush) {
        clearTimeout(pendingFlush);
        pendingFlush = null;
      }
      
      const cleanedResponse = cleanRawJSON(fullResponse);
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantId
            ? { ...msg, content: cleanedResponse, isStreaming: false }
            : msg
        )
      );
    } catch (error) {
      console.error('[DashTutorVoiceChat] Streaming error:', error);
      
      // If fullResponse has content, save it even if stream failed
      if (fullResponse.trim()) {
        const cleanedResponse = cleanRawJSON(fullResponse);
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantId
              ? { ...msg, content: cleanedResponse, isStreaming: false }
              : msg
          )
        );
        
        // Still try to speak if in voice mode
        if (isVoiceModeRef.current && cleanedResponse) {
          enqueueSpeech(cleanedResponse);
        }
      } else {
        // No content received, show error
        throw error;
      }
    }
  };

  const sendMessage = async (text: string) => {
    if (!text.trim() || isProcessing) return;

    const userMessage: ChatMessageData = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputText('');
    setIsProcessing(true);

    const assistantId = `assistant-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      {
        id: assistantId,
        role: 'assistant',
        content: '⏳ Thinking...',
        timestamp: new Date(),
        isStreaming: true,
      },
    ]);

    const history = messages
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .slice(-8);

    try {
      const supabase = assertSupabase();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Please log in to continue');

      if (isVoiceModeRef.current) {
        await sendMessageStreaming(text.trim(), history, assistantId, session.access_token);
      } else {
        await sendMessageRegular(text.trim(), history, assistantId, session.access_token);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Something went wrong';
      const userFriendlyMessage = errorMessage.includes('log in') 
        ? '❌ Please log in to continue chatting with Dash.'
        : errorMessage.includes('network') || errorMessage.includes('fetch')
        ? '❌ Connection issue. Please check your internet and try again.'
        : `❌ Oops! ${errorMessage}\n\nPlease try asking again, or rephrase your question.`;
      
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantId
            ? { ...msg, content: userFriendlyMessage, isStreaming: false }
            : msg
        )
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const handleVoiceInput = useCallback((transcript: string, language?: SupportedLanguage) => {
    const formatted = formatTranscript(transcript, language);
    if (language) setPreferredLanguage(language);
    if (formatted.trim()) {
      sendMessage(formatted);
    }
  }, [sendMessage]);

  const statusLabel = isProcessing
    ? 'Thinking...'
    : isListening
      ? 'Listening...'
      : isSpeaking
        ? 'Speaking...'
        : 'Ready';

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <TouchableOpacity onPress={() => clearChat()} style={styles.headerButton}>
          <Ionicons name="refresh" size={22} color={theme.textSecondary} />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <View style={[styles.headerIcon, { backgroundColor: theme.primary }]}>
            <Ionicons name="chatbubble-ellipses" size={18} color="#fff" />
          </View>
          <View>
            <Text style={[styles.headerTitle, { color: theme.text }]}>Voice Chat</Text>
            <Text style={[styles.headerSubtitle, { color: theme.textSecondary }]}>
              {languageLabel ? `${statusLabel} • ${languageLabel}` : statusLabel}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.headerButton}
          onPress={() => setIsVoiceMode((prev) => !prev)}
        >
          <Ionicons
            name={isVoiceMode ? 'mic' : 'chatbubbles-outline'}
            size={22}
            color={isVoiceMode ? theme.primary : theme.textSecondary}
          />
        </TouchableOpacity>
      </View>

      <FlashList
        ref={listRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <ChatMessage message={item} />}
        style={styles.messagesContainer}
        contentContainerStyle={styles.messagesContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        onContentSizeChange={() => scrollToBottom(true)}
        ListFooterComponent={<View style={{ height: 20 }} />}
      />

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
            autoStartListening
            autoRestartAfterTTS
          />
          <TouchableOpacity
            style={styles.voiceModeCloseButton}
            onPress={() => setIsVoiceMode(false)}
          >
            <Ionicons name="close" size={24} color={theme.text} />
          </TouchableOpacity>
        </View>
      )}

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
