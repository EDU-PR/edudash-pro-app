import { Alert, Linking, PermissionsAndroid, Platform } from 'react-native';
import { router } from 'expo-router';
import { AudioModule } from 'expo-audio';
import * as Haptics from 'expo-haptics';

import type { DashMessage } from '@/services/dash-ai/types';
import type { VoiceProvider, VoiceSession } from '@/lib/voice/unifiedProvider';
import { getSingleUseVoiceProvider } from '@/lib/voice/unifiedProvider';
import { formatTranscript } from '@/lib/voice/formatTranscript';
import { track } from '@/lib/analytics';
import { cleanForTTS, splitForTTS, detectTextLanguage } from '@/lib/dash-voice-utils';
import { shouldUsePhonicsMode } from '@/lib/dash-ai/phonicsDetection';

type VoiceRefs = {
  voiceSessionRef: React.MutableRefObject<VoiceSession | null>;
  voiceProviderRef: React.MutableRefObject<VoiceProvider | null>;
  voiceInputStartAtRef: React.MutableRefObject<number | null>;
  lastSpeakStartRef: React.MutableRefObject<number | null>;
  ttsSessionIdRef?: React.MutableRefObject<string | null>;
};

export async function stopDashVoiceRecording(params: {
  voiceRefs: VoiceRefs;
  isFreeTier: boolean;
  consumeVoiceBudget: (deltaMs: number) => Promise<void>;
  setIsRecording: (value: boolean) => void;
  setPartialTranscript: (value: string) => void;
}) {
  const {
    voiceRefs,
    isFreeTier,
    consumeVoiceBudget,
    setIsRecording,
    setPartialTranscript,
  } = params;

  if (!voiceRefs.voiceSessionRef.current) {
    setIsRecording(false);
    return;
  }

  try {
    await voiceRefs.voiceSessionRef.current.stop();
  } catch (error) {
    console.error('[useDashAssistant] Failed to stop voice session:', error);
  }

  if (isFreeTier && voiceRefs.voiceInputStartAtRef.current) {
    const deltaMs = Math.max(0, Date.now() - voiceRefs.voiceInputStartAtRef.current);
    await consumeVoiceBudget(deltaMs);
    voiceRefs.voiceInputStartAtRef.current = null;
  }

  setIsRecording(false);
  setPartialTranscript('');
  voiceRefs.voiceSessionRef.current = null;
}

