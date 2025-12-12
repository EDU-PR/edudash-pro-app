/**
 * Jest setup for component tests
 * 
 * Note: This file is used by jest.config.components.js
 * Most mocks are handled by jest-expo preset
 */

// Mock TurboModuleRegistry before anything else
jest.mock('react-native/Libraries/TurboModule/TurboModuleRegistry', () => ({
  getEnforcing: jest.fn(() => ({})),
  get: jest.fn(() => null),
}));

// Mock NativeDevMenu
jest.mock('react-native/src/private/devsupport/devmenu/specs/NativeDevMenu', () => ({
  __esModule: true,
  default: {},
}));

// Mock NativeEventEmitter
jest.mock('react-native/Libraries/EventEmitter/NativeEventEmitter', () => {
  return jest.fn().mockImplementation(() => ({
    addListener: jest.fn(),
    removeListeners: jest.fn(),
  }));
});

// Mock expo-blur
jest.mock('expo-blur', () => ({
  BlurView: ({ children }) => children,
}));

// Mock expo-haptics
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(() => Promise.resolve()),
  notificationAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
  NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' },
}));

// Mock @expo/vector-icons
jest.mock('@expo/vector-icons', () => ({
  Ionicons: 'Ionicons',
}));

// Mock react-native-safe-area-context
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: jest.fn(() => ({ top: 0, bottom: 0, left: 0, right: 0 })),
  SafeAreaProvider: ({ children }) => children,
}));

// Mock supabase
jest.mock('@/lib/supabase', () => ({
  assertSupabase: jest.fn(() => ({
    auth: {
      getSession: jest.fn(() => Promise.resolve({
        data: { session: { user: { id: 'test-user-id' }, access_token: 'test-token' } },
        error: null,
      })),
      refreshSession: jest.fn(() => Promise.resolve({
        data: { session: { user: { id: 'test-user-id' }, access_token: 'test-token' } },
        error: null,
      })),
    },
    from: jest.fn(() => ({
      insert: jest.fn(() => ({ select: jest.fn(() => Promise.resolve({ data: [], error: null })) })),
      update: jest.fn(() => ({ eq: jest.fn(() => Promise.resolve({ error: null })) })),
      select: jest.fn(() => ({ eq: jest.fn(() => ({ single: jest.fn(() => Promise.resolve({ data: { first_name: 'Test', last_name: 'User' }, error: null })) })) })),
    })),
    channel: jest.fn(() => ({
      on: jest.fn(() => ({ subscribe: jest.fn() })),
    })),
    removeChannel: jest.fn(),
  })),
}));

// Mock callkeep-manager
jest.mock('@/lib/calls/callkeep-manager', () => ({
  callKeepManager: {
    setup: jest.fn(() => Promise.resolve(true)),
    startCall: jest.fn(() => Promise.resolve()),
    reportConnected: jest.fn(() => Promise.resolve()),
    endCall: jest.fn(() => Promise.resolve()),
    cleanup: jest.fn(),
  },
}));

// Mock Daily.co SDK
jest.mock('@daily-co/react-native-daily-js', () => ({
  default: {
    createCallObject: jest.fn(() => ({
      on: jest.fn(),
      join: jest.fn(() => Promise.resolve()),
      leave: jest.fn(),
      destroy: jest.fn(),
      setInputDevicesAsync: jest.fn(() => Promise.resolve()),
      updateSendSettings: jest.fn(() => Promise.resolve()),
      localAudio: jest.fn(() => true),
      participants: jest.fn(() => ({ local: { user_id: 'test-user' } })),
      getLocalAudioTrack: jest.fn(() => Promise.resolve({ state: 'playable' })),
    })),
  },
}));

// Mock InCallManager
jest.mock('react-native-incall-manager', () => ({
  default: {
    start: jest.fn(),
    stop: jest.fn(),
    stopRingback: jest.fn(),
    setForceSpeakerphoneOn: jest.fn(),
  },
}));

// Mock uuid
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'test-uuid-1234'),
}));

// Suppress console noise
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};
