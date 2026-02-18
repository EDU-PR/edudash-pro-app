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
import { router, useFocusEffect } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { assertSupabase } from '@/lib/supabase';
import { track } from '@/lib/analytics';
import { buildDashTurnTelemetry, createDashTurnId } from '@/lib/dash-ai/turnTelemetry';
import { getFeatureFlagsSync } from '@/lib/featureFlags';
import { classifyFullChatIntent } from '@/lib/dash-ai/fullChatIntent';
import { trackTutorFullChatHandoff } from '@/lib/ai/trackingEvents';
import { CosmicOrb } from '@/components/dash-orb/CosmicOrb';
import HomeworkScanner, { type HomeworkScanResult } from '@/components/ai/HomeworkScanner';
import { LanguageDropdown, getLanguageLabel } from '@/components/dash-orb/LanguageDropdown';
import { formatTranscript } from '@/lib/voice/formatTranscript';
import { getOrganizationType } from '@/lib/tenant/compat';
import type { SupportedLanguage } from '@/components/super-admin/voice-orb/useVoiceSTT';
import { resolveDashPolicy } from '@/lib/dash-ai/DashPolicyResolver';
import { resolveAIProxyScopeFromRole } from '@/lib/ai/aiProxyScope';
import { shouldGreetToday, buildDynamicGreeting } from '@/lib/ai/greetingManager';
import {
  buildSystemPrompt,
  buildVoicePlaybackText,
  cleanForTTS,
  cleanRawJSON,
  createStreamingRequest,
} from '@/lib/dash-voice-utils';

import { shouldUsePhonicsMode, detectPhonicsIntent } from '@/lib/dash-ai/phonicsDetection';
import { detectOCRTask, isOCRIntent, getOCRPromptForTask } from '@/lib/dash-ai/ocrPrompts';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const ORB_SIZE = Math.min(SCREEN_WIDTH * 0.78, 320);

const isWeb = Platform.OS === 'web';
let VoiceOrb: React.ForwardRefExoticComponent<any> | null = null;
if (!isWeb) {
  const mod = require('@/components/super-admin/voice-orb');
  VoiceOrb = mod.VoiceOrb;
}

type VoiceOrbRef = {
  speakText: (text: string, language?: SupportedLanguage, options?: { phonicsMode?: boolean }) => Promise<void>;
  stopSpeaking: () => Promise<void>;
  stopListening?: () => Promise<void>;
  isSpeaking: boolean;
};

