/**
 * Call System Types
 * 
 * Re-exports from lib/calls/types.ts for backward compatibility.
 * The shared types are now centralized in lib/calls/ for use by both
 * native and web implementations.
 */

export type {
  CallState,
  CallType,
  CallStatus,
  ActiveCall,
  CallSignalPayload,
  CallSignal,
  OutgoingCallParams,
  CallContextType,
  DailyParticipant,
  DailyCallState,
  DailyRoomResponse,
  DailyTokenResponse,
} from '../../lib/calls/types';

