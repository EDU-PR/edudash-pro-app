/**
 * Tests for VoiceCallMinimized component
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { VoiceCallMinimized } from '../VoiceCallMinimized';

describe('VoiceCallMinimized', () => {
  const defaultProps = {
    callDuration: 65,
    formatDuration: (seconds: number) => {
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    },
    onMaximize: jest.fn(),
    onEndCall: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should display formatted call duration', () => {
    const { getByText } = render(<VoiceCallMinimized {...defaultProps} />);

    expect(getByText('01:05')).toBeTruthy();
  });

  it('should call onMaximize when container is pressed', () => {
    const onMaximize = jest.fn();
    const { getByText } = render(
      <VoiceCallMinimized {...defaultProps} onMaximize={onMaximize} />
    );

    // Press the container (the duration text is inside)
    fireEvent.press(getByText('01:05').parent.parent);

    expect(onMaximize).toHaveBeenCalledTimes(1);
  });

  it('should update duration display when prop changes', () => {
    const { getByText, rerender } = render(
      <VoiceCallMinimized {...defaultProps} callDuration={0} />
    );

    expect(getByText('00:00')).toBeTruthy();

    rerender(<VoiceCallMinimized {...defaultProps} callDuration={3661} />);

    expect(getByText('61:01')).toBeTruthy();
  });
});