export async function speakDashResponse(params: {
  message: DashMessage;
  dashInstance: any;
  voiceEnabled: boolean;
  hasTTSAccess: () => boolean;
  isFreeTier: boolean;
  consumeVoiceBudget: (ms: number) => Promise<void>;
  isSpeaking: boolean;
  speakingMessageId: string | null;
  voiceRefs: VoiceRefs;
  setIsSpeaking: (value: boolean) => void;
  setSpeakingMessageId: (value: string | null) => void;
  showAlert: (alert: any) => void;
  hideAlert: () => void;
  setVoiceEnabled: (value: boolean) => void;
  stopSpeaking: () => Promise<void>;
}) {
  const {
    message,
    dashInstance,
    voiceEnabled,
    hasTTSAccess,
    isFreeTier,
    consumeVoiceBudget,
    isSpeaking,
    speakingMessageId,
    voiceRefs,
    setIsSpeaking,
    setSpeakingMessageId,
    showAlert,
    hideAlert,
    setVoiceEnabled,
    stopSpeaking,
  } = params;

  if (!dashInstance || message.type !== 'assistant') return;

  if (!voiceEnabled) {
    showAlert({
      title: 'Voice Responses Disabled',
      message: 'Enable Voice Responses in Dash AI Settings to hear spoken replies.',
      type: 'info',
      icon: 'volume-mute-outline',
      buttons: [{ text: 'OK', style: 'default' }],
    });
    return;
  }

  if (!hasTTSAccess()) {
    showAlert({
      title: isFreeTier ? 'Daily Voice Limit Reached' : 'Voice Playback - Premium',
      message: isFreeTier
        ? "You've used today's 10 minutes of voice. Upgrade for unlimited voice and voice input."
        : 'Text-to-speech is a premium feature available on Starter and Plus plans.\n\nUpgrade to unlock:\n• Dash reads responses aloud\n• Voice input\n• Voice commands',
      type: 'info',
      icon: 'volume-high-outline',
      buttons: [
        { text: 'Maybe Later', style: 'cancel' },
        {
          text: 'Upgrade Now',
          onPress: () => {
            hideAlert();
            router.push('/screens/subscription-setup' as any);
          },
        },
      ],
    });
    return;
  }

  const now = Date.now();
  const sinceLastStart = now - (voiceRefs.lastSpeakStartRef.current || 0);

  if (speakingMessageId === message.id) {
    if (sinceLastStart < 600) return;
    await stopSpeaking();
    return;
  }

  if (isSpeaking && speakingMessageId) {
    if (sinceLastStart < 600) return;
    await stopSpeaking();
  }

  try {
    if (isFreeTier && message.content && process.env.NODE_ENV !== 'development') {
      const estimatedMs = Math.max(1500, Math.round((message.content.length / 12.5) * 1000));
      try {
        await consumeVoiceBudget(estimatedMs);
      } catch (budgetError) {
        console.warn('[useDashAssistant] Voice budget update failed, continuing with playback:', budgetError);
      }
    }
    const isPhonics = shouldUsePhonicsMode(message.content || '');
    const cleaned = cleanForTTS(message.content || '', { phonicsMode: isPhonics });
    const chunks = splitForTTS(cleaned, 900);
    if (chunks.length === 0) {
      setIsSpeaking(false);
      setSpeakingMessageId(null);
      return;
    }

    const sessionId = `${message.id}:${now}`;
    if (voiceRefs.ttsSessionIdRef) {
      voiceRefs.ttsSessionIdRef.current = sessionId;
    }

    setIsSpeaking(true);
    setSpeakingMessageId(message.id);
    voiceRefs.lastSpeakStartRef.current = now;

    const throwSpeechError = (error: unknown) => {
      const errorMessage = typeof error === 'string'
        ? error
        : (error as any)?.message || '';
      const errorCode = (error as any)?.code || '';
      const normalized = `${errorCode} ${errorMessage}`.toLowerCase();

      console.error('Speech error:', error);

      let title = 'Voice Playback Error';
      let messageText = 'We had trouble speaking that response. Try again or disable voice.';

      if (normalized.includes('tts_free_tier_blocked')) {
        title = 'Voice Limit Reached';
        messageText = 'Your plan does not include voice playback. Upgrade to unlock Dash voice.';
      } else if (
        normalized.includes('auth_required') ||
        normalized.includes('unauthorized') ||
        normalized.includes('invalid token')
      ) {
        title = 'Voice Needs Login';
        messageText = 'Voice playback requires an active session. Please sign in again.';
      } else if (
        normalized.includes('azure speech not configured') ||
        normalized.includes('device_fallback') ||
        normalized.includes('tts unavailable')
      ) {
        title = 'Voice Service Offline';
        messageText = 'Azure TTS is not available right now. Check the Supabase `tts-proxy` function secrets (AZURE_SPEECH_KEY / AZURE_SPEECH_REGION) and redeploy.';
      } else if (normalized.includes('network') || normalized.includes('fetch')) {
        title = 'Voice Network Error';
        messageText = "Dash couldn't reach the voice service. Check your connection and try again.";
      }

      showAlert({
        title,
        message: messageText,
        type: 'warning',
        icon: 'volume-mute-outline',
        buttons: [
          { text: 'OK', style: 'default' },
          {
            text: 'Disable Voice',
            onPress: () => {
              hideAlert();
              setVoiceEnabled(false);
            },
          },
        ],
      });
    };

    for (let idx = 0; idx < chunks.length; idx += 1) {
      if (voiceRefs.ttsSessionIdRef && voiceRefs.ttsSessionIdRef.current !== sessionId) {
        break;
      }

      const chunk = chunks[idx];
      const detected = detectTextLanguage(chunk);
      const localized = `${detected}-ZA`;
      const chunkMessage: DashMessage = {
        ...message,
        content: chunk,
        metadata: {
          ...(message.metadata || {}),
          detected_language: localized,
        },
      };

      let chunkFailed = false;
      await new Promise<void>((resolve, reject) => {
        let settled = false;
        const settle = (fn: () => void) => {
          if (settled) return;
          settled = true;
          fn();
        };

        const timeout = setTimeout(() => settle(resolve), 30000);
        const clear = () => clearTimeout(timeout);

        void dashInstance.speakResponse(chunkMessage, {
          onStart: () => {},
          onDone: () => {
            clear();
            settle(resolve);
          },
          onStopped: () => {
            clear();
            settle(resolve);
          },
          onError: (error: unknown) => {
            clear();
            settle(() => reject(error));
          },
        });
      }).catch((error) => {
        chunkFailed = true;
        throwSpeechError(error);
      });
      if (chunkFailed) {
        break;
      }
    }

    if (!voiceRefs.ttsSessionIdRef || voiceRefs.ttsSessionIdRef.current === sessionId) {
      if (voiceRefs.ttsSessionIdRef) {
        voiceRefs.ttsSessionIdRef.current = null;
      }
      setIsSpeaking(false);
      setSpeakingMessageId(null);
    }
  } catch (error) {
    console.error('Failed to speak response:', error);
    if (voiceRefs.ttsSessionIdRef) {
      voiceRefs.ttsSessionIdRef.current = null;
    }
    setIsSpeaking(false);
    setSpeakingMessageId(null);
  }
}

