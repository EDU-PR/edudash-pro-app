/**
 * Tests for VoiceCallHeader component
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native/pure';
import { VoiceCallHeader } from '../VoiceCallHeader';

describe('VoiceCallHeader', () => {
  it('should display "Voice Call" title', () => {
    const { getByText } = render(<VoiceCallHeader onMinimize={jest.fn()} />);

    expect(getByText('Voice Call')).toBeTruthy();
  });

  it('should call onMinimize when minimize button is pressed', () => {
    const onMinimize = jest.fn();
    const { getByText, UNSAFE_getAllByType } = render(
      <VoiceCallHeader onMinimize={onMinimize} />
    );

    // Find the TouchableOpacity (the minimize button)
    const { TouchableOpacity } = require('react-native');
    const touchables = UNSAFE_getAllByType(TouchableOpacity);
    fireEvent.press(touchables[0]);

    expect(onMinimize).toHaveBeenCalledTimes(1);
  });
});
