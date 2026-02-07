/**
 * Dash Voice — Full-Screen ORB Experience
 *
 * The primary voice-first interface launched from the FAB.
 * - Voice STT/TTS with dynamic language switching (EN/AF/ZU)
 * - True SSE streaming for realtime text delivery
 * - Interactive answer buttons for preschoolers
 * - Media upload support (images from gallery/camera)
 * - Org/role/age-aware quick-action chips
 * - Language dropdown in header
 *
 * @module app/screens/dash-voice
 */

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  Platform,
  StyleSheet,
  Dimensions,
  KeyboardAvoidingView,
  ScrollView,
  ActivityIndicator,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { assertSupabase } from '@/lib/supabase';
import { CosmicOrb } from '@/components/dash-orb/CosmicOrb';
import { LanguageDropdown, getLanguageLabel } from '@/components/dash-orb/LanguageDropdown';
import { formatTranscript } from '@/lib/voice/formatTranscript';
import { getOrganizationType } from '@/lib/tenant/compat';
import type { SupportedLanguage } from '@/components/super-admin/voice-orb/useVoiceSTT';
import { detectInteractiveChoices, type InteractiveChoice } from '@/lib/dash-interactive-choices';
import {
  getQuickActions,
  buildSystemPrompt,
  cleanForTTS,
  cleanRawJSON,
  createStreamingRequest,
  splitForTTS,
  detectTextLanguage,
} from '@/lib/dash-voice-utils';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const ORB_SIZE = Math.min(SCREEN_WIDTH * 0.55, 220);

const isWeb = Platform.OS === 'web';
let VoiceOrb: React.ForwardRefExoticComponent<any> | null = null;
if (!isWeb) {
  const mod = require('@/components/super-admin/voice-orb');
  VoiceOrb = mod.VoiceOrb;
}

type VoiceOrbRef = {
  speakText: (text: string, language?: SupportedLanguage) => Promise<void>;
  stopSpeaking: () => Promise<void>;
  isSpeaking: boolean;
};

