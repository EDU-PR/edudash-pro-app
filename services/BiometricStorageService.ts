/**
 * BiometricStorageService
 * 
 * Handles persistent storage operations for biometric authentication.
 * Extracted from BiometricAuthService to comply with WARP.md file size guidelines.
 */
import * as LocalAuthentication from 'expo-local-authentication';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert, Platform } from 'react-native';
import { debug, warn, error as logError } from '@/lib/debug';

// Dynamically import SecureStore to avoid web issues
let SecureStore: any = null;
try {
  if (Platform.OS !== 'web') {
    SecureStore = require('expo-secure-store');
  }
} catch (e) {
  debug('SecureStore import failed (web or unsupported platform)', e);
}

// Storage keys
export const BIOMETRIC_STORAGE_KEY = 'biometric_enabled';
export const LEGACY_BIOMETRIC_STORAGE_KEY = 'biometrics_enabled';
export const BIOMETRIC_USER_KEY = 'biometric_user_data';
export const BIOMETRIC_LOCK_SECRET_KEY = 'biometric_lock_secret';
export const LAST_UNLOCKED_AT_KEY = 'biometric_last_unlocked_at';
export const LAST_USER_ID_KEY = 'biometric_last_user_id';
export const BIOMETRIC_REFRESH_TOKEN_KEY = 'biometric_refresh_token';

export interface StoredBiometricData {
  userId: string;
  email: string;
  enabledAt: string;
  lastUsed?: string;
  securityToken: string;
  version: number;
}

/**
 * BiometricStorageService class for managing biometric data persistence
 */
export class BiometricStorageService {
  /**
   * Check if SecureStore is available
   */
  static isSecureStoreAvailable(): boolean {
    return !!SecureStore;
  }

  /**
   * Get SecureStore module reference
   */
  static getSecureStore() {
    return SecureStore;
  }

  /**
   * Run one-time migrations and setup
   */
  static async init(): Promise<void> {
    try {
      if (!SecureStore) {
        debug('BiometricStorageService.init: SecureStore unavailable, skipping migration');
        return;
      }
      
      // Migrate legacy enable flag if present and canonical not set
      const canonical = await SecureStore.getItemAsync(BIOMETRIC_STORAGE_KEY).catch(() => null);
      const legacy = await SecureStore.getItemAsync(LEGACY_BIOMETRIC_STORAGE_KEY).catch(() => null);
      
      if (!canonical && (legacy === '1' || legacy === '0')) {
        const value = legacy === '1' ? 'true' : 'false';
        await SecureStore.setItemAsync(BIOMETRIC_STORAGE_KEY, value);
        await SecureStore.deleteItemAsync(LEGACY_BIOMETRIC_STORAGE_KEY).catch(() => { /* Intentional: error handled */ });
      }
    } catch (e) {
      warn('BiometricStorageService.init migration skipped:', e);
    }
  }

  /**
   * Check if biometric login is enabled for the app
   */
  static async isBiometricEnabled(): Promise<boolean> {
    try {
      // Try SecureStore first (canonical)
      let enabled = SecureStore 
        ? await SecureStore.getItemAsync(BIOMETRIC_STORAGE_KEY).catch(() => null) 
        : null;

      // Migrate from legacy if canonical missing
      if (!enabled && SecureStore) {
        const legacy = await SecureStore.getItemAsync(LEGACY_BIOMETRIC_STORAGE_KEY).catch(() => null);
        if (legacy === '1' || legacy === '0') {
          const canonical = legacy === '1' ? 'true' : 'false';
          await SecureStore.setItemAsync(BIOMETRIC_STORAGE_KEY, canonical);
          await SecureStore.deleteItemAsync(LEGACY_BIOMETRIC_STORAGE_KEY).catch(() => { /* Intentional: error handled */ });
          enabled = canonical;
        }
      }

      // Fallback to AsyncStorage for canonical only (compat)
      if (!enabled) {
        enabled = await AsyncStorage.getItem(BIOMETRIC_STORAGE_KEY);
      }
      
      return enabled === 'true';
    } catch (error) {
      logError('Error checking biometric enabled status:', error);
      return false;
    }
  }

