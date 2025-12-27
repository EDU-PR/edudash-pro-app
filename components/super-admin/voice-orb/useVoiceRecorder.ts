/**
 * useVoiceRecorder Hook
 * 
 * Handles audio recording with metering for silence detection.
 * Extracted from VoiceOrb per WARP.md guidelines.
 * 
 * @module components/super-admin/voice-orb/useVoiceRecorder
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { 
  useAudioRecorder, 
  useAudioRecorderState,
  AudioModule,
  RecordingPresets,
} from 'expo-audio';

// Silence detection settings
// Speech threshold is configurable via env (default -30dB for better sensitivity in quiet environments)
const SPEECH_THRESHOLD = parseFloat(process.env.EXPO_PUBLIC_VOICE_SPEECH_THRESHOLD || '-30');
const SILENCE_DURATION_MS = 2500; // Auto-send after 2.5 seconds without speech (increased from 1.5s to allow full sentences)
const MIN_RECORDING_MS = 800; // Minimum recording time before allowing auto-send
const MAX_RECORDING_MS = 30000; // Maximum recording time (30 seconds)

export interface VoiceRecorderState {
  isRecording: boolean;
  audioLevel: number;
  hasSpeechStarted: boolean;
  recordingDuration: number;
}

export interface VoiceRecorderActions {
  startRecording: () => Promise<boolean>;
  stopRecording: () => Promise<string | null>;
}

export function useVoiceRecorder(
  onSilenceDetected?: () => void
): [VoiceRecorderState, VoiceRecorderActions, number | null] {
  const [audioLevel, setAudioLevel] = useState(0);
  const [hasSpeechStarted, setHasSpeechStarted] = useState(false);
  
  // Recording options with metering enabled
  const recordingOptions = {
    ...RecordingPresets.HIGH_QUALITY,
    isMeteringEnabled: true,
  };
  
  const recorder = useAudioRecorder(recordingOptions);
  const recorderState = useAudioRecorderState(recorder, 150);
  
  // Refs for silence detection
  const lastSoundTime = useRef<number>(Date.now());
  const recordingStartTime = useRef<number>(Date.now());
  const speechDetected = useRef<boolean>(false);
  const silenceTriggered = useRef<boolean>(false); // Prevent multiple triggers
  const lastUpdateTime = useRef<number>(0);

  // Process metering data in useEffect to avoid render-time side effects
  useEffect(() => {
    if (!recorderState.isRecording || silenceTriggered.current) return;
    
    const metering = recorderState.metering ?? -160;
    const normalizedLevel = Math.max(0, Math.min(1, (metering + 60) / 60));
    const now = Date.now();
    const recordingDuration = now - recordingStartTime.current;
    
    // Throttle state updates to every 200ms
    if (now - lastUpdateTime.current > 200) {
      setAudioLevel(normalizedLevel);
      lastUpdateTime.current = now;
    }
    
    // Detect speech
    if (metering > SPEECH_THRESHOLD) {
      if (!speechDetected.current) {
        speechDetected.current = true;
        setHasSpeechStarted(true);
        console.log('[VoiceRecorder] 🎤 Speech detected!', { metering: metering.toFixed(1) });
      }
      lastSoundTime.current = now;
    }
    
    // Check for silence after speech
    const timeSinceSpeech = now - lastSoundTime.current;
    
    if (speechDetected.current && recordingDuration > MIN_RECORDING_MS) {
      if (timeSinceSpeech > SILENCE_DURATION_MS && !silenceTriggered.current) {
        console.log('[VoiceRecorder] 🔇 Silence detected, triggering callback...');
        silenceTriggered.current = true; // Prevent further triggers
        onSilenceDetected?.();
        return;
      }
    }
    
    // Safety: auto-trigger after max recording time
    if (recordingDuration > MAX_RECORDING_MS && !silenceTriggered.current) {
      console.log('[VoiceRecorder] ⏱️ Max recording time reached');
      silenceTriggered.current = true; // Prevent further triggers
      onSilenceDetected?.();
    }
  }, [recorderState.metering, recorderState.isRecording, onSilenceDetected]);

  // Start recording
  const startRecording = useCallback(async (): Promise<boolean> => {
    try {
      console.log('[VoiceRecorder] Starting recording...');
      
      const status = await AudioModule.requestRecordingPermissionsAsync();
      if (!status.granted) {
        console.error('[VoiceRecorder] Recording permission denied');
        return false;
      }
      
      // Reset state
      speechDetected.current = false;
      silenceTriggered.current = false; // Reset trigger flag
      setHasSpeechStarted(false);
      recordingStartTime.current = Date.now();
      lastSoundTime.current = Date.now();
      lastUpdateTime.current = 0;
      
      await recorder.prepareToRecordAsync();
      recorder.record();
      
      console.log('[VoiceRecorder] Recording started');
      return true;
    } catch (error) {
      console.error('[VoiceRecorder] Error starting recording:', error);
      return false;
    }
  }, [recorder]);

  // Stop recording
  const stopRecording = useCallback(async (): Promise<string | null> => {
    try {
      // Mark as triggered to stop further processing
      silenceTriggered.current = true;
      
      if (!recorderState.isRecording) {
        return null;
      }
      
      console.log('[VoiceRecorder] Stopping recording...');
      await recorder.stop();
      
      const uri = recorder.uri;
      console.log('[VoiceRecorder] Recording stopped, URI:', uri ? 'obtained' : 'null');
      return uri || null;
    } catch (error) {
      console.error('[VoiceRecorder] Error stopping recording:', error);
      return null;
    }
  }, [recorder, recorderState.isRecording]);

  const state: VoiceRecorderState = {
    isRecording: recorderState.isRecording,
    audioLevel,
    hasSpeechStarted,
    recordingDuration: Date.now() - recordingStartTime.current,
  };

  const actions: VoiceRecorderActions = {
    startRecording,
    stopRecording,
  };

  return [state, actions, recorderState.metering ?? null];
}

export default useVoiceRecorder;
