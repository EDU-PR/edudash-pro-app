/**
 * PlayStoreUpdateChecker.tsx
 * 
 * Checks if a newer version is available on Google Play Store
 * and prompts users to update. Works alongside Expo OTA updates.
 * 
 * For Android: Uses Play Store listing to check version
 * For iOS: Uses App Store lookup API (future)
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Linking,
  Platform,
  AppState,
  AppStateStatus,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { logger } from '@/lib/logger';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';

// App identifiers
const ANDROID_PACKAGE_NAME = 'com.edudashpro.app';
const IOS_APP_ID = ''; // Add when iOS app is published
const PLAY_STORE_URL = `https://play.google.com/store/apps/details?id=${ANDROID_PACKAGE_NAME}`;
const APP_STORE_URL = IOS_APP_ID ? `https://apps.apple.com/app/id${IOS_APP_ID}` : '';

// Storage keys
const LAST_CHECK_KEY = '@playstore_update_last_check';
const DISMISSED_VERSION_KEY = '@playstore_update_dismissed_version';
const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours

interface UpdateInfo {
  currentVersion: string;
  latestVersion: string;
  isUpdateAvailable: boolean;
  storeUrl: string;
}

interface PlayStoreUpdateCheckerProps {
  /** Check on mount (default: true) */
  checkOnMount?: boolean;
  /** Minimum interval between checks in ms (default: 24 hours) */
  checkInterval?: number;
  /** Show modal automatically when update available (default: true) */
  autoShowModal?: boolean;
  /** Callback when update is available */
  onUpdateAvailable?: (info: UpdateInfo) => void;
  /** Force check regardless of interval */
  forceCheck?: boolean;
}