export default function DashVoiceScreen() {
  const { theme } = useTheme();
  const { user, profile } = useAuth();
  const insets = useSafeAreaInsets();
  const role = String(profile?.role || 'guest').toLowerCase();
  const aiScope = useMemo(() => resolveAIProxyScopeFromRole(role), [role]);
  const orgType = getOrganizationType(profile);
  const dashPolicy = useMemo(
    () =>
      resolveDashPolicy({
        profile: profile || null,
        role,
        orgType,
        learnerContext: {
          ageBand: (profile as any)?.age_group || null,
          grade: (profile as any)?.grade_level || null,
        },
      }),
    [orgType, profile, role]
  );

  // ── State ──────────────────────────────────────────────────────────
  const [lastResponse, setLastResponse] = useState('');
  const [streamingText, setStreamingText] = useState('');
  const [inputText, setInputText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voiceErrorBanner, setVoiceErrorBanner] = useState<string | null>(null);
  const [preferredLanguage, setPreferredLanguage] = useState<SupportedLanguage>('en-ZA');
  const [attachedImage, setAttachedImage] = useState<{ uri: string; base64: string } | null>(null);
  const [scannerVisible, setScannerVisible] = useState(false);
  const [showLangMenu, setShowLangMenu] = useState(false);
  const [isGreetingLoading, setIsGreetingLoading] = useState(true);
  const [showTranscript, setShowTranscript] = useState(false);
  const [liveUserTranscript, setLiveUserTranscript] = useState('');
  const [lastUserTranscript, setLastUserTranscript] = useState('');

  // Conversation history for context (prevents redundant greetings)
  const [conversationHistory, setConversationHistory] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([]);
  const conversationHistoryRef = useRef<Array<{ role: 'user' | 'assistant'; content: string }>>([]);
  const conversationIdRef = useRef(`orb_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);

  const voiceOrbRef = useRef<VoiceOrbRef>(null);
  const inputRef = useRef<TextInput>(null);
  const ccScrollRef = useRef<ScrollView>(null);
  const isSpeakingRef = useRef(false);
  const speechQueueRef = useRef<string[]>([]);
  const activeRequestRef = useRef<{ abort: () => void } | null>(null);
  const DASH_TRACE_ENABLED = __DEV__ || process.env.EXPO_PUBLIC_DASH_VOICE_TRACE === 'true';

  // Streaming-to-speech can sound choppy on mobile because each sentence becomes a separate TTS request.
  // Keep it opt-in; default is final-response TTS for smoother playback.
  const STREAMING_TTS_ENABLED = process.env.EXPO_PUBLIC_DASH_VOICE_STREAMING_TTS === 'true';
  const streamedPrefixQueuedRef = useRef('');
  const streamedHasQueuedRef = useRef(false);
  const streamedLastQueuedAtRef = useRef(0);

  const logDashTrace = useCallback((event: string, payload?: Record<string, unknown>) => {
    if (!DASH_TRACE_ENABLED) return;
    console.log(`[DashVoiceTrace] ${event}`, payload || {});
  }, [DASH_TRACE_ENABLED]);

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

  // ── Instant greeting: no AI round-trip for ChatGPT-like speed ─────
  // Skip AI greeting upgrade — local greeting is immediate; AI upgrade added latency.
  const hasGreetedRef = useRef(false);
  useEffect(() => {
    if (hasGreetedRef.current) return;
    if (conversationHistoryRef.current.length > 0) return;
    hasGreetedRef.current = true;

    const name = profile?.first_name || profile?.full_name?.split(' ')[0] || '';

    (async () => {
      const shouldGreet = await shouldGreetToday(user?.id);
      const opener = shouldGreet
        ? buildDynamicGreeting({ userName: name || null, role, orgType, language: preferredLanguage })
        : (name ? `Hey ${name}, what can I help with?` : 'What can I help with?');

      const hist = [{ role: 'assistant' as const, content: opener }];
      conversationHistoryRef.current = hist;
      setConversationHistory(hist);
      setLastResponse(opener);
      setIsGreetingLoading(false);
    })();
  }, [orgType, preferredLanguage, profile?.first_name, profile?.full_name, role, user?.id]);

  const quickActions = useMemo(() => dashPolicy.quickActions, [dashPolicy.quickActions]);
  const rawDisplayed = streamingText || lastResponse;
  const displayedText = rawDisplayed && /^\s*data:\s*(\[DONE\])?\s*$/i.test(rawDisplayed)
    ? '' : rawDisplayed;
  const langLabel = useMemo(() => getLanguageLabel(preferredLanguage), [preferredLanguage]);

  // ── TTS Queue ─────────────────────────────────────────────────────
  const speakResponse = useCallback(async (text: string) => {
    if (!voiceOrbRef.current) return;
    // Detect phonics BEFORE cleaning so slash markers are preserved.
    const phonicsMode = shouldUsePhonicsMode(text, { organizationType: orgType });
    const clean = cleanForTTS(text, { phonicsMode });
    if (!clean) return;
    try {
      isSpeakingRef.current = true;
      setIsSpeaking(true);
      // FIXED: Always use the user's selected language — never auto-detect from text.
      // Text detection caused voice-switching mid-response when AI used SA loanwords.
      const chunkLang = preferredLanguage || 'en-ZA';
      await voiceOrbRef.current.speakText(clean, chunkLang, { phonicsMode });
    } catch { /* ignore */ } finally {
      isSpeakingRef.current = false;
      setIsSpeaking(false);
    }
  }, [preferredLanguage, orgType]);

  const processSpeechQueue = useCallback(async () => {
    if (isSpeakingRef.current) return;
    const next = speechQueueRef.current.shift();
    if (!next) return;
    await speakResponse(next);
    if (speechQueueRef.current.length > 0) processSpeechQueue();
  }, [speakResponse]);

  const enqueueSpeech = useCallback((text: string) => {
    // Push raw text — speakResponse handles phonics detection + cleaning
    if (!text?.trim()) return;
    speechQueueRef.current.push(text.trim());
    processSpeechQueue();
  }, [processSpeechQueue]);

  const longestCommonPrefixLen = useCallback((a: string, b: string) => {
    const max = Math.min(a.length, b.length);
    let i = 0;
    for (; i < max; i += 1) {
      if (a[i] !== b[i]) break;
    }
    return i;
  }, []);

  const findSpeakBoundaryIndex = useCallback((text: string) => {
    if (!text) return -1;
    // Prefer sentence-ending punctuation for "speak-while-streaming".
    const sentence = /[.!?](?=\s|$)/.exec(text);
    if (sentence) return sentence.index;

    // Soft boundaries that are still safe to speak on (faster perceived latency).
    const soft = /[\n;:](?=\s|$)/.exec(text);
    if (soft) return soft.index;

    // Commas are only safe if we already have enough context.
    if (text.length > 50) {
      const comma = /,(?=\s)/.exec(text);
      if (comma) return comma.index;
    }

    // Fallback: if the model streams long clauses without punctuation, speak an early phrase.
    const hardMax = 140;
    if (text.length > hardMax) {
      const slice = text.slice(0, hardMax);
      const lastSpace = Math.max(slice.lastIndexOf(' '), slice.lastIndexOf('\n'));
      if (lastSpace > 40) return lastSpace;
      return hardMax;
    }
    return -1;
  }, []);

  const resetStreamingSpeech = useCallback(() => {
    streamedPrefixQueuedRef.current = '';
    streamedHasQueuedRef.current = false;
    streamedLastQueuedAtRef.current = 0;
  }, []);

  const maybeEnqueueStreamingSpeech = useCallback((accumulated: string) => {
    if (!STREAMING_TTS_ENABLED) return;
    if (!accumulated) return;

    const full = accumulated;
    const prev = streamedPrefixQueuedRef.current;

    let delta = '';
    if (!prev) {
      delta = full;
    } else if (full.startsWith(prev)) {
      delta = full.slice(prev.length);
    } else {
      const lcp = longestCommonPrefixLen(full, prev);
      streamedPrefixQueuedRef.current = full.slice(0, lcp);
      delta = full.slice(lcp);
    }

    if (delta.trim().length < 5) return;
    // Only speak on sentence-ending punctuation (. ! ?) during stream to avoid choppy one-chunk-at-a-time TTS.
    const sentenceEnd = /[.!?](?=\s|$)/.exec(delta);
    const boundaryIdx = sentenceEnd ? sentenceEnd.index : -1;
    if (boundaryIdx < 0) return;

    const rawChunk = delta.slice(0, boundaryIdx + 1);
    const speakChunk = rawChunk.trim();
    if (!speakChunk) return;

    // Require a minimum phrase length so we don't queue many tiny utterances (e.g. "Yes." "Okay.").
    const MIN_STREAMING_PHRASE_CHARS = 35;
    if (speakChunk.length < MIN_STREAMING_PHRASE_CHARS) return;

    if (/\/[a-z]*$/i.test(speakChunk) || /^[a-z]*\//i.test(speakChunk)) return;

    // Throttle: avoid queueing another phrase too soon or too short (reduces choppiness on native).
    const now = Date.now();
    const throttleMs = 400;
    const minCharsToBypassThrottle = 60;
    if (now - streamedLastQueuedAtRef.current < throttleMs && speakChunk.length < minCharsToBypassThrottle) return;
    streamedLastQueuedAtRef.current = now;

    streamedHasQueuedRef.current = true;
    streamedPrefixQueuedRef.current = `${streamedPrefixQueuedRef.current}${rawChunk}`;
    enqueueSpeech(speakChunk);
  }, [STREAMING_TTS_ENABLED, enqueueSpeech, longestCommonPrefixLen]);

  const handleVoiceError = useCallback((message: string) => {
    const normalized = String(message || '').toLowerCase();
    if (!normalized) return;
    if (normalized.includes('network_retrying')) {
      setVoiceErrorBanner('I lost connection for a moment. Retrying listening now...');
      return;
    }
    if (normalized.includes('phonics') && normalized.includes('cloud tts')) {
      setVoiceErrorBanner('Phonics voice needs Azure cloud TTS. It is currently unavailable, so letter sounds may fail.');
      return;
    }
    if (normalized.includes('service_unconfigured') || normalized.includes('502')) {
      setVoiceErrorBanner('Azure voice is unavailable right now. Check tts-proxy Azure secrets/config.');
      return;
    }
    if (normalized.includes('network') || normalized.includes('timeout') || normalized.includes('fetch')) {
      setVoiceErrorBanner('Voice recognition needs a stable connection. Check internet and try again.');
      return;
    }
    setVoiceErrorBanner('Voice encountered an error. Please try again.');
  }, []);

  // ── Media Picker ──────────────────────────────────────────────────
  const pickMedia = useCallback(async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'], allowsEditing: true, quality: 0.7, base64: true,
      });
      if (!result.canceled && result.assets[0]?.base64) {
        setAttachedImage({ uri: result.assets[0].uri, base64: result.assets[0].base64 });
      }
    } catch { /* cancelled */ }
  }, []);

  const takePhoto = useCallback(async () => {
    setScannerVisible(true);
  }, []);

  const handleScannerScanned = useCallback((result: HomeworkScanResult) => {
    if (!result?.base64) return;
    setAttachedImage({
      uri: result.uri,
      base64: result.base64,
    });
    setScannerVisible(false);
  }, []);

  // ── Persist ORB messages to AsyncStorage for handoff to full chat ──
  const persistOrbMessages = useCallback(async (msgs: Array<{ role: 'user' | 'assistant'; content: string }>) => {
    try {
      const userId = user?.id || profile?.id;
      if (!userId) return;
      const key = `dash:orb-session:${userId}`;
      const payload = { conversationId: conversationIdRef.current, messages: msgs, updatedAt: Date.now() };
      await AsyncStorage.setItem(key, JSON.stringify(payload));
    } catch { /* non-critical */ }
  }, [profile?.id, user?.id]);

  // ── Send Message (streaming SSE) ──────────────────────────────────
  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isProcessing) return;

    const flags = getFeatureFlagsSync();
    const handoffIntent = flags.dash_tutor_auto_handoff_v1 ? classifyFullChatIntent(trimmed) : null;
    if (handoffIntent) {
      const history = conversationHistoryRef.current;
      await persistOrbMessages(history);
      trackTutorFullChatHandoff({
        intent: handoffIntent,
        source: 'dash_voice',
        role,
      });
      router.push({
        pathname: '/screens/dash-assistant',
        params: {
          source: 'orb',
          initialMessage: trimmed,
          resumePrompt: trimmed,
          mode: handoffIntent === 'quiz' ? 'tutor' : 'advisor',
          tutorMode: handoffIntent === 'quiz' ? 'quiz' : undefined,
          handoffIntent,
        },
      });
      return;
    }

    const turnId = createDashTurnId('dash_voice_turn');
    const turnStartedAt = Date.now();
    const turnTelemetryBase = buildDashTurnTelemetry({
      conversationId: conversationIdRef.current,
      turnId,
      mode: 'orb',
      tier: String((profile as any)?.subscription_tier || '').trim() || null,
      voiceProvider: 'voice_orb',
      fallbackReason: 'none',
      source: 'dash-voice.sendMessage',
    });
    track('dash.turn.started', turnTelemetryBase);
    logDashTrace('turn_started', {
      turnId,
      role,
      orgType,
      language: preferredLanguage,
      inputChars: trimmed.length,
      inputPreview: trimmed.slice(0, 140),
      hasImage: !!attachedImage?.base64,
    });
    activeRequestRef.current?.abort();
    resetStreamingSpeech();
    speechQueueRef.current = [];
    setIsProcessing(true);
    setLastResponse('');
    setStreamingText('Got it. Let me work on that now...');

    // Add user message to history (use ref to avoid dependency on state)
    const updatedHistory = [...conversationHistoryRef.current, { role: 'user' as const, content: trimmed }];
    conversationHistoryRef.current = updatedHistory;
    setConversationHistory(updatedHistory);

    try {
      const supabase = assertSupabase();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Please log in');

      // Only include the full phonics prompt block if the conversation mentions phonics
      const recentText = updatedHistory.slice(-4).map(m => m.content).join(' ');
      const phonicsActive = detectPhonicsIntent(trimmed) || detectPhonicsIntent(recentText);
      const systemPrompt =
        buildSystemPrompt(orgType, role, preferredLanguage, { phonicsActive }) +
        '\n\n' +
        dashPolicy.systemPromptAddendum;
      const hasImage = !!attachedImage?.base64;
      const ocrTask = hasImage ? detectOCRTask(trimmed) : null;
      const ocrMode = hasImage && (isOCRIntent(trimmed) || ocrTask !== null);
      const imageContext = hasImage
        ? '\n\nIMAGE PROCESSING: The user attached an image. Describe what you see and provide educational insights.'
        : '';
      const ocrContext = ocrMode
        ? `\n\n${getOCRPromptForTask(ocrTask || 'document')}`
        : '';
      // Send full conversation history (last 20 turns) so AI has context
      const recentHistory = updatedHistory.slice(-20);
      const payload: Record<string, any> = {
        messages: recentHistory,
        context: systemPrompt + imageContext + ocrContext,
      };
      if (hasImage) {
        payload.images = [{ data: attachedImage.base64, media_type: 'image/jpeg' }];
      }
      if (ocrMode) {
        payload.ocr_mode = true;
        payload.ocr_task = ocrTask || 'document';
        payload.ocr_response_format = 'json';
      }

      const url = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/ai-proxy`;
      const bodyPayload = {
        scope: aiScope,
        service_type: ocrMode ? 'image_analysis' : 'dash_conversation',
        payload,
        stream: !ocrMode, enable_tools: true,
        metadata: {
          role,
          source: 'dash_voice_orb',
          org_type: orgType,
          dash_mode: dashPolicy.defaultMode,
          language: preferredLanguage || undefined,
          has_image: hasImage,
          ocr_mode: ocrMode,
          ocr_task: ocrTask || undefined,
        },
      };
      const body = JSON.stringify(bodyPayload);
      if (attachedImage) setAttachedImage(null);

      if (ocrMode) {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body,
        });
        const data = await response.json().catch(() => ({} as Record<string, any>));
        if (!response.ok) {
          throw new Error(String(data?.error || data?.message || `Request failed (${response.status})`));
        }

        const ocr = data?.ocr;
        const content = typeof data?.content === 'string'
          ? data.content
          : typeof ocr?.analysis === 'string'
            ? ocr.analysis
            : '';
        const cleaned = cleanRawJSON(content);
        const displayText = cleaned || 'I analyzed the image but did not find readable text.';
        logDashTrace('ocr_response', {
          turnId,
          responseChars: displayText.length,
          responsePreview: displayText.slice(0, 160),
          ocrTask: ocrTask || 'document',
        });
        setLastResponse(displayText);
        setStreamingText('');
        setIsProcessing(false);
        if (displayText) {
          const withResponse = [...updatedHistory, { role: 'assistant' as const, content: displayText }];
          conversationHistoryRef.current = withResponse;
          setConversationHistory(withResponse);
          persistOrbMessages(withResponse);
          const spoken = buildVoicePlaybackText(displayText, { maxChars: 220, maxSentences: 2 });
          enqueueSpeech(spoken || displayText);
        }
        track(
          'dash.turn.completed',
          buildDashTurnTelemetry({
            ...turnTelemetryBase,
            latencyMs: Date.now() - turnStartedAt,
          })
        );
        activeRequestRef.current = null;
        return;
      }

      let firstChunkAt: number | null = null;
      let lastProgressLogAt = 0;
      const req = createStreamingRequest(url, session.access_token, body,
        (accumulated) => {
          if (firstChunkAt === null) {
            firstChunkAt = Date.now();
            logDashTrace('stream_first_chunk', {
              turnId,
              firstTokenLatencyMs: firstChunkAt - turnStartedAt,
            });
          }
          const now = Date.now();
          if (now - lastProgressLogAt > 900) {
            lastProgressLogAt = now;
            logDashTrace('stream_progress', {
              turnId,
              chars: accumulated.length,
              elapsedMs: now - turnStartedAt,
            });
          }
          // Guard: never show raw SSE artifacts in the streaming display
          if (accumulated && !/^\s*data:\s*(\[DONE\])?\s*$/i.test(accumulated)) {
            setStreamingText(accumulated);
            maybeEnqueueStreamingSpeech(accumulated);
          }
        },
        (finalText) => {
          const cleaned = cleanRawJSON(finalText);
          // Guard: if nothing meaningful was returned, show a friendly fallback
          const isSseArtifact = !cleaned || /^\s*(data:\s*\[DONE\]|data:\s*$)/i.test(cleaned);
          const displayText = isSseArtifact
            ? 'I couldn\'t get a response. Please try again.'
            : cleaned;
          logDashTrace('stream_done', {
            turnId,
            latencyMs: Date.now() - turnStartedAt,
            chars: displayText.length,
            preview: displayText.slice(0, 160),
            artifact: isSseArtifact,
          });
          setLastResponse(displayText);
          setStreamingText('');
          setIsProcessing(false);
          // Add assistant response to history + persist
          if (displayText && !isSseArtifact) {
            const withResponse = [...updatedHistory, { role: 'assistant' as const, content: cleaned }];
            conversationHistoryRef.current = withResponse;
            setConversationHistory(withResponse);
            persistOrbMessages(withResponse);
            if (STREAMING_TTS_ENABLED) {
              const lcp = longestCommonPrefixLen(cleaned, streamedPrefixQueuedRef.current);
              const remaining = cleaned.slice(lcp).trim();
              if (remaining) enqueueSpeech(remaining);
            } else {
              const spoken = buildVoicePlaybackText(cleaned, { maxChars: 220, maxSentences: 2 });
              if (spoken.length < cleaned.length) {
                logDashTrace('tts_compact_playback', {
                  turnId,
                  fullChars: cleaned.length,
                  spokenChars: spoken.length,
                });
              }
              enqueueSpeech(spoken || cleaned);
            }
          }
          track(
            'dash.turn.completed',
            buildDashTurnTelemetry({
              ...turnTelemetryBase,
              latencyMs: Date.now() - turnStartedAt,
            })
          );
          activeRequestRef.current = null;
        },
        (error) => {
          logDashTrace('stream_error', {
            turnId,
            latencyMs: Date.now() - turnStartedAt,
            message: error.message,
          });
          resetStreamingSpeech();
          setLastResponse(`Sorry, ${error.message}. Please try again.`);
          setStreamingText('');
          setIsProcessing(false);
          track('dash.turn.failed', {
            ...buildDashTurnTelemetry({
              ...turnTelemetryBase,
              latencyMs: Date.now() - turnStartedAt,
            }),
            error: error.message,
          });
          activeRequestRef.current = null;
        },
      );
      activeRequestRef.current = req;
    } catch (error) {
      resetStreamingSpeech();
      const msg = error instanceof Error ? error.message : 'Something went wrong';
      logDashTrace('turn_error', {
        turnId,
        latencyMs: Date.now() - turnStartedAt,
        message: msg,
      });
      setLastResponse(`Sorry, ${msg}. Please try again.`);
      setStreamingText('');
      setIsProcessing(false);
      track('dash.turn.failed', {
        ...buildDashTurnTelemetry({
          ...turnTelemetryBase,
          latencyMs: Date.now() - turnStartedAt,
        }),
        error: msg,
      });
    }
  }, [
    isProcessing,
    orgType,
    role,
    aiScope,
    preferredLanguage,
    attachedImage,
    enqueueSpeech,
    maybeEnqueueStreamingSpeech,
    resetStreamingSpeech,
    longestCommonPrefixLen,
    logDashTrace,
    persistOrbMessages,
    profile,
    dashPolicy.defaultMode,
    dashPolicy.systemPromptAddendum,
    STREAMING_TTS_ENABLED,
  ]);

  // Stop Dash (TTS + request + queue) when leaving screen or on unmount
  const stopDashActivity = useCallback(() => {
    activeRequestRef.current?.abort();
    activeRequestRef.current = null;
    speechQueueRef.current = [];
    resetStreamingSpeech();
    isSpeakingRef.current = false;
    setIsSpeaking(false);
    setIsProcessing(false);
    setStreamingText('');
    voiceOrbRef.current?.stopSpeaking?.().catch(() => {});
  }, [resetStreamingSpeech]);

  useFocusEffect(
    useCallback(() => {
      return () => {
        stopDashActivity();
      };
    }, [stopDashActivity])
  );

  useEffect(() => () => {
    activeRequestRef.current?.abort();
    stopDashActivity();
  }, [stopDashActivity]);

  // ── Handlers ──────────────────────────────────────────────────────
  const handleVoiceInput = useCallback((transcript: string, language?: SupportedLanguage) => {
    // Guard against ORB hearing its own TTS output during brief state races.
    if (isSpeakingRef.current || isSpeaking || isProcessing) {
      logDashTrace('voice_input_ignored', {
        reason: isSpeakingRef.current || isSpeaking ? 'speaking' : 'processing',
        language: language || preferredLanguage,
        preview: String(transcript || '').slice(0, 120),
      });
      return;
    }
    const formatted = formatTranscript(transcript, language, {
      whisperFlow: true,
      summarize: false,
      preschoolMode: orgType === 'preschool',
      maxSummaryWords: orgType === 'preschool' ? 16 : 20,
    });
    logDashTrace('voice_input_received', {
      language: language || preferredLanguage,
      rawChars: String(transcript || '').length,
      cleanChars: formatted.trim().length,
      rawPreview: String(transcript || '').slice(0, 120),
      cleanPreview: formatted.trim().slice(0, 120),
    });
    if (language) setPreferredLanguage(language);
    const cleaned = formatted.trim();
    if (!cleaned) return;
    setLiveUserTranscript('');
    setLastUserTranscript(cleaned);
    sendMessage(cleaned);
  }, [isProcessing, isSpeaking, logDashTrace, orgType, preferredLanguage, sendMessage]);

  const handleSubmit = useCallback(() => {
    if (inputText.trim()) { sendMessage(inputText); setInputText(''); }
  }, [inputText, sendMessage]);

  const handleInputFocus = useCallback(() => {
    if (isSpeakingRef.current || isSpeaking) {
      voiceOrbRef.current?.stopSpeaking?.().catch(() => {});
    }
    if (isListening) {
      voiceOrbRef.current?.stopListening?.().catch(() => {});
      setIsListening(false);
    }
  }, [isListening, isSpeaking]);

  // ── Derived ───────────────────────────────────────────────────────
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    const name = profile?.first_name || profile?.full_name?.split(' ')[0] || '';
    const tg = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
    return name ? `${tg}, ${name}` : tg;
  }, [profile]);

  const statusLabel = isProcessing
    ? (streamingText ? 'Streaming...' : 'Thinking...')
    : isSpeaking ? 'Speaking...'
    : isListening ? 'Always listening'
    : 'Tap the orb or speak';
  const orbRenderSize = showTranscript ? Math.round(ORB_SIZE * 0.56) : ORB_SIZE;

  // ── Render ────────────────────────────────────────────────────────
  return (
    <>
    <View style={[s.container, { backgroundColor: theme.background }]}>
      <LanguageDropdown
        visible={showLangMenu}
        onClose={() => setShowLangMenu(false)}
        selectedLanguage={preferredLanguage}
        onSelect={setPreferredLanguage}
        onOpenFullChat={async () => {
          const history = conversationHistoryRef.current;
          await persistOrbMessages(history);
          router.push({
            pathname: '/screens/dash-assistant',
            params: { source: 'orb' },
          });
        }}
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
        <View style={s.headerRight}>
          {(isSpeaking || isProcessing) && (
            <TouchableOpacity
              onPress={stopDashActivity}
              style={[s.headerIconBtn, { borderColor: theme.error || '#ef4444', backgroundColor: (theme as any).error || '#ef4444' }]}
              accessibilityLabel="Stop Dash speaking"
            >
              <Ionicons name="stop" size={16} color={theme.onError || theme.background || '#fff'} />
            </TouchableOpacity>
          )}
          <TouchableOpacity
            onPress={() => router.push('/screens/app-search?scope=dash&q=dash')}
            style={[s.headerIconBtn, { borderColor: theme.border }]}
            accessibilityLabel="Find Dash features"
          >
            <Ionicons name="search-outline" size={16} color={theme.primary} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setShowTranscript((v) => !v)}
            style={[
              s.headerIconBtn,
              {
                borderColor: theme.border,
                backgroundColor: showTranscript ? theme.surface : 'transparent',
              },
            ]}
            accessibilityLabel={showTranscript ? 'Hide transcript' : 'Show transcript'}
          >
            <Ionicons
              name={showTranscript ? 'document-text' : 'document-text-outline'}
              size={16}
              color={showTranscript ? theme.text : theme.primary}
            />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setShowLangMenu(true)} style={[s.langBtn, { borderColor: theme.border }]}>
            <Ionicons name="language-outline" size={16} color={theme.primary} />
            <Text style={[s.langBtnText, { color: theme.primary }]}>{langLabel}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <KeyboardAvoidingView style={s.content} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={insets.top + 50}>
        <ScrollView contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <Text style={[s.greeting, { color: theme.text }]}>{greeting}</Text>
          <Text style={[s.subtitle, { color: theme.textSecondary }]}>Your AI assistant</Text>

          {/* ORB */}
          <View style={[s.orbContainer, { minHeight: orbRenderSize + 40, marginBottom: showTranscript ? 10 : 16 }]}>
            {VoiceOrb ? (
              <VoiceOrb
                ref={voiceOrbRef}
                isListening={isListening}
                isSpeaking={isSpeaking}
                isParentProcessing={isProcessing}
                onStartListening={() => setIsListening(true)}
                onStopListening={() => setIsListening(false)}
                onPartialTranscript={(text) => setLiveUserTranscript(text)}
                onTranscript={handleVoiceInput}
                onVoiceError={handleVoiceError}
                onTTSStart={() => setIsSpeaking(true)}
                onTTSEnd={() => setIsSpeaking(false)}
                onLanguageChange={(lang: SupportedLanguage) => setPreferredLanguage(lang)}
                language={preferredLanguage}
                size={orbRenderSize}
                autoStartListening
                autoRestartAfterTTS
                preschoolMode={orgType === 'preschool'}
                showLiveTranscript={false}
              />
            ) : (
              <CosmicOrb
                size={orbRenderSize}
                isProcessing={isProcessing || isListening}
                isSpeaking={isSpeaking}
              />
            )}
          </View>

          {/* Processing */}
          {isProcessing && !streamingText && (
            <View style={s.processingRow}>
              <ActivityIndicator size="small" color={theme.primary} />
              <Text style={[s.processingText, { color: theme.textSecondary }]}>Thinking...</Text>
            </View>
          )}

          {voiceErrorBanner ? (
            <View style={{
              marginTop: 12,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: `${theme.error || '#ef4444'}66`,
              backgroundColor: `${theme.error || '#ef4444'}20`,
              paddingHorizontal: 12,
              paddingVertical: 10,
              flexDirection: 'row',
              alignItems: 'center',
            }}>
              <Ionicons name="warning-outline" size={16} color={theme.error || '#ef4444'} />
              <Text style={{ color: theme.error || '#ef4444', flex: 1, fontSize: 12, marginLeft: 8, marginRight: 8 }}>
                {voiceErrorBanner}
              </Text>
              <TouchableOpacity onPress={() => setVoiceErrorBanner(null)}>
                <Ionicons name="close" size={14} color={theme.error || '#ef4444'} />
              </TouchableOpacity>
            </View>
          ) : null}

          {/* Captions (CC): assistant captions + tap-to-correct user transcript */}
          {showTranscript ? (
            <View style={{ width: '100%', marginBottom: 12 }}>
              {(liveUserTranscript.trim() || lastUserTranscript.trim()) ? (
                <TouchableOpacity
                  activeOpacity={0.75}
                  onPress={() => {
                    const text = (liveUserTranscript.trim() || lastUserTranscript.trim());
                    if (!text) return;
                    setInputText(text);
                    requestAnimationFrame(() => inputRef.current?.focus());
                  }}
                  style={{
                    marginBottom: 10,
                    borderRadius: 16,
                    borderWidth: 1,
                    borderColor: theme.border,
                    backgroundColor: theme.surface,
                    paddingHorizontal: 14,
                    paddingVertical: 12,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 10,
                  }}
                  accessibilityLabel="Edit what Dash heard"
                >
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: theme.textSecondary, fontSize: 11, marginBottom: 4 }}>
                      You said (tap to correct)
                    </Text>
                    <Text style={{ color: theme.text, fontSize: 15, lineHeight: 20 }}>
                      {liveUserTranscript.trim() || lastUserTranscript.trim()}
                    </Text>
                  </View>
                  <Ionicons name="create-outline" size={18} color={theme.primary} />
                </TouchableOpacity>
              ) : null}

              <View style={[
                s.responseCard,
                {
                  backgroundColor: theme.surface,
                  borderColor: theme.border,
                  maxHeight: 520,
                  minHeight: 260,
                },
              ]}>
                <ScrollView
                  ref={ccScrollRef}
                  style={[s.responseScroll, { maxHeight: 480 }]}
                  nestedScrollEnabled
                  showsVerticalScrollIndicator={false}
                  onContentSizeChange={() => ccScrollRef.current?.scrollToEnd({ animated: true })}
                  contentContainerStyle={{ paddingBottom: 30 }}
                >
                  <Text style={[
                    s.responseText,
                    {
                      color: theme.text,
                      fontSize: 22,
                      lineHeight: 32,
                    },
                  ]}>
                    {displayedText || (isProcessing ? '…' : '')}
                  </Text>
                </ScrollView>
                {streamingText ? (
                  <View style={s.streamingDot}><ActivityIndicator size="small" color={theme.primary} /></View>
                ) : null}
              </View>
            </View>
          ) : null}

          {/* Quick actions — only show once before first user interaction */}
          {!displayedText && !isProcessing && !isGreetingLoading && conversationHistory.length <= 1 && !conversationHistory.some(m => m.role === 'user') && (
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
          <TouchableOpacity style={s.fullChatLink} onPress={async () => {
            const history = conversationHistoryRef.current;
            await persistOrbMessages(history);
            router.push({
              pathname: '/screens/dash-assistant',
              params: { source: 'orb' },
            });
          }}>
            <Ionicons name="chatbubble-ellipses-outline" size={16} color={theme.primary} />
            <Text style={[s.fullChatText, { color: theme.primary }]}>Continue in full Dash chat</Text>
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
        <View style={[s.inputBar, { paddingBottom: Math.max(insets.bottom, 10) + 6 }]}>
          <View style={[s.composerShell, { backgroundColor: theme.surface }]}>
            <TouchableOpacity onPress={pickMedia} onLongPress={takePhoto} style={s.mediaBtn} activeOpacity={0.7}>
              <Ionicons name="image-outline" size={20} color={theme.primary} />
            </TouchableOpacity>
            <TextInput
              ref={inputRef}
              style={[s.textInput, { color: theme.text }]}
              placeholder="Type a message..."
              placeholderTextColor={theme.textSecondary}
              value={inputText}
              onChangeText={setInputText}
              onFocus={handleInputFocus}
              onSubmitEditing={handleSubmit}
              returnKeyType="send"
              editable={!isProcessing}
              multiline={false}
            />
            <TouchableOpacity
              style={[s.sendBtn, { backgroundColor: inputText.trim() ? theme.primary : 'rgba(255,255,255,0.10)' }]}
              onPress={handleSubmit}
              disabled={!inputText.trim() || isProcessing}
            >
              <Ionicons name="send" size={18} color={inputText.trim() ? '#fff' : theme.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
    <HomeworkScanner
      visible={scannerVisible}
      onClose={() => setScannerVisible(false)}
      onScanned={handleScannerScanned}
      title="Scan Homework"
    />
    </>
  );
}

// ── Styles ──────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingBottom: 6, gap: 8 },
  headerBtn: { padding: 8 },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  headerIconBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
  quickActions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 10, marginBottom: 12 },
  quickChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 24, borderWidth: 1 },
  quickChipText: { fontSize: 14, fontWeight: '600' },
  fullChatLink: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6 },
  fullChatText: { fontSize: 13, fontWeight: '600' },
  attachPreview: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 6, borderTopWidth: 1, gap: 8 },
  attachThumb: { width: 40, height: 40, borderRadius: 8 },
  attachLabel: { flex: 1, fontSize: 13 },
  attachRemove: { padding: 4 },
  inputBar: { paddingHorizontal: 16, paddingTop: 10 },
  composerShell: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 28,
    paddingHorizontal: 10,
    paddingVertical: 10,
    gap: 8,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
  },
  mediaBtn: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  textInput: { flex: 1, paddingHorizontal: 6, paddingVertical: 8, fontSize: 15, backgroundColor: 'transparent' },
  sendBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
});
