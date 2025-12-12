/**
 * Voice Call Timeout Hook
 * 
 * Manages ringing timeout (30 seconds like WhatsApp):
 * - Starts timeout when call enters ringing state
 * - Marks call as missed if not answered
 * - Clears timeout when call connects
 */

import { useEffect, useRef } from 'react';
import * as Haptics from 'expo-haptics';
import { assertSupabase } from '@/lib/supabase';
import type { CallState } from '../types';

const getSupabase = () => assertSupabase();

// Ring timeout duration (30 seconds)
const RING_TIMEOUT_MS = 30000;

export interface VoiceCallTimeoutOptions {
  callState: CallState;
  isOwner: boolean;
  callIdRef: React.MutableRefObject<string | null>;
  setError: (error: string | null) => void;
  setCallState: (state: CallState) => void;
  cleanupCall: () => void;
  onClose: () => void;
}

export function useVoiceCallTimeout({
  callState,
  isOwner,
  callIdRef,
  setError,
  setCallState,
  cleanupCall,
  onClose,
}: VoiceCallTimeoutOptions): void {
  const ringingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Ringing timeout - end call if not answered within 30 seconds
  useEffect(() => {
    if (callState === 'ringing' && isOwner) {
      console.log('[VoiceCallTimeout] Starting ring timeout:', RING_TIMEOUT_MS, 'ms');
      
      ringingTimeoutRef.current = setTimeout(async () => {
        console.log('[VoiceCallTimeout] Ring timeout - no answer, marking as missed');
        
        // Update call status to missed
        if (callIdRef.current) {
          await getSupabase()
            .from('active_calls')
            .update({ status: 'missed' })
            .eq('call_id', callIdRef.current);
        }
        
        setError('No answer');
        setCallState('ended');
        
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
        
        // Close after brief delay
        setTimeout(() => {
          cleanupCall();
          onClose();
        }, 2000);
      }, RING_TIMEOUT_MS);
    }

    return () => {
      if (ringingTimeoutRef.current) {
        clearTimeout(ringingTimeoutRef.current);
        ringingTimeoutRef.current = null;
      }
    };
  }, [callState, isOwner, callIdRef, setError, setCallState, cleanupCall, onClose]);

  // Clear timeout when call connects
  useEffect(() => {
    if (callState === 'connected' && ringingTimeoutRef.current) {
      console.log('[VoiceCallTimeout] Call connected, clearing ring timeout');
      clearTimeout(ringingTimeoutRef.current);
      ringingTimeoutRef.current = null;
    }
  }, [callState]);
}
