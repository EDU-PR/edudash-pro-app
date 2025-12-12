/**
 * Tests for useVoiceCallAudio hook
 */

import { renderHook, act } from '@testing-library/react-hooks';
import { useVoiceCallAudio } from '../hooks/useVoiceCallAudio';

// Mock InCallManager
const mockInCallManager = {
  start: jest.fn(),
  stop: jest.fn(),
  stopRingback: jest.fn(),
  setForceSpeakerphoneOn: jest.fn(),
};

jest.mock('react-native-incall-manager', () => ({
  default: mockInCallManager,
}));

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

  it('should stop audio and cleanup', () => {
    const { result } = renderHook(() => useVoiceCallAudio(defaultOptions));

    act(() => {
      result.current.stopAudio();
    });

    expect(mockInCallManager.stopRingback).toHaveBeenCalled();
    expect(mockInCallManager.stop).toHaveBeenCalled();
  });

  it('should start ringback for caller when connecting', () => {
    renderHook(() =>
      useVoiceCallAudio({
        ...defaultOptions,
        callState: 'connecting',
        isOwner: true,
      })
    );

    expect(mockInCallManager.start).toHaveBeenCalledWith({
      media: 'audio',
      ringback: '_DEFAULT_',
    });
    expect(mockInCallManager.setForceSpeakerphoneOn).toHaveBeenCalledWith(false);
  });

  it('should start audio without ringback for callee', () => {
    renderHook(() =>
      useVoiceCallAudio({
        ...defaultOptions,
        callState: 'connecting',
        isOwner: false,
      })
    );

    expect(mockInCallManager.start).toHaveBeenCalledWith({ media: 'audio' });
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
