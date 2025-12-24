import { logger } from '@/lib/logger';
import React, { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import * as Updates from 'expo-updates';
import * as Notifications from 'expo-notifications';
import { AppState, Platform } from 'react-native';
import { trackOTAUpdateCheck, trackOTAUpdateFetch, trackOTAUpdateApply, trackOTAError } from '@/lib/otaObservability';

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

// Context
const UpdatesContext = createContext<UpdatesContextValue | undefined>(undefined);

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

  // Update state helper
  const updateState = (partial: Partial<UpdateState>) => {
    setState(prev => ({ ...prev, ...partial }));
  };

  // Check for updates manually
  const checkForUpdates = async (): Promise<boolean> => {
    // Log detailed update info for debugging
    const updateInfo = {
      isEnabled: Updates.isEnabled,
      isDev: __DEV__,
      channel: Updates.channel,
      runtimeVersion: Updates.runtimeVersion,
      updateId: Updates.updateId,
      createdAt: Updates.createdAt,
      isEmbeddedLaunch: Updates.isEmbeddedLaunch,
      releaseChannel: Updates.releaseChannel,
      manifest: Updates.manifest,
    };
    
    logger.info('[Updates] Update environment:', updateInfo);
    console.log('[Updates] Full update info:', JSON.stringify(updateInfo, null, 2));
    
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
      console.log('[Updates] Checking for updates via expo-updates API...');
      logger.info('[Updates] Checking for updates...');
      
      const update = await Updates.checkForUpdateAsync();
      console.log('[Updates] Update check result:', { 
        isAvailable: update.isAvailable, 
        manifestId: update.manifest?.id,
        manifest: update.manifest 
      });
      logger.info('[Updates] Update check result:', { isAvailable: update.isAvailable, manifest: update.manifest?.id });
      
      // Track update check
      trackOTAUpdateCheck(update);
      
      if (update.isAvailable) {
        console.log('[Updates] ✅ Update available! Starting download...');
        logger.info('[Updates] Update available, starting download...');
        // Start downloading
        const result = await Updates.fetchUpdateAsync();
        console.log('[Updates] ✅ Update downloaded successfully:', { isNew: result.isNew });
        logger.info('[Updates] Update downloaded:', { isNew: result.isNew });
        
        // Track update fetch
        trackOTAUpdateFetch(result);
        // Download complete - this will also trigger the UPDATE_DOWNLOADED event
        updateState({ isDownloading: false, isUpdateDownloaded: true });
        
        // Send system notification instead of showing banner
        await sendUpdateNotification();
        
        // Set app badge to show update available
        if (Platform.OS !== 'web') {
          try {
            await Notifications.setBadgeCountAsync(1);
          } catch (badgeError) {
            logger.warn('[Updates] Failed to set badge count:', badgeError);
          }
        }
        
        return true;
      } else {
        console.log('[Updates] ℹ️ No update available - already on latest version');
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
          body: 'Tap to restart and apply the latest version',
          data: { type: 'update_ready' },
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
      // Track before applying (since app will restart)
      trackOTAUpdateApply();
      
      await Updates.reloadAsync();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to apply update';
      updateState({ updateError: errorMessage });
      
      // Track error
      if (error instanceof Error) {
        trackOTAError('apply', error);
      }
      
      if (__DEV__) {
        logger.warn('Update apply failed:', errorMessage);
      }
    }
  };

  // Handle notification taps for updates
  useEffect(() => {
    if (Platform.OS === 'web') return;
    
    const subscription = Notifications.addNotificationResponseReceivedListener(
      async (response) => {
        const data = response.notification.request.content.data;
        if (data?.type === 'update_ready' && state.isUpdateDownloaded) {
          logger.info('[Updates] Update notification tapped, applying update...');
          await applyUpdate();
        }
      }
    );

    return () => {
      subscription.remove();
    };
  }, [state.isUpdateDownloaded]);

  // Dismiss the update (clear badge)
  const dismissUpdate = () => {
    updateState({ isUpdateDownloaded: false });
    // Clear badge when update is dismissed
    if (Platform.OS !== 'web') {
      Notifications.setBadgeCountAsync(0).catch(() => {});
    }
  };

  // Dismiss error messages
  const dismissError = () => {
    updateState({ updateError: null });
  };

  // Background update checking
  const backgroundCheck = useCallback(async () => {
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

    try {
      logger.info('[Updates] Background check for updates...');
      const update = await Updates.checkForUpdateAsync();
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
        
        // Send system notification for background update
        await sendUpdateNotification();
        
        // Set app badge to show update available
        if (Platform.OS !== 'web') {
          try {
            await Notifications.setBadgeCountAsync(1);
          } catch (badgeError) {
            logger.warn('[Updates] Failed to set badge count:', badgeError);
          }
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
    }
  }, []);

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