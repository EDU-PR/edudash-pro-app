import { canAutoRestartAfterInterrupt } from '@/components/super-admin/voice-orb/interrupt';

describe('voice orb interrupt restart behavior', () => {
  it('restarts automatically only when all guardrails are safe', () => {
    expect(canAutoRestartAfterInterrupt({
      isMuted: false,
      isProcessing: false,
      isRecording: false,
      usingLiveSTT: false,
      isSpeaking: false,
      ttsIsSpeaking: false,
    })).toBe(true);
  });

  it('blocks restart while speaking/recording/muted/processing', () => {
    expect(canAutoRestartAfterInterrupt({
      isMuted: true,
      isProcessing: false,
      isRecording: false,
      usingLiveSTT: false,
      isSpeaking: false,
      ttsIsSpeaking: false,
    })).toBe(false);

    expect(canAutoRestartAfterInterrupt({
      isMuted: false,
      isProcessing: false,
      isRecording: true,
      usingLiveSTT: false,
      isSpeaking: false,
      ttsIsSpeaking: false,
    })).toBe(false);

    expect(canAutoRestartAfterInterrupt({
      isMuted: false,
      isProcessing: false,
      isRecording: false,
      usingLiveSTT: false,
      isSpeaking: true,
      ttsIsSpeaking: false,
    })).toBe(false);

    expect(canAutoRestartAfterInterrupt({
      isMuted: false,
      isProcessing: true,
      isRecording: false,
      usingLiveSTT: false,
      isSpeaking: false,
      ttsIsSpeaking: false,
    })).toBe(false);
  });
});
