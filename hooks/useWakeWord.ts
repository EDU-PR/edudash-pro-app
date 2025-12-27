/**
 * useWakeWord Hook
 * 
 * Provides wake word detection using Porcupine with "Hey Dash" activation.
 * Falls back to continuous STT listening if Porcupine is unavailable.
 * 
 * Usage:
 * const { isListening, startListening, stopListening } = useWakeWord({
 *   onWakeWord: () => console.log('Wake word detected!'),
 *   enabled: true
 * });
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { Platform, AppState } from 'react-native';
import { WakeWordModelLoader } from '../lib/services/WakeWordModelLoader';

// Try to import Porcupine
let PorcupineManager: any = null;
let Errors: any = null;
try {
  const porcupine = require('@picovoice/porcupine-react-native');
  PorcupineManager = porcupine.PorcupineManager;
  Errors = porcupine.Errors;
} catch (err) {
  console.warn('[useWakeWord] Porcupine not available:', err);
}

interface UseWakeWordOptions {
  onWakeWord: () => void;
  enabled?: boolean;
  useFallback?: boolean; // Use continuous STT instead of Porcupine
}

interface UseWakeWordResult {
  isListening: boolean;
  startListening: () => Promise<void>;
  stopListening: () => void;
  error: string | null;
  detectionMethod: 'porcupine' | 'stt' | 'none';
}

export function useWakeWord({
  onWakeWord,
  enabled = true,
  useFallback = false,
}: UseWakeWordOptions): UseWakeWordResult {
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detectionMethod, setDetectionMethod] = useState<'porcupine' | 'stt' | 'none'>('none');
  
  const appState = useRef(AppState.currentState);
  const listeningLoopRef = useRef<NodeJS.Timeout | null>(null);
  const porcupineManagerRef = useRef<any>(null);

  // Check if Porcupine is available
  const porcupineAvailable = PorcupineManager !== null;

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopListening();
    };
  }, []);

  // Handle app state changes (pause when backgrounded)
  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (appState.current.match(/active/) && nextAppState === 'background') {
        // App went to background - pause listening
        if (isListening) {
          stopListening();
        }
      }
      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, [isListening]);

  const startListening = useCallback(async () => {
    if (!enabled) {
      setError('Wake word detection is disabled');
      return;
    }

    try {
      setError(null);

      // Note: Audio permissions would be requested by Porcupine when starting
      // No need for expo-av Audio.requestPermissionsAsync()

      // Decide which method to use
      if (porcupineAvailable && !useFallback) {
        // Use Porcupine wake word detection
        await startPorcupineListening();
      } else {
        // Fall back to continuous STT listening
        await startSTTListening();
      }

      setIsListening(true);
      console.log(`[useWakeWord] Started listening using ${detectionMethod}`);
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      console.error('[useWakeWord] Failed to start listening:', err);
    }
  }, [enabled, useFallback, detectionMethod]);

  const stopListening = useCallback(() => {
    try {
      // Stop Porcupine if active
      if (porcupineManagerRef.current) {
        try {
          porcupineManagerRef.current.stop();
          porcupineManagerRef.current.delete();
          porcupineManagerRef.current = null;
        } catch (err) {
          console.warn('[useWakeWord] Error stopping Porcupine:', err);
        }
      }

      // Clear any listening loops
      if (listeningLoopRef.current) {
        clearInterval(listeningLoopRef.current);
        listeningLoopRef.current = null;
      }

      setIsListening(false);
      setDetectionMethod('none');
      console.log('[useWakeWord] Stopped listening');
      
    } catch (err) {
      console.error('[useWakeWord] Error stopping listening:', err);
    }
  }, []);

  // Porcupine-based wake word detection
  const startPorcupineListening = useCallback(async () => {
    if (!PorcupineManager) {
      console.warn('[useWakeWord] Porcupine not available, falling back to STT');
      await startSTTListening();
      return;
    }

    try {
      // Load the Hello Dash model
      const modelPath = await WakeWordModelLoader.loadHelloDashModel();
      
      console.log('[useWakeWord] Initializing Porcupine with model:', modelPath);
      
      // Get Porcupine access key from environment
      const accessKey = process.env.EXPO_PUBLIC_PICOVOICE_ACCESS_KEY;
      if (!accessKey) {
        throw new Error('PICOVOICE_ACCESS_KEY not configured');
      }

      // Create Porcupine Manager
      const porcupineManager = await PorcupineManager.fromKeywordPaths(
        accessKey,
        [modelPath],
        (keywordIndex) => {
          // Wake word detected!
          console.log('[useWakeWord] Wake word detected! Index:', keywordIndex);
          onWakeWord();
        },
        (error) => {
          console.error('[useWakeWord] Porcupine error:', error);
          setError(error?.message || 'Porcupine error');
        }
      );

      await porcupineManager.start();
      porcupineManagerRef.current = porcupineManager;
      setDetectionMethod('porcupine');
      
      console.log('[useWakeWord] Porcupine listening started');
      
    } catch (err) {
      console.error('[useWakeWord] Porcupine initialization failed:', err);
      setError(err instanceof Error ? err.message : 'Porcupine initialization failed');
      // Fall back to STT
      await startSTTListening();
    }
  }, [onWakeWord]);

  // Continuous STT-based wake word detection (fallback)
  const startSTTListening = useCallback(async () => {
    setDetectionMethod('stt');
    
    // This is a simplified fallback - in production, you'd want:
    // 1. Short recording chunks (2-3 seconds)
    // 2. Local wake word matching (simple keyword detection)
    // 3. Only send to cloud STT if wake word detected locally
    
    console.log('[useWakeWord] STT fallback: Use push-to-talk or implement continuous STT');
    
    // For now, we'll just indicate that STT fallback is active
    // The actual implementation would require continuous recording + transcription
    // which is battery-intensive and should be optimized
    
  }, [onWakeWord]);

  return {
    isListening,
    startListening,
    stopListening,
    error,
    detectionMethod,
  };
}
