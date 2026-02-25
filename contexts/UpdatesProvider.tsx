import { logger } from '@/lib/logger';

const TAG = 'Updates';
import React, { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import * as Updates from 'expo-updates';
import * as Notifications from 'expo-notifications';
import { AppState, Platform } from 'react-native';
import { trackOTAUpdateCheck, trackOTAUpdateFetch, trackOTAUpdateApply, trackOTAError } from '@/lib/otaObservability';
import { BadgeCoordinator } from '@/lib/BadgeCoordinator';
import { storage } from '@/lib/storage';

// Types for update state
export interface UpdateState {
  isDownloading: boolean;
  isUpdateDownloaded: boolean;
  updateError: string | null;
  lastCheckTime: Date | null;
}

export interface UpdatesContextValue extends UpdateState {
  checkForUpdates: () => Promise<boolean>;
  applyUpdate: () => Promise<void>;
  dismissUpdate: () => void;
  dismissError: () => void;
}

// Context - exported for safe access patterns
export const UpdatesContext = createContext<UpdatesContextValue | undefined>(undefined);

// Provider component
interface UpdatesProviderProps {
  children: ReactNode;
}

export function UpdatesProvider({ children }: UpdatesProviderProps) {
  const [state, setState] = useState<UpdateState>({
    isDownloading: false,
    isUpdateDownloaded: false,
    updateError: null,
    lastCheckTime: null,
  });
  const updatesBlockedRef = React.useRef(false);
  const updateAlreadyDownloadedRef = React.useRef(false);
  const isCheckingRef = React.useRef(false);
  const lastCheckTimestampRef = React.useRef(0);

  const UPDATE_BLOCK_KEY = 'edudash_ota_block_until';
  const UPDATE_LAST_RELOAD_KEY = 'edudash_ota_last_reload';

  const isUpdatesBlocked = useCallback(async () => {
    if (updatesBlockedRef.current) return true;
    try {
      const raw = await storage.getItem(UPDATE_BLOCK_KEY);
      if (!raw) return false;
      const parsed = JSON.parse(raw) as { until?: number; reason?: string };
      if (parsed?.until && Date.now() < parsed.until) {
        updatesBlockedRef.current = true;
        logger.warn('[Updates] OTA checks blocked:', parsed.reason || 'unknown');
        return true;
      }
      if (parsed?.until && Date.now() >= parsed.until) {
        await storage.removeItem(UPDATE_BLOCK_KEY);
      }
    } catch (err) {
      logger.warn('[Updates] Failed to read OTA block state:', err);
    }
    return false;
  }, []);

  const blockUpdates = useCallback(async (minutes: number, reason: string) => {
    const until = Date.now() + minutes * 60 * 1000;
    try {
      await storage.setItem(UPDATE_BLOCK_KEY, JSON.stringify({ until, reason }));
      updatesBlockedRef.current = true;
    } catch (err) {
      logger.warn('[Updates] Failed to persist OTA block:', err);
    }
  }, []);

  // Update state helper
  const updateState = (partial: Partial<UpdateState>) => {
    setState(prev => ({ ...prev, ...partial }));
  };

  // Check for updates manually
  const checkForUpdates = async (): Promise<boolean> => {
    if (Platform.OS === 'web') return false;
    if (__DEV__) return false;
    if (await isUpdatesBlocked()) {
      logger.warn('[Updates] OTA checks blocked - skipping manual update check');
      return false;
    }
    // Log detailed update info for debugging
    const updateInfo = {
      isEnabled: Updates.isEnabled,
      isDev: __DEV__,
      channel: Updates.channel,
      runtimeVersion: Updates.runtimeVersion,
      updateId: Updates.updateId,
      createdAt: Updates.createdAt,
      isEmbeddedLaunch: Updates.isEmbeddedLaunch,
      // Note: releaseChannel is deprecated, using channel instead
      manifest: Updates.manifest,
    };
    
    logger.info('[Updates] Update environment:', updateInfo);
    logger.debug(TAG, 'Full update info:', JSON.stringify(updateInfo, null, 2));
    
    if (!Updates.isEnabled) {
      logger.warn('[Updates] Updates are disabled - skipping check (likely development build)');
      console.warn('[Updates] To enable OTA updates, set EXPO_PUBLIC_ENABLE_OTA_UPDATES=true and rebuild');
      return false;
    }
    
    // Force allow updates in production builds (ignore __DEV__ flag)
    const enableOTAUpdates = process.env.EXPO_PUBLIC_ENABLE_OTA_UPDATES === 'true';
    logger.info('[Updates] Manual update check initiated (forceCheck=true, OTA_ENABLED=' + enableOTAUpdates + ')');

    try {
      updateState({ isDownloading: true, updateError: null, lastCheckTime: new Date() });
      logger.debug(TAG, 'Checking for updates via expo-updates API...');
      logger.info('[Updates] Checking for updates...');
      
      const update = await Updates.checkForUpdateAsync();
      if (!update.isAvailable && (update as any).reason === 'updatePreviouslyFailed') {
        logger.warn('[Updates] Update previously failed to launch. Blocking OTA checks temporarily.');
        updateState({ updateError: 'Latest update failed to launch. OTA checks paused temporarily.' });
        await blockUpdates(60, 'updatePreviouslyFailed');
        return false;
      }
      logger.debug(TAG, 'Update check result:', { 
        isAvailable: update.isAvailable, 
        manifestId: update.manifest?.id,
        manifest: update.manifest 
      });
      logger.info('[Updates] Update check result:', { isAvailable: update.isAvailable, manifest: update.manifest?.id });
      
      // Track update check
      trackOTAUpdateCheck(update);
      
      if (update.isAvailable) {
        logger.info(TAG, 'Update available! Starting download...');
        logger.info('[Updates] Update available, starting download...');
        // Start downloading
        const result = await Updates.fetchUpdateAsync();
        logger.info(TAG, 'Update downloaded successfully:', { isNew: result.isNew });
        logger.info('[Updates] Update downloaded:', { isNew: result.isNew });
        
        // Track update fetch
        trackOTAUpdateFetch(result);
        // Download complete - this will also trigger the UPDATE_DOWNLOADED event
        updateState({ isDownloading: false, isUpdateDownloaded: true });
        updateAlreadyDownloadedRef.current = true;
        
        // Send system notification instead of showing banner
        await sendUpdateNotification();
        
        // checkForUpdates already returns early on web, so we can set this directly.
        try {
          await BadgeCoordinator.setCategory('updates', 1);
        } catch (badgeError) {
          logger.warn('[Updates] Failed to set badge count:', badgeError);
        }
        
        return true;
      } else {
        logger.info(TAG, 'No update available - already on latest version');
        logger.info('[Updates] No update available');
        updateState({ isDownloading: false, lastCheckTime: new Date() });
        return false;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to check for updates';
      console.error('[Updates] ❌ Update check failed:', errorMessage, error);
      logger.warn('[Updates] Update check failed:', errorMessage, error);
      
      // Track error
      if (error instanceof Error) {
        trackOTAError('check', error);
      }
      
      // Don't show error for common network issues in dev
      const shouldShowError = !__DEV__ || !errorMessage.includes('rejected');
      
      updateState({ 
        isDownloading: false, 
        updateError: shouldShowError ? errorMessage : null,
        lastCheckTime: new Date()
      });
      return false;
    }
  };

  // Send system notification for update
  const sendUpdateNotification = useCallback(async () => {
    try {
      if (Platform.OS === 'web') return; // Web doesn't support native notifications for updates
      
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Update Ready',
          body: 'Open app and restart to apply the latest improvements',
          data: { type: 'update_ready', forceShow: true },
          sound: true,
          priority: Notifications.AndroidNotificationPriority.HIGH,
        },
        trigger: null, // Show immediately
      });
      
      logger.info('[Updates] System notification sent for update');
    } catch (error) {
      logger.warn('[Updates] Failed to send update notification:', error);
    }
  }, []);

  // Apply the downloaded update
  const applyUpdate = async () => {
    try {
      // Guard: prevent reload loops in rapid succession
      try {
        const lastReloadRaw = await storage.getItem(UPDATE_LAST_RELOAD_KEY);
        const lastReloadAt = lastReloadRaw ? parseInt(lastReloadRaw, 10) : 0;
        if (lastReloadAt && Date.now() - lastReloadAt < 60 * 1000) {
          logger.warn('[Updates] Skipping reload to prevent loop (last reload < 60s)');
          updateState({ updateError: 'Update reload suppressed to prevent loop. Please try again shortly.' });
          return;
        }
        await storage.setItem(UPDATE_LAST_RELOAD_KEY, String(Date.now()));
      } catch (guardErr) {
        logger.warn('[Updates] Reload guard failed (non-fatal):', guardErr);
      }
      // Track before applying (since app will restart)
      trackOTAUpdateApply();
      
      logger.info('[Updates] Applying update and reloading app...');
      logger.debug(TAG, 'Calling Updates.reloadAsync()...');
      
      // Use setTimeout to ensure any pending state updates complete before reload
      setTimeout(async () => {
        try {
          await Updates.reloadAsync();
        } catch (reloadError) {
          console.error('[Updates] reloadAsync failed:', reloadError);
          logger.error('[Updates] reloadAsync failed:', reloadError);
          // If reloadAsync fails, try to show error to user
          updateState({ updateError: reloadError instanceof Error ? reloadError.message : 'Failed to restart app' });
        }
      }, 100);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to apply update';
      console.error('[Updates] Apply update error:', errorMessage, error);
      logger.error('[Updates] Apply update error:', errorMessage);
      updateState({ updateError: errorMessage });
      
      // Track error
      if (error instanceof Error) {
        trackOTAError('apply', error);
      }
    }
  };

  // Handle notification taps for updates — show confirmation instead of auto-applying
  useEffect(() => {
    if (Platform.OS === 'web') return;
    
    const subscription = Notifications.addNotificationResponseReceivedListener(
      async (response) => {
        const data = response.notification.request.content.data;
        if (data?.type === 'update_ready' && state.isUpdateDownloaded) {
          logger.info('[Updates] Update notification tapped, showing confirmation...');
          // Import Alert lazily to avoid issues in non-RN contexts
          const { Alert } = require('react-native');
          Alert.alert(
            'Update Ready',
            'A new version has been downloaded. Restart now to apply the update?',
            [
              { text: 'Later', style: 'cancel' },
              {
                text: 'Update Now',
                onPress: async () => {
                  logger.info('[Updates] User chose to apply update from notification');
                  await applyUpdate();
                },
              },
            ],
            { cancelable: true }
          );
        }
      }
    );

    return () => {
      subscription.remove();
    };
  }, [state.isUpdateDownloaded]);

  // Emergency launch safeguard: if last update crashed, disable OTA checks temporarily
  useEffect(() => {
    if (!Updates.isEmergencyLaunch) return;
    const reason = Updates.emergencyLaunchReason || 'unknown';
    logger.error('[Updates] Emergency launch detected. Disabling OTA checks temporarily.', { reason });
    updateState({ updateError: 'App recovered from a failed update. OTA checks paused.' });
    void blockUpdates(120, `emergencyLaunch:${reason}`);
  }, [blockUpdates]);

  // Dismiss the update (clear badge)
  const dismissUpdate = () => {
    updateState({ isUpdateDownloaded: false });
    updateAlreadyDownloadedRef.current = false;
    // Clear badge when update is dismissed
    if ((Platform.OS as string) !== 'web') {
      BadgeCoordinator.clearCategory('updates').catch(() => {});
    }
  };

  // Dismiss error messages
  const dismissError = () => {
    updateState({ updateError: null });
  };

  // Background update checking
  const backgroundCheck = useCallback(async () => {
    if (Platform.OS === 'web') return;
    if (__DEV__) return;
    // Skip if an update was already downloaded but not yet applied
    if (updateAlreadyDownloadedRef.current) {
      logger.info('[Updates] Update already downloaded - skipping background check');
      return;
    }
    // Prevent concurrent background checks (race condition on mount + AppState)
    if (isCheckingRef.current) {
      logger.info('[Updates] Background check already in progress - skipping');
      return;
    }
    // Throttle: skip if last check was less than 30 seconds ago
    const now = Date.now();
    if (now - lastCheckTimestampRef.current < 30_000) {
      logger.info('[Updates] Background check throttled (last check < 30s ago)');
      return;
    }
    lastCheckTimestampRef.current = now;
    isCheckingRef.current = true;
    
    try {
      if (await isUpdatesBlocked()) {
        logger.warn('[Updates] OTA checks blocked - skipping background check');
        return;
      }
      // Log detailed update info for debugging
      logger.info('[Updates] Background check - Update environment:', {
        isEnabled: Updates.isEnabled,
        isDev: __DEV__,
        channel: Updates.channel,
        runtimeVersion: Updates.runtimeVersion,
        updateId: Updates.updateId,
      });
      
      if (!Updates.isEnabled) {
        logger.info('[Updates] Updates disabled - skipping background check (likely development build)');
        return;
      }
      
      // Allow OTA updates in preview/production builds even if __DEV__ is true
      const enableOTAUpdates = process.env.EXPO_PUBLIC_ENABLE_OTA_UPDATES === 'true';
      if (__DEV__ && !enableOTAUpdates) {
        logger.info('[Updates] Skipping background check - development build without OTA enabled');
        return;
      }

      logger.info('[Updates] Background check for updates...');
      const update = await Updates.checkForUpdateAsync();
      if (!update.isAvailable && (update as any).reason === 'updatePreviouslyFailed') {
        logger.warn('[Updates] Update previously failed to launch. Blocking OTA checks temporarily.');
        updateState({ updateError: 'Latest update failed to launch. OTA checks paused temporarily.' });
        await blockUpdates(60, 'updatePreviouslyFailed');
        return;
      }
      logger.info('[Updates] Background check result:', { isAvailable: update.isAvailable });
      
      // Track background update check
      trackOTAUpdateCheck(update);
      
      if (update.isAvailable) {
        logger.info('[Updates] Background update available, downloading...');
        updateState({ isDownloading: true, updateError: null });
        const result = await Updates.fetchUpdateAsync();
        logger.info('[Updates] Background update downloaded:', { isNew: result.isNew });
        
        // Track background update fetch
        trackOTAUpdateFetch(result);
        updateState({ 
          isDownloading: false, 
          isUpdateDownloaded: true,
          lastCheckTime: new Date()
        });
        updateAlreadyDownloadedRef.current = true;
        
        // Send system notification for background update
        await sendUpdateNotification();
        
        // backgroundCheck already returns early on web, so we can set this directly.
        try {
          await BadgeCoordinator.setCategory('updates', 1);
        } catch (badgeError) {
          logger.warn('[Updates] Failed to set badge count:', badgeError);
        }
      } else {
        logger.info('[Updates] No background update available');
        updateState({ 
          isDownloading: false, 
          lastCheckTime: new Date()
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Background update check failed';
      logger.warn('[Updates] Background update check failed:', errorMessage);
      
      // Don't set error state for background checks to avoid spam
      updateState({ 
        isDownloading: false,
        lastCheckTime: new Date()
      });
    } finally {
      isCheckingRef.current = false;
    }
  }, [blockUpdates, isUpdatesBlocked]);

  // Set up background checking on app state changes
  useEffect(() => {
    if (!Updates.isEnabled) {
      logger.info('[Updates] Updates disabled - skipping background setup');
      return;
    }

    // Skip automatic background checks in development (but allow preview/production)
    const environment = process.env.EXPO_PUBLIC_ENVIRONMENT;
    const enableOTAUpdates = process.env.EXPO_PUBLIC_ENABLE_OTA_UPDATES === 'true';
    
    if (__DEV__ && environment === 'development' && !enableOTAUpdates) {
      logger.info('[Updates] Skipping automatic background checks in development');
      return;
    }
    
    logger.info(`[Updates] Environment: ${environment}, OTA enabled: ${enableOTAUpdates}, DEV: ${__DEV__}`);

    // Initial background check (only in production)
    backgroundCheck();
    
    // Check on app state changes
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        backgroundCheck();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [backgroundCheck]);

  const contextValue: UpdatesContextValue = {
    ...state,
    checkForUpdates,
    applyUpdate,
    dismissUpdate,
    dismissError,
  };

  return (
    <UpdatesContext.Provider value={contextValue}>
      {children}
    </UpdatesContext.Provider>
  );
}

// Hook to use the updates context
export function useUpdates() {
  const context = useContext(UpdatesContext);
  if (context === undefined) {
    throw new Error('useUpdates must be used within an UpdatesProvider');
  }
  return context;
}
