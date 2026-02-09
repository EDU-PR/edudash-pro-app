/**
 * Tests for useVoiceCallAudio hook
 */

import { renderHook, act, waitFor } from '@testing-library/react-native/pure';

// Mock expo-audio
jest.mock('expo-audio', () => ({
  createAudioPlayer: jest.fn(() => ({
    play: jest.fn(),
    pause: jest.fn(),
    remove: jest.fn(),
    seekTo: jest.fn(),
    currentTime: 0,
    playing: false,
  })),
  setAudioModeAsync: jest.fn().mockResolvedValue(undefined),
}));

// Mock expo-haptics
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn().mockResolvedValue(undefined),
  ImpactFeedbackStyle: { Medium: 'medium', Light: 'light', Heavy: 'heavy' },
}));

// Mock InCallManager — define fns INSIDE factory to avoid hoisting issues
jest.mock('react-native-incall-manager', () => ({
  __esModule: true,
  default: {
    start: jest.fn(),
    stop: jest.fn(),
    stopRingback: jest.fn(),
    setForceSpeakerphoneOn: jest.fn(),
    setKeepScreenOn: jest.fn(),
  },
}));

// Grab reference to the mock default AFTER mock is registered
const mockInCallManager = require('react-native-incall-manager').default;

// Import after mocks are set up
import { useVoiceCallAudio } from '../hooks/useVoiceCallAudio';

describe('useVoiceCallAudio', () => {
  const defaultOptions = {
    callState: 'idle' as const,
    isOwner: true,
    isSpeakerEnabled: false,
    setIsSpeakerEnabled: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should indicate InCallManager is available', () => {
    const { result } = renderHook(() => useVoiceCallAudio(defaultOptions));

    expect(result.current.isInCallManagerAvailable).toBe(true);
  });

  it('should toggle speaker on', () => {
    const setIsSpeakerEnabled = jest.fn();
    const { result } = renderHook(() =>
      useVoiceCallAudio({
        ...defaultOptions,
        isSpeakerEnabled: false,
        setIsSpeakerEnabled,
      })
    );

    act(() => {
      result.current.toggleSpeaker();
    });

    expect(mockInCallManager.setForceSpeakerphoneOn).toHaveBeenCalledWith(true);
    expect(setIsSpeakerEnabled).toHaveBeenCalledWith(true);
  });

  it('should toggle speaker off', () => {
    const setIsSpeakerEnabled = jest.fn();
    const { result } = renderHook(() =>
      useVoiceCallAudio({
        ...defaultOptions,
        isSpeakerEnabled: true,
        setIsSpeakerEnabled,
      })
    );

    act(() => {
      result.current.toggleSpeaker();
    });

    expect(mockInCallManager.setForceSpeakerphoneOn).toHaveBeenCalledWith(false);
    expect(setIsSpeakerEnabled).toHaveBeenCalledWith(false);
  });

  it('should stop audio and cleanup', async () => {
    const { result } = renderHook(() => useVoiceCallAudio(defaultOptions));

    await act(async () => {
      await result.current.stopAudio();
    });

    expect(mockInCallManager.stopRingback).toHaveBeenCalled();
    expect(mockInCallManager.stop).toHaveBeenCalled();
  });

  it('should start ringback for caller when connecting', async () => {
    renderHook(() =>
      useVoiceCallAudio({
        ...defaultOptions,
        callState: 'connecting',
        isOwner: true,
      })
    );

    await waitFor(() => {
      expect(mockInCallManager.start).toHaveBeenCalled();
    });

    expect(mockInCallManager.start).toHaveBeenCalledWith({
      media: 'audio',
      auto: false,
      ringback: '',
    });
    expect(mockInCallManager.setForceSpeakerphoneOn).toHaveBeenCalledWith(false);
  });

  it('should start audio without ringback for callee', async () => {
    renderHook(() =>
      useVoiceCallAudio({
        ...defaultOptions,
        callState: 'connecting',
        isOwner: false,
      })
    );

    await waitFor(() => {
      expect(mockInCallManager.start).toHaveBeenCalled();
    });

    expect(mockInCallManager.start).toHaveBeenCalledWith({
      media: 'audio',
      auto: false,
      ringback: '',
    });
  });

  it('should stop ringback when connected', () => {
    const { rerender } = renderHook(
      ({ callState }) => useVoiceCallAudio({ ...defaultOptions, callState }),
      { initialProps: { callState: 'ringing' as const } }
    );

    // Transition to connected
    rerender({ callState: 'connected' as const });

    expect(mockInCallManager.stopRingback).toHaveBeenCalled();
  });
});
