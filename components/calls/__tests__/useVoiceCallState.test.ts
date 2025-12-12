/**
 * Tests for useVoiceCallState hook
 */

import { renderHook, act } from '@testing-library/react-hooks';
import { useVoiceCallState } from '../hooks/useVoiceCallState';

describe('useVoiceCallState', () => {
  const defaultOptions = {
    isOpen: true,
    callId: 'test-call-id',
    onCallStateChange: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should initialize with default values', () => {
    const { result } = renderHook(() => useVoiceCallState(defaultOptions));

    expect(result.current.callState).toBe('idle');
    expect(result.current.isAudioEnabled).toBe(true);
    expect(result.current.isSpeakerEnabled).toBe(false);
    expect(result.current.isMinimized).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.participantCount).toBe(0);
    expect(result.current.callDuration).toBe(0);
  });

  it('should update callIdRef when callId prop changes', () => {
    const { result } = renderHook(() => useVoiceCallState(defaultOptions));

    expect(result.current.callIdRef.current).toBe('test-call-id');
  });

  it('should call onCallStateChange when callState changes', () => {
    const onCallStateChange = jest.fn();
    const { result } = renderHook(() =>
      useVoiceCallState({ ...defaultOptions, onCallStateChange })
    );

    act(() => {
      result.current.setCallState('connecting');
    });

    expect(onCallStateChange).toHaveBeenCalledWith('connecting');
  });

  it('should format duration correctly', () => {
    const { result } = renderHook(() => useVoiceCallState(defaultOptions));

    expect(result.current.formatDuration(0)).toBe('00:00');
    expect(result.current.formatDuration(65)).toBe('01:05');
    expect(result.current.formatDuration(3661)).toBe('61:01');
  });

  it('should reset all state values', () => {
    const { result } = renderHook(() => useVoiceCallState(defaultOptions));

    // Change some values
    act(() => {
      result.current.setCallState('connected');
      result.current.setError('Some error');
      result.current.setParticipantCount(2);
      result.current.setCallDuration(100);
      result.current.setIsMinimized(true);
    });

    // Verify changes
    expect(result.current.callState).toBe('connected');
    expect(result.current.error).toBe('Some error');

    // Reset
    act(() => {
      result.current.resetState();
    });

    // Verify reset
    expect(result.current.callState).toBe('idle');
    expect(result.current.error).toBeNull();
    expect(result.current.participantCount).toBe(0);
    expect(result.current.callDuration).toBe(0);
    expect(result.current.isMinimized).toBe(false);
  });

  it('should update audio enabled state', () => {
    const { result } = renderHook(() => useVoiceCallState(defaultOptions));

    expect(result.current.isAudioEnabled).toBe(true);

    act(() => {
      result.current.setIsAudioEnabled(false);
    });

    expect(result.current.isAudioEnabled).toBe(false);
  });

  it('should update speaker enabled state', () => {
    const { result } = renderHook(() => useVoiceCallState(defaultOptions));

    expect(result.current.isSpeakerEnabled).toBe(false);

    act(() => {
      result.current.setIsSpeakerEnabled(true);
    });

    expect(result.current.isSpeakerEnabled).toBe(true);
  });
});