export default function DashVoiceScreen() {
  const { theme } = useTheme();
  const { profile } = useAuth();
  const insets = useSafeAreaInsets();
  const role = String(profile?.role || 'parent').toLowerCase();
  const orgType = getOrganizationType(profile);

  // ── State ──────────────────────────────────────────────────────────
  const [lastResponse, setLastResponse] = useState('');
  const [streamingText, setStreamingText] = useState('');
  const [inputText, setInputText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [preferredLanguage, setPreferredLanguage] = useState<SupportedLanguage>('en-ZA');
  const [attachedImage, setAttachedImage] = useState<{ uri: string; base64: string } | null>(null);
  const [showLangMenu, setShowLangMenu] = useState(false);

  // Conversation history for context (prevents redundant greetings)
  const [conversationHistory, setConversationHistory] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([]);
  const conversationHistoryRef = useRef<Array<{ role: 'user' | 'assistant'; content: string }>>([]);
  const conversationIdRef = useRef(`orb_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);

  const voiceOrbRef = useRef<VoiceOrbRef>(null);
  const isSpeakingRef = useRef(false);
  const speechQueueRef = useRef<string[]>([]);
  const activeRequestRef = useRef<{ abort: () => void } | null>(null);

  useEffect(() => { isSpeakingRef.current = isSpeaking; }, [isSpeaking]);

  // ── Barge-in: auto-stop TTS when user starts speaking ─────────────
  useEffect(() => {
    if (isListening && isSpeaking && voiceOrbRef.current) {
      voiceOrbRef.current.stopSpeaking();
      setIsSpeaking(false);
      isSpeakingRef.current = false;
      speechQueueRef.current = [];
    }
  }, [isListening, isSpeaking]);

  const quickActions = useMemo(() => getQuickActions(orgType, role), [orgType, role]);
  // Final safety net: strip any SSE artifacts that leaked into streaming/response text
  const rawDisplayed = streamingText || lastResponse;
  const displayedText = rawDisplayed && /^\s*data:\s*(\[DONE\])?\s*$/i.test(rawDisplayed)
    ? '' : rawDisplayed;
  const interactiveChoices = useMemo(
    () => (displayedText && !streamingText) ? detectInteractiveChoices(displayedText, orgType) : [],
    [displayedText, streamingText, orgType],
  );
  const langLabel = useMemo(() => getLanguageLabel(preferredLanguage), [preferredLanguage]);

  // ── TTS Queue ─────────────────────────────────────────────────────
  const speakResponse = useCallback(async (text: string) => {
    if (!voiceOrbRef.current) return;
    const clean = cleanForTTS(text);
    if (!clean) return;
    const chunks = splitForTTS(clean, 1200);
    if (chunks.length === 0) return;
    try {
      setIsSpeaking(true);
      for (const chunk of chunks) {
        if (!isSpeakingRef.current) break;
        const chunkLang = preferredLanguage || `${detectTextLanguage(chunk)}-ZA` as SupportedLanguage;
        await voiceOrbRef.current.speakText(chunk, chunkLang);
      }
    } catch { /* ignore */ } finally {
      setIsSpeaking(false);
    }
  }, [preferredLanguage]);

  const processSpeechQueue = useCallback(async () => {
    if (isSpeakingRef.current) return;
    const next = speechQueueRef.current.shift();
    if (!next) return;
    await speakResponse(next);
    if (speechQueueRef.current.length > 0) processSpeechQueue();
  }, [speakResponse]);

  const enqueueSpeech = useCallback((text: string) => {
    const clean = cleanForTTS(text);
    if (!clean) return;
    speechQueueRef.current.push(clean);
    processSpeechQueue();
  }, [processSpeechQueue]);

  // ── Media Picker ──────────────────────────────────────────────────
  const pickMedia = useCallback(async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'], allowsEditing: false, quality: 0.7, base64: true,
      });
      if (!result.canceled && result.assets[0]?.base64) {
        setAttachedImage({ uri: result.assets[0].uri, base64: result.assets[0].base64 });
      }
    } catch { /* cancelled */ }
  }, []);

  const takePhoto = useCallback(async () => {
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) return;
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: false, quality: 0.7, base64: true,
      });
      if (!result.canceled && result.assets[0]?.base64) {
        setAttachedImage({ uri: result.assets[0].uri, base64: result.assets[0].base64 });
      }
    } catch { /* cancelled */ }
  }, []);

  // ── Persist ORB messages to AsyncStorage for handoff to full chat ──
  const persistOrbMessages = useCallback(async (msgs: Array<{ role: 'user' | 'assistant'; content: string }>) => {
    try {
      const userId = profile?.id;
      if (!userId) return;
      const key = `dash:orb-session:${userId}`;
      const payload = { conversationId: conversationIdRef.current, messages: msgs, updatedAt: Date.now() };
      await AsyncStorage.setItem(key, JSON.stringify(payload));
    } catch { /* non-critical */ }
  }, [profile?.id]);

  // ── Send Message (streaming SSE) ──────────────────────────────────
  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isProcessing) return;
    activeRequestRef.current?.abort();
    setIsProcessing(true);
    setLastResponse('');
    setStreamingText('');

    // Add user message to history (use ref to avoid dependency on state)
    const updatedHistory = [...conversationHistoryRef.current, { role: 'user' as const, content: text.trim() }];
    conversationHistoryRef.current = updatedHistory;
    setConversationHistory(updatedHistory);

    try {
      const supabase = assertSupabase();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Please log in');

      const systemPrompt = buildSystemPrompt(orgType, role, preferredLanguage);
      const hasImage = !!attachedImage?.base64;
      const imageContext = hasImage
        ? '\n\nIMAGE PROCESSING: The user attached an image. Describe what you see and provide educational insights.'
        : '';
      // Send full conversation history (last 20 turns) so AI has context
      const recentHistory = updatedHistory.slice(-20);
      const payload: Record<string, any> = {
        messages: recentHistory,
        context: systemPrompt + imageContext,
      };
      if (hasImage) {
        payload.images = [{ data: attachedImage.base64, media_type: 'image/jpeg' }];
      }

      const url = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/ai-proxy`;
      const body = JSON.stringify({
        scope: role, service_type: 'dash_conversation', payload,
        stream: true, enable_tools: true,
        metadata: { role, source: 'dash_voice_orb', org_type: orgType, language: preferredLanguage || undefined, has_image: hasImage },
      });
      if (attachedImage) setAttachedImage(null);

      const req = createStreamingRequest(url, session.access_token, body,
        (accumulated) => {
          // Guard: never show raw SSE artifacts in the streaming display
          if (accumulated && !/^\s*data:\s*(\[DONE\])?\s*$/i.test(accumulated)) {
            setStreamingText(accumulated);
          }
        },
        (finalText) => {
          const cleaned = cleanRawJSON(finalText);
          // Guard: if nothing meaningful was returned, show a friendly fallback
          const isSseArtifact = !cleaned || /^\s*(data:\s*\[DONE\]|data:\s*$)/i.test(cleaned);
          const displayText = isSseArtifact
            ? 'I couldn\'t get a response. Please try again.'
            : cleaned;
          setLastResponse(displayText);
          setStreamingText('');
          setIsProcessing(false);
          // Add assistant response to history + persist
          if (displayText && !isSseArtifact) {
            const withResponse = [...updatedHistory, { role: 'assistant' as const, content: cleaned }];
            conversationHistoryRef.current = withResponse;
            setConversationHistory(withResponse);
            persistOrbMessages(withResponse);
            enqueueSpeech(cleaned);
          }
          activeRequestRef.current = null;
        },
        (error) => {
          setLastResponse(`Sorry, ${error.message}. Please try again.`);
          setStreamingText('');
          setIsProcessing(false);
          activeRequestRef.current = null;
        },
      );
      activeRequestRef.current = req;
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Something went wrong';
      setLastResponse(`Sorry, ${msg}. Please try again.`);
      setStreamingText('');
      setIsProcessing(false);
    }
  }, [isProcessing, orgType, role, preferredLanguage, attachedImage, enqueueSpeech, persistOrbMessages]);

  useEffect(() => () => { activeRequestRef.current?.abort(); }, []);

  // ── Handlers ──────────────────────────────────────────────────────
  const handleVoiceInput = useCallback((transcript: string, language?: SupportedLanguage) => {
    const formatted = formatTranscript(transcript, language);
    if (language) setPreferredLanguage(language);
    if (formatted.trim()) sendMessage(formatted);
  }, [sendMessage]);

  const handleSubmit = useCallback(() => {
    if (inputText.trim()) { sendMessage(inputText); setInputText(''); }
  }, [inputText, sendMessage]);

  const handleInteractiveAnswer = useCallback((choice: InteractiveChoice) => {
    sendMessage(choice.value);
  }, [sendMessage]);

  // ── Derived ───────────────────────────────────────────────────────
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    const name = profile?.first_name || profile?.full_name?.split(' ')[0] || '';
    const tg = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
    return name ? `${tg}, ${name}` : tg;
  }, [profile]);

  const orbSubtitle = useMemo(() => {
    if (orgType === 'preschool') return 'Your play-based learning helper';
    if (['teacher', 'principal', 'staff'].includes(role)) return 'Your teaching assistant';
    return 'Your personal tutor';
  }, [orgType, role]);

  const statusLabel = isProcessing
    ? (streamingText ? 'Streaming...' : 'Thinking...')
    : isSpeaking ? 'Speaking...'
    : isListening ? 'Always listening'
    : 'Tap the orb or speak';

  // ── Render ────────────────────────────────────────────────────────
  return (
    <View style={[s.container, { backgroundColor: theme.background }]}>
      <LanguageDropdown
        visible={showLangMenu}
        onClose={() => setShowLangMenu(false)}
        selectedLanguage={preferredLanguage}
        onSelect={setPreferredLanguage}
        theme={theme}
      />

      {/* Header */}
      <View style={[s.header, { paddingTop: insets.top + 4 }]}>
        <TouchableOpacity onPress={() => router.back()} style={s.headerBtn}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <View style={s.headerCenter}>
          <Text style={[s.headerTitle, { color: theme.text }]}>Dash</Text>
          <Text style={[s.headerSub, { color: theme.textSecondary }]}>{statusLabel}</Text>
        </View>
        <TouchableOpacity onPress={() => setShowLangMenu(true)} style={[s.langBtn, { borderColor: theme.border }]}>
          <Ionicons name="language-outline" size={16} color={theme.primary} />
          <Text style={[s.langBtnText, { color: theme.primary }]}>{langLabel}</Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView style={s.content} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={insets.top + 50}>
        <ScrollView contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <Text style={[s.greeting, { color: theme.text }]}>{greeting}</Text>
          <Text style={[s.subtitle, { color: theme.textSecondary }]}>{orbSubtitle}</Text>

          {/* ORB */}
          <View style={s.orbContainer}>
            {VoiceOrb ? (
              <VoiceOrb
                ref={voiceOrbRef}
                isListening={isListening}
                isSpeaking={isSpeaking}
                isParentProcessing={isProcessing}
                onStartListening={() => setIsListening(true)}
                onStopListening={() => setIsListening(false)}
                onTranscript={handleVoiceInput}
                onTTSStart={() => setIsSpeaking(true)}
                onTTSEnd={() => setIsSpeaking(false)}
                onLanguageChange={(lang: SupportedLanguage) => setPreferredLanguage(lang)}
                language={preferredLanguage}
                autoStartListening
                autoRestartAfterTTS
              />
            ) : (
              <CosmicOrb size={ORB_SIZE} isProcessing={isProcessing} isSpeaking={isSpeaking} />
            )}
          </View>

          {/* Processing */}
          {isProcessing && !streamingText && (
            <View style={s.processingRow}>
              <ActivityIndicator size="small" color={theme.primary} />
              <Text style={[s.processingText, { color: theme.textSecondary }]}>Thinking...</Text>
            </View>
          )}

          {/* Response */}
          {displayedText ? (
            <View style={[s.responseCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <ScrollView style={s.responseScroll} nestedScrollEnabled>
                <Text style={[s.responseText, { color: theme.text }]}>{displayedText}</Text>
              </ScrollView>
              {streamingText ? (
                <View style={s.streamingDot}><ActivityIndicator size="small" color={theme.primary} /></View>
              ) : null}
            </View>
          ) : null}

          {/* Interactive answer buttons for preschoolers */}
          {interactiveChoices.length > 0 && (
            <View style={s.interactiveRow}>
              {interactiveChoices.map((choice) => (
                <TouchableOpacity
                  key={choice.value}
                  style={[s.interactiveBtn, {
                    backgroundColor: choice.type === 'number' ? '#6366F115' : choice.type === 'color' ? '#EC489915' : '#8B5CF615',
                    borderColor: choice.type === 'number' ? '#6366F140' : choice.type === 'color' ? '#EC489940' : '#8B5CF640',
                  }]}
                  onPress={() => handleInteractiveAnswer(choice)}
                  activeOpacity={0.7}
                >
                  <Text style={[s.interactiveBtnText, {
                    color: choice.type === 'number' ? '#6366F1' : choice.type === 'color' ? '#EC4899' : '#8B5CF6',
                    fontSize: choice.type === 'number' ? 28 : 16,
                  }]}>{choice.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Quick actions */}
          {!displayedText && !isProcessing && (
            <View style={s.quickActions}>
              {quickActions.map((action) => (
                <TouchableOpacity
                  key={action.id}
                  style={[s.quickChip, { borderColor: theme.border, backgroundColor: theme.surface }]}
                  onPress={() => sendMessage(action.prompt)}
                  activeOpacity={0.7}
                >
                  <Ionicons name={action.icon as any} size={18} color={theme.primary} />
                  <Text style={[s.quickChipText, { color: theme.text }]}>{action.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Full chat link */}
          <TouchableOpacity style={s.fullChatLink} onPress={() => {
            // Pass ORB conversation to full chat so messages carry over
            const history = conversationHistoryRef.current;
            const lastMsg = history.length > 0 ? history[history.length - 1] : null;
            const params: Record<string, string> = {};
            if (lastMsg?.role === 'user') params.initialMessage = lastMsg.content;
            router.push({ pathname: '/screens/dash-assistant', params });
          }}>
            <Ionicons name="chatbubble-ellipses-outline" size={16} color={theme.primary} />
            <Text style={[s.fullChatText, { color: theme.primary }]}>Open full chat</Text>
          </TouchableOpacity>
        </ScrollView>

        {/* Attached image */}
        {attachedImage && (
          <View style={[s.attachPreview, { borderTopColor: theme.border }]}>
            <Image source={{ uri: attachedImage.uri }} style={s.attachThumb} />
            <Text style={[s.attachLabel, { color: theme.textSecondary }]} numberOfLines={1}>Image attached</Text>
            <TouchableOpacity onPress={() => setAttachedImage(null)} style={s.attachRemove}>
              <Ionicons name="close-circle" size={20} color={theme.error || '#ef4444'} />
            </TouchableOpacity>
          </View>
        )}

        {/* Input bar */}
        <View style={[s.inputBar, { backgroundColor: theme.background, paddingBottom: Math.max(insets.bottom, 4) }]}>
          <TouchableOpacity onPress={pickMedia} onLongPress={takePhoto} style={s.mediaBtn} activeOpacity={0.7}>
            <Ionicons name="image-outline" size={22} color={theme.primary} />
          </TouchableOpacity>
          <TextInput
            style={[s.textInput, { color: theme.text, borderColor: theme.border, backgroundColor: theme.surface }]}
            placeholder="Type a message..."
            placeholderTextColor={theme.textSecondary}
            value={inputText}
            onChangeText={setInputText}
            onSubmitEditing={handleSubmit}
            returnKeyType="send"
            editable={!isProcessing}
            multiline={false}
          />
          <TouchableOpacity
            style={[s.sendBtn, { backgroundColor: inputText.trim() ? theme.primary : theme.surface }]}
            onPress={handleSubmit}
            disabled={!inputText.trim() || isProcessing}
          >
            <Ionicons name="send" size={18} color={inputText.trim() ? '#fff' : theme.textSecondary} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

// ── Styles ──────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingBottom: 6, gap: 8 },
  headerBtn: { padding: 8 },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  headerSub: { fontSize: 12, marginTop: 1 },
  langBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16, borderWidth: 1 },
  langBtnText: { fontSize: 12, fontWeight: '700' },
  content: { flex: 1 },
  scrollContent: { alignItems: 'center', paddingHorizontal: 20, paddingBottom: 8, flexGrow: 1 },
  greeting: { fontSize: 22, fontWeight: '700', marginTop: 12, textAlign: 'center' },
  subtitle: { fontSize: 14, marginTop: 4, marginBottom: 16, textAlign: 'center' },
  orbContainer: { alignItems: 'center', justifyContent: 'center', marginBottom: 16, minHeight: ORB_SIZE + 40 },
  processingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  processingText: { fontSize: 14 },
  responseCard: { borderRadius: 16, borderWidth: 1, padding: 16, width: '100%', maxHeight: 200, marginBottom: 12 },
  responseScroll: { maxHeight: 168 },
  responseText: { fontSize: 15, lineHeight: 22 },
  streamingDot: { position: 'absolute', bottom: 8, right: 12 },
  interactiveRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 12, marginBottom: 16, paddingHorizontal: 8 },
  interactiveBtn: { minWidth: 64, minHeight: 54, paddingHorizontal: 18, paddingVertical: 12, borderRadius: 16, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  interactiveBtnText: { fontWeight: '800', textAlign: 'center' },
  quickActions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 10, marginBottom: 12 },
  quickChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 24, borderWidth: 1 },
  quickChipText: { fontSize: 14, fontWeight: '600' },
  fullChatLink: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6 },
  fullChatText: { fontSize: 13, fontWeight: '600' },
  attachPreview: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 6, borderTopWidth: 1, gap: 8 },
  attachThumb: { width: 40, height: 40, borderRadius: 8 },
  attachLabel: { flex: 1, fontSize: 13 },
  attachRemove: { padding: 4 },
  inputBar: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 8, paddingTop: 6 },
  mediaBtn: { padding: 8 },
  textInput: { flex: 1, borderRadius: 24, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 10, fontSize: 15 },
  sendBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
});
