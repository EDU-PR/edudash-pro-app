jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);
jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: null, profile: null }),
}));
jest.mock('@/contexts/SubscriptionContext', () => ({
  useSubscription: () => ({ tier: 'free' }),
}));

import { categorizeTTSError, getTTSErrorMessage } from '@/components/super-admin/voice-orb/useVoiceTTS';

describe('TTS error mapping', () => {
  it('classifies auth/service/network/playback categories', () => {
    expect(categorizeTTSError(new Error('AUTH_MISSING'))).toBe('auth_missing');
    expect(categorizeTTSError(new Error('TTS_THROTTLED_429'))).toBe('throttled');
    expect(categorizeTTSError(new Error('SERVICE_UNCONFIGURED_503'))).toBe('service_unconfigured');
    expect(categorizeTTSError(new Error('NETWORK_ERROR: fetch failed'))).toBe('network_error');
    expect(categorizeTTSError(new Error('PLAYBACK_ERROR:AUDIO_PLAYER_TIMEOUT'))).toBe('playback_error');
  });

  it('returns user-facing messages for each category', () => {
    expect(getTTSErrorMessage('auth_missing')).toContain('login session');
    expect(getTTSErrorMessage('throttled')).toContain('busy');
    expect(getTTSErrorMessage('service_unconfigured')).toContain('device voice');
    expect(getTTSErrorMessage('network_error')).toContain('Network');
    expect(getTTSErrorMessage('playback_error')).toContain('Audio playback');
  });
});
