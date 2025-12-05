/**
 * Call System Types
 * Shared types for the native video/voice call system
 */

export type CallState = 'idle' | 'connecting' | 'ringing' | 'connected' | 'ended' | 'failed';

export type CallType = 'voice' | 'video';

export type CallStatus = 'ringing' | 'connected' | 'ended' | 'rejected' | 'missed' | 'busy';

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

export interface CallContextType {
  // Actions
  startVoiceCall: (userId: string, userName?: string) => void;
  startVideoCall: (userId: string, userName?: string) => void;
  answerCall: () => void;
  rejectCall: () => void;
  endCall: () => void;
  
  // State
  incomingCall: ActiveCall | null;
  outgoingCall: OutgoingCallParams | null;
  isCallActive: boolean;
  isInActiveCall: boolean;
  callState: CallState;
  
  // Navigation
  returnToCall: () => void;
}

// Daily.co specific types for React Native
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

// API Response types
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
