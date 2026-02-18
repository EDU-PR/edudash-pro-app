import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, usePathname } from 'expo-router';
import { WakeWordModelLoader } from '@/lib/services/WakeWordModelLoader';
import { DeviceEventEmitter } from '@/lib/utils/eventEmitter';

/**
 * DashWakeWordListener
 *
 * Foreground-only wake-word listener (in-app) with graceful fallback when
 * native wake-word packages are not installed. When enabled and the app is
 * active, it listens for "Hello Dash" wake phrase and navigates to
 * the Dash Assistant screen.
 *
 * Uses custom trained Porcupine model from /assets/wake-words/
 * 
 * Notes:
 * - Background wake word is NOT supported here. This only runs in-app.
 * - Implementation attempts to load '@picovoice/porcupine-react-native' if available.
 *   If not installed, it silently disables listening and logs a message.
 */
export default function DashWakeWordListener() {
  const pathname = usePathname();
  const [enabled, setEnabled] = useState<boolean>(false);
  const appStateRef = useRef<string>('active');
  const enabledRef = useRef<boolean>(false);
  const pathnameRef = useRef<string>('');

  useEffect(() => { enabledRef.current = enabled; }, [enabled]);
  useEffect(() => { pathnameRef.current = pathname || ''; }, [pathname]);

  // Porcupine manager ref (if available)
  const porcupineManagerRef = useRef<any>(null);
  const isListeningRef = useRef<boolean>(false);
  const isHandlingWakeRef = useRef<boolean>(false);

  useEffect(() => {
    let mounted = true;

    const loadToggle = async () => {
      try {
        const value = await AsyncStorage.getItem('@dash_ai_in_app_wake_word');
        if (mounted) setEnabled(value === 'true');
      } catch { /* Intentional: non-fatal */ }
    };

    loadToggle();

    const sub = AppState.addEventListener('change', async (next) => {
      appStateRef.current = next;
      if (next === 'active') {
        await loadToggle();
        if (enabledRef.current) startListening().catch(() => { /* Intentional: error handled */ });
      } else {
        stopListening().catch(() => { /* Intentional: error handled */ });
      }
    });

    const wakeWordSub = DeviceEventEmitter.addListener('dash:wake_word_toggle', (value: boolean) => {
      setEnabled(!!value);
    });

    // Start if already active and enabled
    if (appStateRef.current === 'active' && enabledRef.current) {
      startListening().catch(() => { /* Intentional: error handled */ });
    }

    return () => {
      mounted = false;
      sub.remove();
      wakeWordSub?.remove?.();
      stopListening().catch(() => { /* Intentional: error handled */ });
      release().catch(() => { /* Intentional: error handled */ });
    };
     
  }, []);

  useEffect(() => {
    // React to settings changes
    if (appStateRef.current === 'active') {
      if (enabled) startListening().catch(() => { /* Intentional: error handled */ });
      else stopListening().catch(() => { /* Intentional: error handled */ });
    }
  }, [enabled]);

  function isWakeWordBlockedRoute(p: string): boolean {
    // Avoid mic conflicts with voice + call surfaces; wake word is meant to *open* the ORB.
    return (
      p.includes('/dash-voice') ||
      p.includes('/dash-orb') ||
      p.includes('/dash-assistant') ||
      p.includes('/super-admin-ai') ||
      p.includes('/calls')
    );
  }

  const shouldPauseOnRoute = useMemo(() => {
    const p = pathname || '';
    return isWakeWordBlockedRoute(p);
  }, [pathname]);

  useEffect(() => {
    // Pause/resume on route changes to prevent microphone contention.
    if (appStateRef.current !== 'active') return;
    if (!enabled) return;
    if (shouldPauseOnRoute) {
      stopListening().catch(() => {});
    } else {
      startListening().catch(() => {});
    }
  }, [enabled, shouldPauseOnRoute]);

  const ensurePorcupine = async (): Promise<boolean> => {
    if (Platform.OS === 'web') return false;
    if (porcupineManagerRef.current) return true;

    try {
      // Dynamic import to avoid hard dependency when module isn't installed
      const { PorcupineManager } = require('@picovoice/porcupine-react-native');
      const accessKey = process.env.EXPO_PUBLIC_PICOVOICE_ACCESS_KEY || '';

      if (!accessKey) {
        console.debug('[DashWakeWord] No Picovoice access key provided; wake word disabled');
        setEnabled(false);
        try {
          await AsyncStorage.setItem('@dash_ai_in_app_wake_word', 'false');
        } catch {}
        DeviceEventEmitter.emit('dash:wake_word_toggle', false);
        return false;
      }

      // Try custom "Hello Dash" model first, fall back to built-in "COMPUTER"
      let modelPath: string | null = null;
      try {
        modelPath = await WakeWordModelLoader.loadHelloDashModel();
        console.log('[DashWakeWord] Loaded custom Hello Dash model:', modelPath);
      } catch (e) {
        console.debug('[DashWakeWord] Custom model not available, trying built-in:', e);
      }

      if (modelPath) {
        // Use custom model
        porcupineManagerRef.current = await PorcupineManager.fromKeywordPaths(
          accessKey,
          [modelPath],
          () => {
            if (isHandlingWakeRef.current) return;
            isHandlingWakeRef.current = true;
            setTimeout(() => { isHandlingWakeRef.current = false; }, 1500);
            const currentPath = pathnameRef.current || '';
            if (currentPath.includes('/dash-voice')) return;
            console.log('[DashWakeWord] Wake word detected! Opening voice orb...');
            stopListening().catch(() => {});
            router.push('/screens/dash-voice?mode=orb&wake=1');
          },
          (error: any) => { console.debug('[DashWakeWord] Porcupine error:', error); }
        );
      } else {
        // Fallback: use built-in "COMPUTER" keyword (say "Computer" to activate)
        const { BuiltInKeyword } = require('@picovoice/porcupine-react-native');
        porcupineManagerRef.current = await PorcupineManager.fromBuiltInKeywords(
          accessKey,
          [BuiltInKeyword.COMPUTER],
          () => {
            if (isHandlingWakeRef.current) return;
            isHandlingWakeRef.current = true;
            setTimeout(() => { isHandlingWakeRef.current = false; }, 1500);
            const currentPath = pathnameRef.current || '';
            if (currentPath.includes('/dash-voice')) return;
            console.log('[DashWakeWord] Wake word (Computer) detected! Opening voice orb...');
            stopListening().catch(() => {});
            router.push('/screens/dash-voice?mode=orb&wake=1');
          },
          (error: any) => { console.debug('[DashWakeWord] Porcupine error:', error); }
        );
        console.log('[DashWakeWord] Using built-in COMPUTER keyword (say "Computer" to activate)');
      }

      console.log('[DashWakeWord] Porcupine manager initialized');
      return true;
    } catch (e) {
      console.debug('[DashWakeWord] Wake word engine not available or failed to init:', e);
      setEnabled(false);
      try {
        await AsyncStorage.setItem('@dash_ai_in_app_wake_word', 'false');
      } catch {}
      DeviceEventEmitter.emit('dash:wake_word_toggle', false);
      return false;
    }
  };

  const startListening = async () => {
    if (isListeningRef.current) return;
    if (!enabled) return;
    const currentPath = pathnameRef.current || '';
    if (isWakeWordBlockedRoute(currentPath)) return;

    const ok = await ensurePorcupine();
    if (!ok) return;

    try {
      // Start the Porcupine manager (opens mic + processes frames)
      if (porcupineManagerRef.current && porcupineManagerRef.current.start) {
        await porcupineManagerRef.current.start();
      }
      isListeningRef.current = true;
      console.log('[DashWakeWord] Listening for "Hello Dash" (in app)');
    } catch (e) {
      console.debug('[DashWakeWord] Failed to start listening:', e);
    }
  };

  const stopListening = async () => {
    if (!isListeningRef.current) return;
    try {
      if (porcupineManagerRef.current && porcupineManagerRef.current.stop) {
        await porcupineManagerRef.current.stop();
      }
      isListeningRef.current = false;
      console.log('[DashWakeWord] Stopped listening');
    } catch { /* Intentional: non-fatal */ }
  };

  const release = async () => {
    try {
      if (porcupineManagerRef.current?.delete) porcupineManagerRef.current.delete();
      porcupineManagerRef.current = null;
    } catch { /* Intentional: non-fatal */ }
  };

  return null; // Invisible background helper
}
