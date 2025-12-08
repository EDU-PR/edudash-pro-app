/**
 * Sound Manager - Society 5.0 Futuristic Audio System
 * 
 * Manages preloading, playback, and caching of UI sounds for optimal performance.
 * Designed for low-latency audio feedback (<50ms) with memory efficiency.
 * 
 * Updated to use expo-audio (SDK 53+)
 */

import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import { Platform } from 'react-native';

export type OrbSound = 
  | 'awaken'      // FAB tap - AI waking up
  | 'pulse'       // Long press start
  | 'listening'   // Voice mode activated
  | 'thinking'    // Processing (loopable)
  | 'response'    // AI ready to respond
  | 'confirm'     // Action confirmed
  | 'error'       // Error state
  | 'dismiss';    // Modal close

interface SoundConfig {
  file: any;  // require() asset
  volume: number;
  loopable?: boolean;
}

const SOUND_ASSETS: Record<OrbSound, SoundConfig> = {
  // Using existing notification.wav as placeholder for all sounds
  // TODO: Replace with actual futuristic sound files when available
  awaken: { 
    file: require('@/assets/sounds/notification.wav'), 
    volume: 0.4 
  },
  pulse: { 
    file: require('@/assets/sounds/notification.wav'), 
    volume: 0.3 
  },
  listening: { 
    file: require('@/assets/sounds/notification.wav'), 
    volume: 0.3,
    loopable: true 
  },
  thinking: { 
    file: require('@/assets/sounds/notification.wav'), 
    volume: 0.2,
    loopable: true 
  },
  response: { 
    file: require('@/assets/sounds/notification.wav'), 
    volume: 0.4 
  },
  confirm: { 
    file: require('@/assets/sounds/notification.wav'), 
    volume: 0.3 
  },
  error: { 
    file: require('@/assets/sounds/notification.wav'), 
    volume: 0.4 
  },
  dismiss: { 
    file: require('@/assets/sounds/notification.wav'), 
    volume: 0.2 
  },
};

class SoundManagerClass {
  private sounds: Map<OrbSound, AudioPlayer> = new Map();
  private initialized = false;
  private loopingSounds: Set<OrbSound> = new Set();

  /**
   * Initialize audio system and preload sounds
   * Call this once during app startup
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Configure audio mode for UI sounds (not music)
      if (Platform.OS !== 'web') {
        await setAudioModeAsync({
          playsInSilentMode: true,
          interruptionMode: 'duckOthers',
          interruptionModeAndroid: 'duckOthers',
        });
      }

      console.log('[SoundManager] Audio mode configured');
      this.initialized = true;

      // Preload sounds in background (non-blocking)
      this.preloadSounds().catch(e => 
        console.warn('[SoundManager] Preload failed (non-critical):', e)
      );
    } catch (error) {
      console.error('[SoundManager] Initialization failed:', error);
    }
  }

  /**
   * Preload all sounds for instant playback
   */
  private async preloadSounds(): Promise<void> {
    console.log('[SoundManager] 🔊 Preloading sounds...');
    const startTime = Date.now();

    const loadPromises = Object.entries(SOUND_ASSETS).map(async ([key, config]) => {
      try {
        // Create audio player with the asset source
        const player = createAudioPlayer(config.file);
        player.volume = config.volume;
        player.loop = config.loopable || false;
        
        this.sounds.set(key as OrbSound, player);
        console.log(`[SoundManager] ✅ Loaded: ${key}`);
      } catch (error) {
        console.warn(`[SoundManager] ❌ Failed to load ${key}:`, error);
      }
    });

    await Promise.all(loadPromises);
    
    const duration = Date.now() - startTime;
    console.log(`[SoundManager] 🎵 Preloaded ${this.sounds.size} sounds in ${duration}ms`);
  }

  /**
   * Play a sound with optional callback
   */
  async play(soundType: OrbSound, options?: { 
    loop?: boolean;
    onFinish?: () => void;
  }): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      let player = this.sounds.get(soundType);
      
      // If sound not preloaded, load it on-demand
      if (!player) {
        console.log(`[SoundManager] Loading ${soundType} on-demand...`);
        const config = SOUND_ASSETS[soundType];
        player = createAudioPlayer(config.file);
        player.volume = config.volume;
        this.sounds.set(soundType, player);
      }

      // Stop and reset if already playing
      if (player.playing) {
        player.pause();
      }
      player.seekTo(0);

      // Configure looping
      const shouldLoop = options?.loop || SOUND_ASSETS[soundType].loopable;
      player.loop = shouldLoop || false;
      if (shouldLoop) {
        this.loopingSounds.add(soundType);
      }

      // Play sound
      player.play();
      
      // Set up finish polling for callback (expo-audio doesn't have callbacks)
      if (options?.onFinish && !shouldLoop) {
        const checkFinish = setInterval(() => {
          if (!player) {
            clearInterval(checkFinish);
            return;
          }
          if (player.duration > 0 && player.currentTime >= player.duration) {
            clearInterval(checkFinish);
            options.onFinish?.();
          }
        }, 100);
      }
    } catch (error) {
      console.warn(`[SoundManager] Failed to play ${soundType}:`, error);
    }
  }

  /**
   * Stop a looping sound
   */
  async stop(soundType: OrbSound): Promise<void> {
    try {
      const player = this.sounds.get(soundType);
      if (player) {
        player.pause();
        player.seekTo(0);
        this.loopingSounds.delete(soundType);
      }
    } catch (error) {
      console.warn(`[SoundManager] Failed to stop ${soundType}:`, error);
    }
  }

  /**
   * Stop all looping sounds
   */
  async stopAll(): Promise<void> {
    const stopPromises = Array.from(this.loopingSounds).map(soundType => 
      this.stop(soundType)
    );
    await Promise.all(stopPromises);
  }

  /**
   * Cleanup all sounds (call on app unmount)
   */
  async cleanup(): Promise<void> {
    console.log('[SoundManager] Cleaning up...');
    
    // Release all players
    for (const player of this.sounds.values()) {
      try {
        player.release();
      } catch {
        // Ignore cleanup errors
      }
    }
    
    this.sounds.clear();
    this.loopingSounds.clear();
    this.initialized = false;
    
    console.log('[SoundManager] Cleanup complete');
  }

  /**
   * Check if sound manager is ready
   */
  isReady(): boolean {
    return this.initialized;
  }

  /**
   * Get preloaded sound count
   */
  getLoadedCount(): number {
    return this.sounds.size;
  }
}

// Singleton instance
export const SoundManager = new SoundManagerClass();

// Convenience functions
export const playOrbSound = (sound: OrbSound, options?: Parameters<typeof SoundManager.play>[1]) => 
  SoundManager.play(sound, options);

export const stopOrbSound = (sound: OrbSound) => 
  SoundManager.stop(sound);

export const stopAllOrbSounds = () => 
  SoundManager.stopAll();

// Initialize on import (non-blocking)
if (Platform.OS !== 'web') {
  SoundManager.initialize().catch(console.warn);
}
