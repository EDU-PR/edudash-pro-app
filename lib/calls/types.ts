/**
 * Shared Call System Types
 * 
 * Used by both native (components/calls/) and web (web/src/components/calls/) implementations.
 * This file is the single source of truth for call-related types.
 */

// ============================================
// CALL STATE TYPES
// ============================================

export type CallState = 'idle' | 'connecting' | 'ringing' | 'connected' | 'ended' | 'failed';

export type CallType = 'voice' | 'video';

export type CallStatus = 'ringing' | 'connected' | 'ended' | 'rejected' | 'missed' | 'busy';

// ============================================
// CORE INTERFACES
// ============================================

export interface ActiveCall {
  id: string;
  call_id: string;
  caller_id: string;
  callee_id: string;
  call_type: CallType;
  status: CallStatus;
  caller_name?: string;
  meeting_url?: string;
  started_at: string;
}

export interface CallSignalPayload {
  meeting_url?: string;
  call_type?: CallType;
  caller_name?: string;
}

export interface CallSignal {
  id: string;
  call_id: string;
  from_user_id: string;
  to_user_id: string;
  signal_type: string;
  payload: CallSignalPayload | null;
  created_at: string;
}

export interface OutgoingCallParams {
  userId: string;
  userName?: string;
  callType: CallType;
}

// ============================================
// CONTEXT TYPE
// ============================================

export interface CallContextType {
  // Actions
  startVoiceCall: (userId: string, userName?: string) => void;
  startVideoCall: (userId: string, userName?: string) => void;
  answerCall: () => void;
  rejectCall: () => Promise<void> | void;
  endCall: () => Promise<void> | void;
  
  // State
  incomingCall: ActiveCall | null;
  outgoingCall: OutgoingCallParams | null;
  isCallActive: boolean;
  isInActiveCall: boolean;
  callState: CallState;
  
  // Navigation
  returnToCall: () => void;
  
  // Presence (unified across all components to avoid duplicate subscriptions)
  isUserOnline: (userId: string) => boolean;
  getLastSeenText: (userId: string) => string;
  refreshPresence: () => Promise<void>;
}

// ============================================
// DAILY.CO SPECIFIC TYPES
// ============================================

export interface DailyParticipant {
  session_id: string;
  user_id?: string;
  user_name?: string;
  local: boolean;
  audio: boolean;
  video: boolean;
  tracks: {
    audio?: {
      state: 'playable' | 'loading' | 'off' | 'interrupted' | 'blocked';
    };
    video?: {
      state: 'playable' | 'loading' | 'off' | 'interrupted' | 'blocked';
    };
  };
}

export interface DailyCallState {
  participants: Record<string, DailyParticipant>;
  localParticipant: DailyParticipant | null;
  remoteParticipants: DailyParticipant[];
}

// ============================================
// API RESPONSE TYPES
// ============================================

export interface DailyRoomResponse {
  room: {
    id: string;
    name: string;
    url: string;
    privacy: 'private' | 'public';
    config: {
      max_participants: number;
      exp: number;
    };
  };
}

export interface DailyTokenResponse {
  token: string;
}
