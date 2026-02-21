import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createAudioPlayer, type AudioPlayer } from 'expo-audio';
import {
  PHONICS_CLIP_MAP,
  PHONICS_CLIP_CATALOG,
  type NativePhonicsAssetKey,
  type PhonicsClipId,
} from '@/lib/phonics/clipCatalog';

const NATIVE_ASSET_MAP: Record<NativePhonicsAssetKey, number> = {
  'letter-a': require('@/assets/phonics/en-ZA/letter-a.mp3'),
  'letter-e': require('@/assets/phonics/en-ZA/letter-e.mp3'),
  'letter-i': require('@/assets/phonics/en-ZA/letter-i.mp3'),
  'letter-o': require('@/assets/phonics/en-ZA/letter-o.mp3'),
  'letter-u': require('@/assets/phonics/en-ZA/letter-u.mp3'),
  'blend-sh': require('@/assets/phonics/en-ZA/blend-sh.mp3'),
  'blend-ch': require('@/assets/phonics/en-ZA/blend-ch.mp3'),
  'blend-th': require('@/assets/phonics/en-ZA/blend-th.mp3'),
  'viseme-open-vowel': require('@/assets/phonics/en-ZA/viseme-open-vowel.mp3'),
  'viseme-lip-round': require('@/assets/phonics/en-ZA/viseme-lip-round.mp3'),
};

interface UsePhonicsClipsResult {
  clips: typeof PHONICS_CLIP_CATALOG;
  activeClipId: PhonicsClipId | null;
  playClip: (id: PhonicsClipId) => void;
  stop: () => void;
}

export function usePhonicsClips(): UsePhonicsClipsResult {
  const playersRef = useRef<Map<PhonicsClipId, AudioPlayer>>(new Map());
  const activeRef = useRef<PhonicsClipId | null>(null);
  const [activeClipId, setActiveClipId] = useState<PhonicsClipId | null>(null);

  const getPlayer = useCallback((id: PhonicsClipId): AudioPlayer => {
    const existing = playersRef.current.get(id);
    if (existing) return existing;

    const clip = PHONICS_CLIP_MAP[id];
    const player = createAudioPlayer(NATIVE_ASSET_MAP[clip.nativeAssetKey]);
    player.volume = 0.9;
    playersRef.current.set(id, player);
    return player;
  }, []);

  const stop = useCallback(() => {
    const active = activeRef.current;
    if (!active) return;

    const player = playersRef.current.get(active);
    if (player) {
      try {
        player.pause();
        player.seekTo(0);
      } catch {
        // no-op
      }
    }
    activeRef.current = null;
    setActiveClipId(null);
  }, []);

  const playClip = useCallback((id: PhonicsClipId) => {
    if (activeRef.current === id) {
      stop();
      return;
    }

    stop();

    const player = getPlayer(id);
    try {
      player.seekTo(0);
      player.play();
      activeRef.current = id;
      setActiveClipId(id);

      // Best-effort cleanup after short clip playback.
      setTimeout(() => {
        if (activeRef.current === id) {
          setActiveClipId(null);
          activeRef.current = null;
        }
      }, 5000);
    } catch {
      setActiveClipId(null);
      activeRef.current = null;
    }
  }, [getPlayer, stop]);

  useEffect(() => {
    return () => {
      playersRef.current.forEach((player) => {
        try {
          player.pause();
          player.remove();
        } catch {
          // no-op
        }
      });
      playersRef.current.clear();
      activeRef.current = null;
    };
  }, []);

  return useMemo(
    () => ({
      clips: PHONICS_CLIP_CATALOG,
      activeClipId,
      playClip,
      stop,
    }),
    [activeClipId, playClip, stop],
  );
}
