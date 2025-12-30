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
 * - FOREGROUND_SERVICE_MEDIA_PLAYBACK (for audio in background - Android 14+)
 * - FOREGROUND_SERVICE_MICROPHONE (for microphone in foreground service - Android 14+)
 * - FOREGROUND_SERVICE_CAMERA (for camera in foreground service - Android 14+)
 * - WAKE_LOCK (keep device awake during calls)
 * 
 * Also modifies Notifee's ForegroundService to declare all required foregroundServiceTypes
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
    
    // Find and update Notifee's ForegroundService to declare all foregroundServiceTypes
    // This is CRITICAL for Android 14+ (API 34) - the types used at runtime must be
    // declared in the manifest's service element
    const application = androidManifest.manifest.application?.[0];
    if (application && application.service) {
      for (const service of application.service) {
        const serviceName = service.$['android:name'];
        
        // Find Notifee's ForegroundService
        if (serviceName === 'app.notifee.core.ForegroundService') {
          // Set foregroundServiceType to include all types we might use:
          // - mediaPlayback (2048/0x800) - for background audio
          // - phoneCall (4) - for VoIP calls  
          // - microphone (128/0x80) - for voice recording
          // Combined: mediaPlayback|phoneCall|microphone
          service.$['android:foregroundServiceType'] = 'mediaPlayback|phoneCall|microphone';
          console.log('[withForegroundService] ✅ Updated Notifee ForegroundService with foregroundServiceType: mediaPlayback|phoneCall|microphone');
        }
      }
    }
    
    return config;
  });
};

module.exports = withForegroundService;
