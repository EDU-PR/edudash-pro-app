/**
 * Wake Word Model Loader
 * 
 * Handles loading of custom Porcupine wake word models for React Native
 */

import { Platform } from 'react-native';
import { Asset } from 'expo-asset';

export class WakeWordModelLoader {
  private static modelCache: Map<string, string> = new Map();

  /**
   * Load the Hello Dash wake word model for the current platform
   */
  static async loadHelloDashModel(): Promise<string | null> {
    const cacheKey = `hello-dash-${Platform.OS}`;
    
    // Return cached model path if available
    if (this.modelCache.has(cacheKey)) {
      return this.modelCache.get(cacheKey)!;
    }

    try {
      const getAsset = () => {
        if (Platform.OS === 'android') {
          return require('../../assets/wake-words/hello-dash_en_android_v3_0_0.ppn');
        }
        return require('../../assets/wake-words/Hello-Dash_en_linux_v3_0_0.ppn');
      };
      const modelAsset = Asset.fromModule(getAsset());
      await modelAsset.downloadAsync();
      if (!modelAsset.localUri) return null;
      this.modelCache.set(cacheKey, modelAsset.localUri);
      console.log(`[WakeWordModelLoader] Loaded Hello Dash model for ${Platform.OS}:`, modelAsset.localUri);
      return modelAsset.localUri;
    } catch {
      return null;
    }
  }

  /**
   * Clear the model cache (useful for debugging)
   */
  static clearCache(): void {
    this.modelCache.clear();
    console.log('[WakeWordModelLoader] Model cache cleared');
  }

  /**
   * Check if a model is cached
   */
  static isModelCached(platform: string = Platform.OS): boolean {
    return this.modelCache.has(`hello-dash-${platform}`);
  }
}