  /**
   * Set biometric enabled status
   */
  static async setBiometricEnabled(enabled: boolean): Promise<void> {
    const value = enabled ? 'true' : 'false';
    
    if (SecureStore) {
      await SecureStore.setItemAsync(BIOMETRIC_STORAGE_KEY, value);
    } else {
      await AsyncStorage.setItem(BIOMETRIC_STORAGE_KEY, value);
    }
    
    // Also maintain AsyncStorage compatibility for existing code
    await AsyncStorage.setItem(BIOMETRIC_STORAGE_KEY, value);
  }

  /**
   * Store biometric user data
   */
  static async storeBiometricData(data: StoredBiometricData): Promise<void> {
    const jsonData = JSON.stringify(data);
    
    if (SecureStore) {
      await SecureStore.setItemAsync(BIOMETRIC_USER_KEY, jsonData);
    } else {
      await AsyncStorage.setItem(BIOMETRIC_USER_KEY, jsonData);
    }
  }

  /**
   * Get stored biometric user data
   */
  static async getStoredBiometricData(): Promise<StoredBiometricData | null> {
    try {
      // Try SecureStore first, fallback to AsyncStorage for compatibility
      let data = SecureStore 
        ? await SecureStore.getItemAsync(BIOMETRIC_USER_KEY).catch(() => null)
        : null;
        
      if (!data) {
        data = await AsyncStorage.getItem(BIOMETRIC_USER_KEY);
      }

      if (data) {
        const parsedData = JSON.parse(data);

        // Migrate old data format if needed
        if (!parsedData.version) {
          parsedData.version = 1;
          parsedData.securityToken = await this.generateSecurityToken();
          // Save migrated data to SecureStore
          if (SecureStore) {
            await SecureStore.setItemAsync(BIOMETRIC_USER_KEY, JSON.stringify(parsedData));
          }
        }

        return parsedData;
      }

      return null;
    } catch (error) {
      logError('Error retrieving biometric data:', error);
      return null;
    }
  }

  /**
   * Update last used timestamp
   */
  static async updateLastUsed(): Promise<void> {
    try {
      const existingData = await this.getStoredBiometricData();
      if (existingData) {
        const updatedData: StoredBiometricData = {
          ...existingData,
          lastUsed: new Date().toISOString(),
        };
        
        await AsyncStorage.setItem(BIOMETRIC_USER_KEY, JSON.stringify(updatedData));
      }
    } catch (error) {
      logError('Error updating last used timestamp:', error);
    }
  }

  /**
   * Store refresh token for session restoration
   */
  static async storeRefreshToken(token: string, userId?: string): Promise<void> {
    try {
      if (SecureStore) {
        await SecureStore.setItemAsync(BIOMETRIC_REFRESH_TOKEN_KEY, token);
        if (userId) {
          await SecureStore.setItemAsync(`biometric_refresh_token_${userId}`, token);
        }
      } else {
        await AsyncStorage.setItem(BIOMETRIC_REFRESH_TOKEN_KEY, token);
        if (userId) {
          await AsyncStorage.setItem(`biometric_refresh_token_${userId}`, token);
        }
      }
    } catch (error) {
      warn('Could not store biometric refresh token:', error);
    }
  }

  /**
   * Get stored refresh token for session restoration
   */
  static async getStoredRefreshToken(userId?: string): Promise<string | null> {
    try {
      // Try user-specific token first
      if (userId) {
        const userToken = SecureStore
          ? await SecureStore.getItemAsync(`biometric_refresh_token_${userId}`).catch(() => null)
          : await AsyncStorage.getItem(`biometric_refresh_token_${userId}`);
        if (userToken) return userToken;
      }
      
      // Fall back to global token
      const token = SecureStore 
        ? await SecureStore.getItemAsync(BIOMETRIC_REFRESH_TOKEN_KEY).catch(() => null)
        : await AsyncStorage.getItem(BIOMETRIC_REFRESH_TOKEN_KEY);
        
      return token;
    } catch (error) {
      logError('Error retrieving refresh token:', error);
      return null;
    }
  }

