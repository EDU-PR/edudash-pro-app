/**
 * Tests for VoiceCallInfo component
 */

import React from 'react';
import { render } from '@testing-library/react-native';
import { Animated } from 'react-native';
import { VoiceCallInfo } from '../VoiceCallInfo';

describe('VoiceCallInfo', () => {
  const defaultProps = {
    userName: 'John Doe',
    callState: 'connected' as const,
    callDuration: 125,
    formatDuration: (seconds: number) => {
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    },
    pulseAnim: new Animated.Value(1),
  };

  it('should display the user name', () => {
    const { getByText } = render(<VoiceCallInfo {...defaultProps} />);

    expect(getByText('John Doe')).toBeTruthy();
  });

  it('should show "Connecting..." when connecting', () => {
    const { getByText } = render(
      <VoiceCallInfo {...defaultProps} callState="connecting" />
    );

    expect(getByText('Connecting...')).toBeTruthy();
  });

  it('should show "Ringing..." when ringing', () => {
    const { getByText } = render(
      <VoiceCallInfo {...defaultProps} callState="ringing" />
    );

    expect(getByText('Ringing...')).toBeTruthy();
  });

  it('should show formatted duration when connected', () => {
    const { getByText } = render(
      <VoiceCallInfo {...defaultProps} callState="connected" callDuration={125} />
    );

    expect(getByText('02:05')).toBeTruthy();
  });

  it('should show "Call Failed" when failed', () => {
    const { getByText } = render(
      <VoiceCallInfo {...defaultProps} callState="failed" />
    );

    expect(getByText('Call Failed')).toBeTruthy();
  });

  it('should show "Call Ended" when ended', () => {
    const { getByText } = render(
      <VoiceCallInfo {...defaultProps} callState="ended" />
    );

    expect(getByText('Call Ended')).toBeTruthy();
  });
});