export async function handleDashVoiceInputPress(params: {
  hasTTSAccess: () => boolean;
  isRecording: boolean;
  stopVoiceRecording: () => Promise<void>;
  tier: string | undefined;
  showAlert: (alert: any) => void;
  hideAlert: () => void;
  dashInstance: any;
  preferredLanguage: string | null | undefined;
  resolveVoiceLocale: (value?: string | null) => string;
  isFreeTier: boolean;
  consumeVoiceBudget: (deltaMs: number) => Promise<void>;
  setIsRecording: (value: boolean) => void;
  setPartialTranscript: (value: string) => void;
  setInputText: (value: string) => void;
  voiceAutoSend?: boolean;
  voiceAutoSendSilenceMs?: number;
  voiceWhisperFlowEnabled?: boolean;
  voiceWhisperFlowSummaryEnabled?: boolean;
  isPreschoolMode?: boolean;
  onFinalTranscript?: (text: string, options: { autoSend: boolean; delayMs: number }) => void | Promise<void>;
  voiceRefs: VoiceRefs;
}) {
  const {
    hasTTSAccess,
    isRecording,
    stopVoiceRecording,
    tier,
    showAlert,
    hideAlert,
    dashInstance,
    preferredLanguage,
    resolveVoiceLocale,
    isFreeTier,
    consumeVoiceBudget,
    setIsRecording,
    setPartialTranscript,
    setInputText,
    voiceAutoSend = false,
    voiceAutoSendSilenceMs = 1500,
    voiceWhisperFlowEnabled = true,
    voiceWhisperFlowSummaryEnabled = true,
    isPreschoolMode = false,
    onFinalTranscript,
    voiceRefs,
  } = params;

  if (!hasTTSAccess()) {
    showAlert({
      title: isFreeTier ? 'Daily Voice Limit Reached' : 'Voice Features - Premium',
      message: isFreeTier
        ? "You've used today's 10 minutes of voice. Upgrade for unlimited voice input and playback."
        : 'Voice input and text-to-speech are premium features available on Starter and Plus plans.\n\nUpgrade to unlock:\n• Voice input (speak to Dash)\n• Text-to-speech (Dash reads responses)\n• Voice commands',
      type: 'info',
      icon: 'mic-outline',
      buttons: [
        { text: 'Maybe Later', style: 'cancel' },
        {
          text: 'Upgrade Now',
          onPress: () => {
            hideAlert();
            router.push('/screens/subscription-setup' as any);
          },
        },
      ],
    });
    return;
  }

  if (isRecording) {
    await stopVoiceRecording();
    return;
  }

  try {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
          {
            title: 'Microphone Permission',
            message: 'Dash AI needs access to your microphone for voice input.',
            buttonPositive: 'Allow',
            buttonNegative: 'Deny',
          }
        );

        if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
          showAlert({
            title: 'Microphone Permission Required',
            message: 'Please grant microphone permission to use voice input with Dash.',
            type: 'warning',
            icon: 'mic-off-outline',
            buttons: [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Open Settings', onPress: () => { hideAlert(); Linking.openSettings(); } },
            ],
          });
          return;
        }
      } catch (permErr) {
        console.error('[useDashAssistant] Permission request error:', permErr);
      }
    } else if (Platform.OS === 'ios') {
      try {
        const { status } = await AudioModule.requestPermissionsAsync();
        if (status !== 'granted') {
          showAlert({
            title: 'Microphone Permission Required',
            message: 'Please grant microphone permission to use voice input with Dash.',
            type: 'warning',
            icon: 'mic-off-outline',
            buttons: [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Open Settings', onPress: () => { hideAlert(); Linking.openSettings(); } },
            ],
          });
          return;
        }
      } catch (permErr) {
        console.error('[useDashAssistant] iOS permission request error:', permErr);
      }
    }

    if (!voiceRefs.voiceProviderRef.current) {
      const voiceLocale = resolveVoiceLocale(preferredLanguage || dashInstance?.getPersonality?.()?.voice_settings?.language || null);
      voiceRefs.voiceProviderRef.current = await getSingleUseVoiceProvider(voiceLocale);
    }

    const provider = voiceRefs.voiceProviderRef.current;
    const available = await provider.isAvailable();

    if (!available) {
      const androidMessage = `Speech recognition is not available on this device.\n\nTo enable voice input:\n1. Install or update the Google app from Play Store\n2. Go to Settings → Apps → Google → Permissions → Microphone\n3. Enable \"Offline speech recognition\" in Google Settings\n4. Restart EduDash Pro\n\nAlternatively, you can use text input to chat with Dash.`;

      const iosMessage = `Speech recognition is not available.\n\nTo enable voice input:\n1. Go to Settings → Privacy → Speech Recognition\n2. Enable speech recognition for EduDash Pro\n3. Restart the app\n\nYou can also use text input to chat with Dash.`;

      showAlert({
        title: 'Voice Input Unavailable',
        message: Platform.OS === 'android' ? androidMessage : iosMessage,
        type: 'warning',
        icon: 'mic-off-outline',
        buttons: [
          { text: 'Use Text Input', style: 'default' },
          Platform.OS === 'android'
            ? { text: 'Open Play Store', onPress: () => { hideAlert(); Linking.openURL('https://play.google.com/store/apps/details?id=com.google.android.googlequicksearchbox'); } }
            : { text: 'Open Settings', onPress: () => { hideAlert(); Linking.openSettings(); } },
        ],
      });
      return;
    }

    const session = provider.createSession();
    voiceRefs.voiceSessionRef.current = session;

    const voiceLocale = resolveVoiceLocale(preferredLanguage || dashInstance?.getPersonality?.()?.voice_settings?.language || null);
    const started = await session.start({
      language: voiceLocale,
      onPartial: (text: string) => {
        setPartialTranscript(text);
        setInputText(text);
      },
      onFinal: (text: string) => {
        const formatted = formatTranscript(text, voiceLocale, {
          whisperFlow: voiceWhisperFlowEnabled,
          summarize: voiceWhisperFlowSummaryEnabled,
          preschoolMode: isPreschoolMode,
          maxSummaryWords: isPreschoolMode ? 16 : 20,
        });
        setInputText(formatted);
        setPartialTranscript('');
        setIsRecording(false);
        if (isFreeTier && voiceRefs.voiceInputStartAtRef.current) {
          const deltaMs = Math.max(0, Date.now() - voiceRefs.voiceInputStartAtRef.current);
          consumeVoiceBudget(deltaMs);
          voiceRefs.voiceInputStartAtRef.current = null;
        }

        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});

        track('edudash.voice.input_completed', {
          transcript_length: text.length,
          user_tier: tier || 'free',
        });

        const autoSend = !!voiceAutoSend;
        const delayMs = Math.max(400, Math.min(2000, Number(voiceAutoSendSilenceMs) || 600));
        onFinalTranscript?.(formatted, { autoSend, delayMs });
      },
      onError: (error: string) => {
        const msg = String(error || '');
        const isNetwork = /network|internet|offline|timeout|connection/i.test(msg);
        setIsRecording(false);
        setPartialTranscript('');
        if (voiceRefs.voiceSessionRef.current?.isActive?.()) {
          voiceRefs.voiceSessionRef.current.stop().catch(() => {});
        }
        if (isFreeTier && voiceRefs.voiceInputStartAtRef.current) {
          const deltaMs = Math.max(0, Date.now() - voiceRefs.voiceInputStartAtRef.current);
          consumeVoiceBudget(deltaMs);
          voiceRefs.voiceInputStartAtRef.current = null;
        }
        showAlert({
          title: 'Voice Recognition Error',
          message: isNetwork
            ? 'Voice recognition needs a stable internet connection on this device. Please check your connection or use text input.'
            : 'Voice recognition failed. Please try again or use text input.',
          type: 'warning',
          icon: 'mic-off-outline',
          buttons: [{ text: 'OK', style: 'default' }],
        });
      },
    });

    if (started) {
      setIsRecording(true);
      setPartialTranscript('');
      voiceRefs.voiceInputStartAtRef.current = Date.now();

      track('edudash.voice.input_started', {
        user_tier: tier || 'free',
      });
    } else {
      showAlert({
        title: 'Voice Error',
        message: 'Failed to start voice recognition. Please check microphone permissions and try again.',
        type: 'error',
        icon: 'alert-circle-outline',
        buttons: [{ text: 'OK', style: 'default' }],
      });
    }
  } catch (error) {
    console.error('[useDashAssistant] Voice recognition error:', error);
    setIsRecording(false);
    setPartialTranscript('');

    showAlert({
      title: 'Voice Error',
      message: 'An error occurred with voice recognition. Please try again.',
      type: 'error',
      icon: 'alert-circle-outline',
      buttons: [{ text: 'OK', style: 'default' }],
    });
  }
}
