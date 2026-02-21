jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  ImpactFeedbackStyle: { Medium: 'medium' },
  NotificationFeedbackType: { Success: 'success' },
}));

jest.mock('expo-router', () => ({
  router: {
    push: jest.fn(),
  },
}));

jest.mock('expo-audio', () => ({
  AudioModule: {
    requestPermissionsAsync: jest.fn(async () => ({ status: 'granted' })),
  },
}));

jest.mock('@/lib/voice/unifiedProvider', () => ({
  getSingleUseVoiceProvider: jest.fn(async () => ({
    id: 'mock-provider',
    isAvailable: async () => true,
    createSession: () => ({
      start: async () => true,
      stop: async () => {},
      isActive: () => false,
    }),
  })),
}));

import { speakDashResponse, type SpeechChunkProgress } from '@/features/dash-assistant/voiceHandlersCore';
import type { DashMessage } from '@/services/dash-ai/types';

describe('speakDashResponse chunk progress', () => {
  it('emits chunk progress and completion state', async () => {
    const message: DashMessage = {
      id: 'msg-1',
      type: 'assistant',
      content: `${'This is a sentence. '.repeat(80)} Final sentence.`,
      timestamp: Date.now(),
    };

    const progressEvents: SpeechChunkProgress[] = [];
    const dashInstance = {
      getPersonality: () => ({ voice_settings: { language: 'en-ZA' } }),
      speakResponse: jest.fn(async (_message: DashMessage, callbacks: any) => {
        callbacks?.onStart?.();
        callbacks?.onDone?.();
      }),
    };

    await speakDashResponse({
      message,
      dashInstance,
      voiceEnabled: true,
      hasTTSAccess: () => true,
      isFreeTier: false,
      consumeVoiceBudget: async () => {},
      isSpeaking: false,
      speakingMessageId: null,
      voiceRefs: {
        voiceSessionRef: { current: null } as any,
        voiceProviderRef: { current: null } as any,
        voiceInputStartAtRef: { current: null } as any,
        lastSpeakStartRef: { current: 0 } as any,
        ttsSessionIdRef: { current: null } as any,
      },
      setIsSpeaking: jest.fn(),
      setSpeakingMessageId: jest.fn(),
      showAlert: jest.fn(),
      hideAlert: jest.fn(),
      setVoiceEnabled: jest.fn(),
      stopSpeaking: async () => {},
      onSpeechChunkProgress: (progress) => {
        progressEvents.push(progress);
      },
    });

    expect(progressEvents.length).toBeGreaterThan(0);
    expect(progressEvents.some((event) => event.isPlaying)).toBe(true);
    const lastEvent = progressEvents[progressEvents.length - 1];
    expect(lastEvent.isComplete).toBe(true);
    expect(lastEvent.isPlaying).toBe(false);
  });
});
