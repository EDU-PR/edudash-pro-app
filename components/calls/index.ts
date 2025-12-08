/**
 * Native Call System
 * 
 * Video and voice call components for React Native using Daily.co SDK.
 * All components are feature-flagged and only active when enabled.
 * 
 * Usage:
 * 1. Wrap your app with CallProvider
 * 2. Use useCall() hook to start/answer calls
 * 3. Render IncomingCallOverlay at the root level
 * 
 * Required environment variables:
 * - EXPO_PUBLIC_ENABLE_VIDEO_CALLS=true
 * - EXPO_PUBLIC_ENABLE_VOICE_CALLS=true
 * 
 * Note: Requires a development build (npx expo prebuild) for native modules.
 */

// Provider and Hooks
export { CallProvider, useCall, useCallSafe } from './CallProvider';

// Call Interfaces
export { VoiceCallInterface } from './VoiceCallInterface';
export { VideoCallInterface } from './VideoCallInterface';
export { IncomingCallOverlay } from './IncomingCallOverlay';

// WhatsApp-Style Components (Enhanced UI)
export { WhatsAppStyleIncomingCall } from './WhatsAppStyleIncomingCall';
export { WhatsAppStyleVideoCall } from './WhatsAppStyleVideoCall';

// Live Lessons (Group Calls)
export { StartLiveLesson } from './StartLiveLesson';
export { JoinLiveLesson } from './JoinLiveLesson';

// Types
export type {
  CallState,
  CallType,
  CallStatus,
  ActiveCall,
  CallSignal,
  CallSignalPayload,
  CallContextType,
  OutgoingCallParams,
  DailyParticipant,
  DailyCallState,
} from './types';
