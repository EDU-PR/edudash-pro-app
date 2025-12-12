/**
 * Tests for VoiceCallError component
 */

import React from 'react';
import { render } from '@testing-library/react-native';
import { VoiceCallError } from '../VoiceCallError';

describe('VoiceCallError', () => {
  it('should not render when error is null', () => {
    const { queryByText } = render(<VoiceCallError error={null} />);

    expect(queryByText(/./)).toBeNull();
  });

  it('should display error message when provided', () => {
    const { getByText } = render(
      <VoiceCallError error="Connection failed. Please try again." />
    );

    expect(getByText('Connection failed. Please try again.')).toBeTruthy();
  });

  it('should display different error messages', () => {
    const { getByText, rerender } = render(
      <VoiceCallError error="Microphone permission denied." />
    );

    expect(getByText('Microphone permission denied.')).toBeTruthy();

    rerender(<VoiceCallError error="No internet connection." />);

    expect(getByText('No internet connection.')).toBeTruthy();
  });
});
