/**
 * Tests for VoiceCallControls component
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { VoiceCallControls } from '../VoiceCallControls';

describe('VoiceCallControls', () => {
  const defaultProps = {
    callState: 'connected' as const,
    isAudioEnabled: true,
    isSpeakerEnabled: false,
    participantCount: 2,
    onToggleAudio: jest.fn(),
    onToggleSpeaker: jest.fn(),
    onEndCall: jest.fn(),
    onRetry: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render all control buttons', () => {
    const { getByText } = render(<VoiceCallControls {...defaultProps} />);

    expect(getByText('Mute')).toBeTruthy();
    expect(getByText('Earpiece')).toBeTruthy();
    expect(getByText('End')).toBeTruthy();
  });

  it('should show "Unmute" when audio is disabled', () => {
    const { getByText } = render(
      <VoiceCallControls {...defaultProps} isAudioEnabled={false} />
    );

    expect(getByText('Unmute')).toBeTruthy();
  });

  it('should show "Speaker" when speaker is enabled', () => {
    const { getByText } = render(
      <VoiceCallControls {...defaultProps} isSpeakerEnabled={true} />
    );

    expect(getByText('Speaker')).toBeTruthy();
  });

  it('should call onToggleAudio when mute button is pressed', () => {
    const onToggleAudio = jest.fn();
    const { getByText } = render(
      <VoiceCallControls {...defaultProps} onToggleAudio={onToggleAudio} />
    );

    fireEvent.press(getByText('Mute'));

    expect(onToggleAudio).toHaveBeenCalledTimes(1);
  });

  it('should call onToggleSpeaker when speaker button is pressed', () => {
    const onToggleSpeaker = jest.fn();
    const { getByText } = render(
      <VoiceCallControls {...defaultProps} onToggleSpeaker={onToggleSpeaker} />
    );

    fireEvent.press(getByText('Earpiece'));

    expect(onToggleSpeaker).toHaveBeenCalledTimes(1);
  });

  it('should call onEndCall when end button is pressed', () => {
    const onEndCall = jest.fn();
    const { getByText } = render(
      <VoiceCallControls {...defaultProps} onEndCall={onEndCall} />
    );

    fireEvent.press(getByText('End'));

    expect(onEndCall).toHaveBeenCalledTimes(1);
  });

  it('should show retry button when call failed', () => {
    const onRetry = jest.fn();
    const { getByText, queryByText } = render(
      <VoiceCallControls
        {...defaultProps}
        callState="failed"
        onRetry={onRetry}
      />
    );

    expect(getByText('Call Again')).toBeTruthy();
    expect(queryByText('End')).toBeNull();
  });

  it('should show retry button when call ended with no participants', () => {
    const { getByText } = render(
      <VoiceCallControls
        {...defaultProps}
        callState="ended"
        participantCount={0}
      />
    );

    expect(getByText('Call Again')).toBeTruthy();
  });

  it('should call onRetry when retry button is pressed', () => {
    const onRetry = jest.fn();
    const { getByText } = render(
      <VoiceCallControls
        {...defaultProps}
        callState="failed"
        onRetry={onRetry}
      />
    );

    fireEvent.press(getByText('Call Again'));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
