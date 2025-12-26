/**
 * Shared Messaging Components
 *
 * Chat and communication components that work across dashboards
 */

// Re-export voice messaging components
// These are the primary shared messaging components using expo-audio

export { default as VoiceMessageBubble } from '../../messaging/VoiceMessageBubble';
export { default as InlineVoiceRecorder } from '../../messaging/InlineVoiceRecorder';
export type { VoiceRecordingResult, InlineVoiceRecorderRef } from '../../messaging/InlineVoiceRecorder';