  /**
   * Store lock secret for biometric gating
   */
  static async storeLockSecret(secret: string): Promise<void> {
    if (SecureStore) {
      await SecureStore.setItemAsync(BIOMETRIC_LOCK_SECRET_KEY, secret);
    } else {
      await AsyncStorage.setItem(BIOMETRIC_LOCK_SECRET_KEY, secret);
    }
  }

  /**
   * Store last user ID
   */
  static async storeLastUserId(userId: string): Promise<void> {
    if (SecureStore) {
      await SecureStore.setItemAsync(LAST_USER_ID_KEY, userId);
    } else {
      await AsyncStorage.setItem(LAST_USER_ID_KEY, userId);
    }
  }

  /**
   * Get last unlocked timestamp (ms)
   */
  static async getLastUnlockedAt(): Promise<number | null> {
    try {
      const ts = SecureStore 
        ? await SecureStore.getItemAsync(LAST_UNLOCKED_AT_KEY)
        : await AsyncStorage.getItem(LAST_UNLOCKED_AT_KEY);
        
      if (!ts) return null;
      const num = Number(ts);
      return Number.isFinite(num) ? num : null;
    } catch (e) {
      return null;
    }
  }

  /**
   * Set last unlocked timestamp (ms)
   */
  static async setLastUnlockedAt(ts: number): Promise<void> {
    try {
      if (SecureStore) {
        await SecureStore.setItemAsync(LAST_UNLOCKED_AT_KEY, String(ts));
      } else {
        await AsyncStorage.setItem(LAST_UNLOCKED_AT_KEY, String(ts));
      }
    } catch (e) {
      // ignore
    }
  }

  /**
   * Clear all biometric data
   */
  static async clearAllBiometricData(): Promise<void> {
    try {
      const deletePromises = [
        AsyncStorage.removeItem(BIOMETRIC_STORAGE_KEY),
        AsyncStorage.removeItem(BIOMETRIC_USER_KEY),
        AsyncStorage.removeItem(BIOMETRIC_REFRESH_TOKEN_KEY),
      ];

      if (SecureStore) {
        deletePromises.push(
          SecureStore.deleteItemAsync(BIOMETRIC_STORAGE_KEY).catch(() => { /* Intentional */ }),
          SecureStore.deleteItemAsync(BIOMETRIC_USER_KEY).catch(() => { /* Intentional */ }),
          SecureStore.deleteItemAsync('biometric_security_state').catch(() => { /* Intentional */ }),
          SecureStore.deleteItemAsync(BIOMETRIC_LOCK_SECRET_KEY).catch(() => { /* Intentional */ }),
          SecureStore.deleteItemAsync(LAST_UNLOCKED_AT_KEY).catch(() => { /* Intentional */ }),
          SecureStore.deleteItemAsync(LAST_USER_ID_KEY).catch(() => { /* Intentional */ }),
          SecureStore.deleteItemAsync(BIOMETRIC_REFRESH_TOKEN_KEY).catch(() => { /* Intentional */ })
        );
      }

      await Promise.all(deletePromises);
    } catch (error) {
      logError('Error clearing biometric data:', error);
    }
  }

  /**
   * Generate a secure token for biometric data
   */
  static async generateSecurityToken(): Promise<string> {
    const timestamp = Date.now().toString();
    // Use Math.random() as fallback for React Native
    const randomBytes = Array.from({ length: 16 }, () => 
      Math.floor(Math.random() * 256)
    ).map((b) => b.toString(16).padStart(2, '0')).join('');
    return `${timestamp}-${randomBytes}`;
  }
}

export default BiometricStorageService;
