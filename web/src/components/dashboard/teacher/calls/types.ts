export type CallType = 'voice' | 'video';
export type CallDirection = 'incoming' | 'outgoing';
export type CallStatus = 'completed' | 'missed' | 'declined' | 'no_answer' | 'ringing' | 'connected' | 'ended' | 'rejected' | 'busy';
export type FilterType = 'all' | 'missed' | 'incoming' | 'outgoing' | 'video' | 'voice';

export interface ProfileMini {
  first_name: string | null;
  last_name: string | null;
  avatar_url?: string | null;
}

export interface CallRecord {
  id: string;
  caller_id: string;
  callee_id: string;
  call_type: CallType;
  direction: CallDirection;
  status: CallStatus;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number | null;
  caller_profile?: ProfileMini | null;
  callee_profile?: ProfileMini | null;
}

export interface RawCallRow {
  id: string;
  caller_id: string;
  callee_id: string;
  call_type: string;
  status: string;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number | null;
}

export const isMissed = (status: string): boolean =>
  status === 'missed' || status === 'no_answer' || status === 'rejected';

export const formatDuration = (seconds: number | null): string => {
  if (!seconds || seconds <= 0) return '0s';
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}m ${remainder}s`;
};

export const HIDDEN_CALLS_KEY = 'edudash_hidden_calls';

export const getHiddenCallIds = (): Set<string> => {
  try {
    const raw = localStorage.getItem(HIDDEN_CALLS_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as string[];
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
};

export const hideCallIds = (ids: string[]): void => {
  try {
    const existing = getHiddenCallIds();
    ids.forEach((id) => existing.add(id));
    localStorage.setItem(HIDDEN_CALLS_KEY, JSON.stringify([...existing]));
  } catch {
    // localStorage unavailable — silent fallback
  }
};

export const getContactName = (call: CallRecord): string => {
  const profileData = call.direction === 'outgoing' ? call.callee_profile : call.caller_profile;
  if (!profileData) return 'Unknown';
  const name = `${profileData.first_name || ''} ${profileData.last_name || ''}`.trim();
  return name || 'Unknown';
};

export const getPeerId = (call: CallRecord): string =>
  call.direction === 'outgoing' ? call.callee_id : call.caller_id;
