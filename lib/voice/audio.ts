/**
 * Audio Playback Manager
 * 
 * Handles audio playback for TTS using expo-audio
 * Recording removed - use streaming via useVoiceController instead
 * Now uses AudioModeCoordinator to prevent conflicts with WebRTC streaming
 * 
 * Updated to use expo-audio (SDK 53+) hook-based API
 */

import { AudioModule, createAudioPlayer, type AudioPlayer } from 'expo-audio';
import type { PlaybackState } from './types';
import AudioModeCoordinator, { AudioModeSession } from '../AudioModeCoordinator';

export class AudioManager {
  private static instance: AudioManager | null = null;
  private player: AudioPlayer | null = null;
  private isInitialized: boolean = false;
  private audioSession: AudioModeSession | null = null;
  private playbackState: PlaybackState = {
    isPlaying: false,
    duration: 0,
    position: 0,
  };

  /**
   * Get singleton instance
   */
  static getInstance(): AudioManager {
    if (!AudioManager.instance) {
      AudioManager.instance = new AudioManager();
    }
    return AudioManager.instance;
  }

  /**
   * Initialize audio system
   * Now uses AudioModeCoordinator for safe audio mode management
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      // Initialize audio mode coordinator
      await AudioModeCoordinator.initialize();
      this.isInitialized = true;
      console.log('[AudioManager] ✅ Initialized with AudioModeCoordinator');
    } catch (error) {
      console.error('[AudioManager] ❌ Failed to initialize:', error);
    }
  }

  // NOTE: Recording methods removed - use useVoiceController with streaming instead
  // Only TTS playback methods remain below

  /**
   * Play audio from URI
   * Uses AudioModeCoordinator to request TTS audio mode
   * 
   * @param uri Audio file URI
   * @param onUpdate Callback for playback state updates
   */
  async play(uri: string, onUpdate?: (state: PlaybackState) => void): Promise<void> {
    try {
      // Stop any existing playback
      await this.stop();

      // Request TTS audio mode from coordinator
      this.audioSession = await AudioModeCoordinator.requestAudioMode('tts');
      console.log('[AudioManager] 🎵 TTS audio session started:', this.audioSession.id);

      // Create and play using expo-audio player
      this.player = createAudioPlayer(uri);
      this.player.play();
      
      // Set up status polling for updates (expo-audio uses hooks pattern instead of callbacks)
      const pollInterval = setInterval(() => {
        if (!this.player) {
          clearInterval(pollInterval);
          return;
        }
        
        this.playbackState = {
          isPlaying: this.player.playing,
          duration: (this.player.duration || 0) * 1000, // Convert to ms
          position: (this.player.currentTime || 0) * 1000, // Convert to ms
          uri,
        };

        if (onUpdate) {
          onUpdate(this.playbackState);
        }

        // Auto-cleanup when playback finishes
        if (this.player.currentTime >= this.player.duration && this.player.duration > 0) {
          clearInterval(pollInterval);
          this.stop();
        }
      }, 100);

    } catch (error) {
      // Release audio session on error
      if (this.audioSession) {
        await this.audioSession.release();
        this.audioSession = null;
      }

      this.playbackState = {
        isPlaying: false,
        duration: 0,
        position: 0,
        error: error instanceof Error ? error.message : 'Failed to play audio',
      };
      if (onUpdate) {
        onUpdate(this.playbackState);
      }
      throw error;
    }
  }

  /**
   * Pause current playback
   */
  async pause(): Promise<void> {
    try {
      if (this.player) {
        this.player.pause();
        this.playbackState.isPlaying = false;
      }
    } catch (error) {
      console.error('[AudioManager] Failed to pause:', error);
    }
  }

  /**
   * Resume paused playback
   */
  async resume(): Promise<void> {
    try {
      if (this.player) {
        this.player.play();
        this.playbackState.isPlaying = true;
      }
    } catch (error) {
      console.error('[AudioManager] Failed to resume:', error);
    }
  }

  /**
   * Stop playback and cleanup
   * Releases audio session back to coordinator
   */
  async stop(): Promise<void> {
    try {
      if (this.player) {
        this.player.pause();
        this.player.release();
        this.player = null;
      }

      // Release audio session
      if (this.audioSession) {
        await this.audioSession.release();
        console.log('[AudioManager] 🔓 TTS audio session released');
        this.audioSession = null;
      }

      this.playbackState = {
        isPlaying: false,
        duration: 0,
        position: 0,
      };
    } catch (error) {
      console.error('[AudioManager] ❌ Failed to stop:', error);
    }
  }

  // NOTE: getRecordingState removed - not needed for playback-only

  /**
   * Get current playback state
   */
  getPlaybackState(): PlaybackState {
    return { ...this.playbackState };
  }

  /**
   * Cleanup all resources
   */
  async cleanup(): Promise<void> {
    await this.stop();
  }
}

// Export singleton instance
export const audioManager = AudioManager.getInstance();

// Initialize on module load
audioManager.initialize().catch(err => {
  console.error('[AudioManager] Failed to initialize on load:', err);
});
