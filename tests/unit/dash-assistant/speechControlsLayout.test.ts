import { resolveSpeechControlsLayoutState } from '@/features/dash-ai/speechControls';

describe('speechControlsLayout', () => {
  it('shows mini controls when idle and speech chunks exist', () => {
    const state = resolveSpeechControlsLayoutState({
      isSpeaking: false,
      hasSpeechMessage: true,
      chunkCount: 6,
      expanded: false,
    });

    expect(state.showMiniControls).toBe(true);
    expect(state.showFullControls).toBe(false);
  });

  it('shows full controls while speaking', () => {
    const state = resolveSpeechControlsLayoutState({
      isSpeaking: true,
      hasSpeechMessage: true,
      chunkCount: 6,
      expanded: false,
    });

    expect(state.showMiniControls).toBe(false);
    expect(state.showFullControls).toBe(true);
  });

  it('shows full controls when expanded manually', () => {
    const state = resolveSpeechControlsLayoutState({
      isSpeaking: false,
      hasSpeechMessage: true,
      chunkCount: 3,
      expanded: true,
    });

    expect(state.showMiniControls).toBe(false);
    expect(state.showFullControls).toBe(true);
  });
});
