/**
 * Tests for VoiceCallHeader component
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { VoiceCallHeader } from '../VoiceCallHeader';

describe('VoiceCallHeader', () => {
  it('should display "Voice Call" title', () => {
    const { getByText } = render(<VoiceCallHeader onMinimize={jest.fn()} />);

    expect(getByText('Voice Call')).toBeTruthy();
  });

  it('should call onMinimize when minimize button is pressed', () => {
    const onMinimize = jest.fn();
    const { getByText } = render(<VoiceCallHeader onMinimize={onMinimize} />);

    // The minimize button is next to "Voice Call" text
    // Find the touchable by finding the title and navigating to sibling
    const title = getByText('Voice Call');
    const header = title.parent;
    const minimizeButton = header.children[0];

    fireEvent.press(minimizeButton);

    expect(onMinimize).toHaveBeenCalledTimes(1);
  });
});
