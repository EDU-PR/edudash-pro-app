/**
 * DashTutorVoiceChat - Full Screen Voice-First Tutor
 *
 * Parent/Student focused full-screen chat with:
 * - Voice Orb for STT/TTS (faster, conversational)
 * - Streaming responses for quicker feedback
 * - Language-aware responses
 * - Persistent chat history
 */

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
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
  speakText: (text: string) => Promise<void>;
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

  const scrollViewRef = useRef<ScrollView>(null);
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

  useEffect(() => {
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, [messages]);

  useEffect(() => {
    if (!isVoiceMode) {
      speechQueueRef.current = [];
      voiceOrbRef.current?.stopSpeaking?.().catch(() => {});
    }
  }, [isVoiceMode]);

  const buildTutorContext = useCallback(() => {
    const context: string[] = [];
    context.push(
      'Role: Parent/Student tutor. Use diagnose → teach → practice. Ask one short question at a time.',
      'If a learner is wrong, provide a hint and the next step instead of just the answer.',
      'Keep responses concise, interactive, and child-safe.'
    );
    if (preferredLanguage) {
      const name = findLanguageName(preferredLanguage) || preferredLanguage;
      context.push(`Preferred language: ${name} (${preferredLanguage}). Respond in ${name}.`);
    }
    return context.join('\n');
  }, [preferredLanguage]);

  const speakResponse = useCallback(async (text: string) => {
    if (!isVoiceModeRef.current) return;
    if (!voiceOrbRef.current) return;
    const cleanText = cleanForTTS(text);
    if (!cleanText) return;
    try {
      setIsSpeaking(true);
      await voiceOrbRef.current.speakText(cleanText);
    } catch (error) {
      console.error('[DashTutorVoiceChat] TTS error:', error);
    } finally {
      setIsSpeaking(false);
    }
  }, []);

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
      const cleaned = fallbackText.replace(/data:\s*/g, '').replace(/\[DONE\]/g, '').trim();
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantId
            ? { ...msg, content: cleaned, isStreaming: false }
            : msg
        )
      );
      if (isVoiceModeRef.current && cleaned) {
        enqueueSpeech(cleaned);
      }
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullResponse = '';
    let sentenceBuffer = '';

    const parseStreamDelta = (data: string) => {
      if (!data || data === '[DONE]') return '';
      try {
        const parsed = JSON.parse(data);
        if (parsed.type === 'tool_use' || parsed.tool_name) return '';
        if (typeof parsed.delta === 'string') return parsed.delta;
        if (parsed.delta && typeof parsed.delta.text === 'string') return parsed.delta.text;
        if (typeof parsed.content === 'string') return parsed.content;
        if (typeof parsed.text === 'string') return parsed.text;
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

          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantId
                ? { ...msg, content: fullResponse, isStreaming: false }
                : msg
            )
          );

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

      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantId
            ? { ...msg, content: fullResponse, isStreaming: false }
            : msg
        )
      );
    } catch (error) {
      console.error('[DashTutorVoiceChat] Streaming error:', error);
      throw error;
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
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantId
            ? { ...msg, content: `❌ ${errorMessage}`, isStreaming: false }
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
            <Ionicons name="sparkles" size={18} color="#fff" />
          </View>
          <View>
            <Text style={[styles.headerTitle, { color: theme.text }]}>Dash Tutor</Text>
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

      <ScrollView
        ref={scrollViewRef}
        style={styles.messagesContainer}
        contentContainerStyle={styles.messagesContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {messages.map((message) => (
          <ChatMessage key={message.id} message={message} />
        ))}
        <View style={{ height: 20 }} />
      </ScrollView>

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