export function PlayStoreUpdateChecker({
  checkOnMount = true,
  checkInterval = CHECK_INTERVAL_MS,
  autoShowModal = true,
  onUpdateAvailable,
  forceCheck = false,
}: PlayStoreUpdateCheckerProps) {
  const { colors, isDark } = useTheme();
  const [modalVisible, setModalVisible] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [isChecking, setIsChecking] = useState(false);

  // Get current app version
  const getCurrentVersion = useCallback((): string => {
    return Constants.expoConfig?.version || '1.0.0';
  }, []);

  // Compare version strings (e.g., "1.0.12" vs "1.0.13")
  const isNewerVersion = useCallback((current: string, latest: string): boolean => {
    const currentParts = current.split('.').map(Number);
    const latestParts = latest.split('.').map(Number);

    for (let i = 0; i < Math.max(currentParts.length, latestParts.length); i++) {
      const currentPart = currentParts[i] || 0;
      const latestPart = latestParts[i] || 0;

      if (latestPart > currentPart) return true;
      if (latestPart < currentPart) return false;
    }

    return false;
  }, []);

  // Check if we should skip this check (rate limiting)
  const shouldSkipCheck = useCallback(async (): Promise<boolean> => {
    if (forceCheck) return false;

    try {
      const lastCheck = await AsyncStorage.getItem(LAST_CHECK_KEY);
      if (lastCheck) {
        const lastCheckTime = parseInt(lastCheck, 10);
        const timeSinceLastCheck = Date.now() - lastCheckTime;
        if (timeSinceLastCheck < checkInterval) {
          logger.info('[PlayStoreUpdate] Skipping check, last check was', 
            Math.round(timeSinceLastCheck / 60000), 'minutes ago');
          return true;
        }
      }
    } catch (error) {
      logger.warn('[PlayStoreUpdate] Error reading last check time:', error);
    }

    return false;
  }, [forceCheck, checkInterval]);

  // Check if user dismissed this version already
  const wasVersionDismissed = useCallback(async (version: string): Promise<boolean> => {
    try {
      const dismissedVersion = await AsyncStorage.getItem(DISMISSED_VERSION_KEY);
      return dismissedVersion === version;
    } catch {
      return false;
    }
  }, []);

  // Fetch latest version from Play Store
  const fetchLatestVersion = useCallback(async (): Promise<string | null> => {
    if (Platform.OS !== 'android') {
      // TODO: Implement iOS App Store lookup
      return null;
    }

    try {
      // Use Google Play Store page scraping (simple approach)
      // Note: For production, consider using a backend API or Google Play Developer API
      const response = await fetch(PLAY_STORE_URL, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const html = await response.text();
      
      // Extract version from Play Store page
      // Look for pattern like: "Current Version</div><span class="...">1.0.13</span>"
      // or in JSON-LD structured data
      const versionMatch = html.match(/\[\[\["(\d+\.\d+\.\d+)"\]\]/);
      if (versionMatch) {
        return versionMatch[1];
      }

      // Alternative pattern
      const altMatch = html.match(/"softwareVersion":"(\d+\.\d+\.\d+)"/);
      if (altMatch) {
        return altMatch[1];
      }

      // Try another common pattern
      const thirdMatch = html.match(/Current Version.*?>([\d.]+)</);
      if (thirdMatch) {
        return thirdMatch[1];
      }

      logger.warn('[PlayStoreUpdate] Could not parse version from Play Store page');
      return null;
    } catch (error) {
      logger.error('[PlayStoreUpdate] Error fetching Play Store version:', error);
      return null;
    }
  }, []);

  // Main check function
  const checkForStoreUpdate = useCallback(async (): Promise<UpdateInfo | null> => {
    if (Platform.OS === 'web') {
      logger.info('[PlayStoreUpdate] Skipping on web');
      return null;
    }

    if (await shouldSkipCheck()) {
      return null;
    }

    setIsChecking(true);

    try {
      // Save check time
      await AsyncStorage.setItem(LAST_CHECK_KEY, Date.now().toString());

      const currentVersion = getCurrentVersion();
      const latestVersion = await fetchLatestVersion();

      if (!latestVersion) {
        logger.info('[PlayStoreUpdate] Could not determine latest version');
        setIsChecking(false);
        return null;
      }

      const isAvailable = isNewerVersion(currentVersion, latestVersion);
      
      const info: UpdateInfo = {
        currentVersion,
        latestVersion,
        isUpdateAvailable: isAvailable,
        storeUrl: Platform.OS === 'android' ? PLAY_STORE_URL : APP_STORE_URL,
      };

      logger.info('[PlayStoreUpdate] Version check:', {
        current: currentVersion,
        latest: latestVersion,
        updateAvailable: isAvailable,
      });

      if (isAvailable) {
        // Check if user dismissed this version
        const dismissed = await wasVersionDismissed(latestVersion);
        if (dismissed) {
          logger.info('[PlayStoreUpdate] User previously dismissed version', latestVersion);
          setIsChecking(false);
          return info;
        }

        setUpdateInfo(info);
        onUpdateAvailable?.(info);

        if (autoShowModal) {
          setModalVisible(true);
        }
      }

      setIsChecking(false);
      return info;
    } catch (error) {
      logger.error('[PlayStoreUpdate] Check failed:', error);
      setIsChecking(false);
      return null;
    }
  }, [
    shouldSkipCheck,
    getCurrentVersion,
    fetchLatestVersion,
    isNewerVersion,
    wasVersionDismissed,
    autoShowModal,
    onUpdateAvailable,
  ]);

  // Handle "Update Now" press
  const handleUpdatePress = useCallback(async () => {
    if (updateInfo?.storeUrl) {
      try {
        const canOpen = await Linking.canOpenURL(updateInfo.storeUrl);
        if (canOpen) {
          await Linking.openURL(updateInfo.storeUrl);
        } else {
          // Fallback to market intent for Android
          if (Platform.OS === 'android') {
            await Linking.openURL(`market://details?id=${ANDROID_PACKAGE_NAME}`);
          }
        }
      } catch (error) {
        logger.error('[PlayStoreUpdate] Error opening store:', error);
      }
    }
    setModalVisible(false);
  }, [updateInfo]);

  // Handle "Later" press - remember dismissal
  const handleLaterPress = useCallback(async () => {
    if (updateInfo?.latestVersion) {
      try {
        await AsyncStorage.setItem(DISMISSED_VERSION_KEY, updateInfo.latestVersion);
      } catch (error) {
        logger.warn('[PlayStoreUpdate] Error saving dismissed version:', error);
      }
    }
    setModalVisible(false);
  }, [updateInfo]);

  // Check on mount
  useEffect(() => {
    if (checkOnMount && Platform.OS !== 'web') {
      // Delay check slightly to not block app startup
      const timer = setTimeout(() => {
        checkForStoreUpdate();
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, [checkOnMount, checkForStoreUpdate]);

  // Check when app comes to foreground
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        checkForStoreUpdate();
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, [checkForStoreUpdate]);

  // Don't render anything on web
  if (Platform.OS === 'web') {
    return null;
  }

  return (
    <Modal
      visible={modalVisible}
      transparent
      animationType="fade"
      onRequestClose={handleLaterPress}
    >
      <View style={styles.overlay}>
        <View style={[styles.modal, { backgroundColor: colors.background }]}>
          {/* Icon */}
          <View style={[styles.iconContainer, { backgroundColor: colors.primary + '20' }]}>
            <Ionicons name="download-outline" size={40} color={colors.primary} />
          </View>

          {/* Title */}
          <Text style={[styles.title, { color: colors.text }]}>
            Update Available
          </Text>

          {/* Description */}
          <Text style={[styles.description, { color: colors.textSecondary }]}>
            A new version of EduDash Pro is available on the {Platform.OS === 'android' ? 'Play Store' : 'App Store'}.
          </Text>

          {/* Version info */}
          <View style={[styles.versionContainer, { backgroundColor: isDark ? '#1a1a2e' : '#f5f5f5' }]}>
            <View style={styles.versionRow}>
              <Text style={[styles.versionLabel, { color: colors.textSecondary }]}>
                Current:
              </Text>
              <Text style={[styles.versionValue, { color: colors.text }]}>
                v{updateInfo?.currentVersion}
              </Text>
            </View>
            <View style={styles.versionRow}>
              <Text style={[styles.versionLabel, { color: colors.textSecondary }]}>
                Latest:
              </Text>
              <Text style={[styles.versionValue, { color: colors.primary }]}>
                v{updateInfo?.latestVersion}
              </Text>
            </View>
          </View>

          {/* What's new hint */}
          <Text style={[styles.hint, { color: colors.textSecondary }]}>
            Update now to get the latest features and improvements!
          </Text>

          {/* Buttons */}
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.button, styles.laterButton, { borderColor: colors.border }]}
              onPress={handleLaterPress}
            >
              <Text style={[styles.buttonText, { color: colors.textSecondary }]}>
                Later
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, styles.updateButton, { backgroundColor: colors.primary }]}
              onPress={handleUpdatePress}
            >
              <Ionicons name="arrow-forward" size={18} color="#fff" style={{ marginRight: 6 }} />
              <Text style={[styles.buttonText, { color: '#fff' }]}>
                Update Now
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// Hook for manual checking
export function usePlayStoreUpdate() {
  const [isChecking, setIsChecking] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);

  const checkForUpdate = useCallback(async (force = false): Promise<UpdateInfo | null> => {
    if (Platform.OS === 'web') return null;

    setIsChecking(true);

    try {
      const currentVersion = Constants.expoConfig?.version || '1.0.0';
      
      // Fetch from store
      const response = await fetch(PLAY_STORE_URL, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const html = await response.text();
      const versionMatch = html.match(/\[\[\["(\d+\.\d+\.\d+)"\]\]/) ||
                          html.match(/"softwareVersion":"(\d+\.\d+\.\d+)"/) ||
                          html.match(/Current Version.*?>([\d.]+)</);

      const latestVersion = versionMatch?.[1] || null;

      if (!latestVersion) {
        setIsChecking(false);
        return null;
      }

      // Compare versions
      const currentParts = currentVersion.split('.').map(Number);
      const latestParts = latestVersion.split('.').map(Number);
      let isAvailable = false;

      for (let i = 0; i < Math.max(currentParts.length, latestParts.length); i++) {
        const currentPart = currentParts[i] || 0;
        const latestPart = latestParts[i] || 0;
        if (latestPart > currentPart) {
          isAvailable = true;
          break;
        }
        if (latestPart < currentPart) break;
      }

      const info: UpdateInfo = {
        currentVersion,
        latestVersion,
        isUpdateAvailable: isAvailable,
        storeUrl: PLAY_STORE_URL,
      };

      setUpdateInfo(info);
      setIsChecking(false);
      return info;
    } catch (error) {
      logger.error('[usePlayStoreUpdate] Check failed:', error);
      setIsChecking(false);
      return null;
    }
  }, []);

  const openStore = useCallback(async () => {
    try {
      if (Platform.OS === 'android') {
        const canOpen = await Linking.canOpenURL(PLAY_STORE_URL);
        if (canOpen) {
          await Linking.openURL(PLAY_STORE_URL);
        } else {
          await Linking.openURL(`market://details?id=${ANDROID_PACKAGE_NAME}`);
        }
      }
    } catch (error) {
      logger.error('[usePlayStoreUpdate] Error opening store:', error);
    }
  }, []);

  return {
    isChecking,
    updateInfo,
    checkForUpdate,
    openStore,
  };
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modal: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  description: {
    fontSize: 15,
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 22,
  },
  versionContainer: {
    width: '100%',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  versionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  versionLabel: {
    fontSize: 14,
  },
  versionValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  hint: {
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 20,
    fontStyle: 'italic',
  },
  buttonContainer: {
    flexDirection: 'row',
    width: '100%',
    gap: 12,
  },
  button: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 12,
  },
  laterButton: {
    borderWidth: 1,
  },
  updateButton: {},
  buttonText: {
    fontSize: 15,
    fontWeight: '600',
  },
});

export default PlayStoreUpdateChecker;
