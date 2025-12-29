const { withAndroidManifest } = require('@expo/config-plugins');

/**
 * Config plugin to enable foreground service for voice/video calls
 * 
 * This adds Android permissions and service declarations required for:
 * - @notifee/react-native foreground service (2025 best practice)
 * - Voice/video calls running in background
 * - Android 14+ (API 34) foreground service types
 * 
 * Permissions added:
 * - FOREGROUND_SERVICE (for starting foreground service)
 * - FOREGROUND_SERVICE_PHONE_CALL (for VoIP calls - Android 14+)
 * - MANAGE_OWN_CALLS (required for phoneCall service type on Android 15+)
 * - FOREGROUND_SERVICE_MEDIA_PLAYBACK (for audio in background - Android 14+)
 * - FOREGROUND_SERVICE_MICROPHONE (for microphone in foreground service - Android 14+)
 * - FOREGROUND_SERVICE_CAMERA (for camera in foreground service - Android 14+)
 * - WAKE_LOCK (keep device awake during calls)
 * 
 * Note: Notifee handles its own service declarations, this plugin
 * only needs to add the required permissions.
 */
const withForegroundService = (config) => {
  return withAndroidManifest(config, async (config) => {
    const androidManifest = config.modResults;
    
    // Add permissions if not already present
    if (!androidManifest.manifest['uses-permission']) {
      androidManifest.manifest['uses-permission'] = [];
    }
    
    const permissions = androidManifest.manifest['uses-permission'];
    
    // Required permissions for foreground service with voice/video calls
    const requiredPermissions = [
      'android.permission.FOREGROUND_SERVICE',
      'android.permission.FOREGROUND_SERVICE_PHONE_CALL',
      'android.permission.MANAGE_OWN_CALLS', // Required for phoneCall service type on Android 15+ (API 36+)
      'android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK',
      'android.permission.FOREGROUND_SERVICE_MICROPHONE',
      'android.permission.FOREGROUND_SERVICE_CAMERA',
      'android.permission.WAKE_LOCK',
      // Required for showing notifications
      'android.permission.POST_NOTIFICATIONS',
    ];
    
    for (const permission of requiredPermissions) {
      const exists = permissions.some(
        (p) => p.$['android:name'] === permission
      );
      if (!exists) {
        permissions.push({
          $: { 'android:name': permission },
        });
        console.log(`[withForegroundService] ✅ Added permission: ${permission}`);
      }
    }
    
    return config;
  });
};

module.exports = withForegroundService;
