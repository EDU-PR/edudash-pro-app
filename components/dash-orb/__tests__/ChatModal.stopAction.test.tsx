import React from 'react';
import { fireEvent, render } from '@testing-library/react-native/pure';
import { ChatModal } from '../ChatModal';

jest.mock('@/contexts/ThemeContext', () => ({
  useTheme: () => ({
    theme: {
      surface: '#101828',
      border: '#334155',
      accent: '#22d3ee',
      primary: '#4f46e5',
      text: '#f8fafc',
      textSecondary: '#94a3b8',
      background: '#0f172a',
      onPrimary: '#ffffff',
    },
  }),
}));

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ profile: { role: 'parent' } }),
}));

jest.mock('@/hooks/useRealtimeTier', () => ({
  useRealtimeTier: () => ({ tierStatus: null }),
}));

jest.mock('../DashOrb.styles', () => ({
  createDashOrbStyles: () => new Proxy({}, { get: () => ({}) }),
  getMarkdownStyles: () => ({}),
}));

jest.mock('../QuickActions', () => ({
  QuickActions: () => null,
}));

jest.mock('../CosmicOrb', () => ({
  CosmicOrb: () => null,
}));

jest.mock('react-native-safe-area-context', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    SafeAreaView: ({ children }: { children?: React.ReactNode }) => <View>{children}</View>,
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  };
});

jest.mock('expo-linear-gradient', () => ({
  LinearGradient: ({ children }: { children?: React.ReactNode }) => {
    const { View } = require('react-native');
    return <View>{children}</View>;
  },
}));

jest.mock('@expo/vector-icons', () => ({
  Ionicons: ({ name }: { name?: string }) => {
    const { Text } = require('react-native');
    return <Text>{name || 'icon'}</Text>;
  },
}));

jest.mock('@/components/ui/EduDashSpinner', () => () => null);

jest.mock('@/lib/ai/dashRoleCopy', () => ({
  getDashAIRoleCopy: () => ({ title: 'Dash', subtitle: 'Tutor Session Active' }),
}));

jest.mock('@/services/AttachmentService', () => ({
  createSignedUrl: jest.fn(async () => 'https://example.com/signed.jpg'),
}));

describe('ChatModal stop action', () => {
  const baseProps = {
    visible: true,
    onClose: jest.fn(),
    messages: [],
    inputText: '',
    setInputText: jest.fn(),
    onSend: jest.fn(),
    isProcessing: false,
    showQuickActions: false,
    onQuickAction: jest.fn(),
  };

  it('shows stop control and triggers callback while active', () => {
    const onStopActivity = jest.fn();
    const { getByTestId } = render(
      <ChatModal
        {...baseProps}
        isProcessing
        onStopActivity={onStopActivity}
      />
    );

    fireEvent.press(getByTestId('chat-modal-stop-button'));
    expect(onStopActivity).toHaveBeenCalledTimes(1);
  });

  it('hides stop control when idle', () => {
    const { queryByTestId } = render(
      <ChatModal
        {...baseProps}
        isProcessing={false}
        isSpeaking={false}
        isListeningForCommand={false}
        onStopActivity={jest.fn()}
      />
    );

    expect(queryByTestId('chat-modal-stop-button')).toBeNull();
  });
});
