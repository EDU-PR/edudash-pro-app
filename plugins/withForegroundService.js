const { withAndroidManifest } = require('@expo/config-plugins');

/**
 * Config plugin to enable foreground service for voice/video calls
 * 
 * This adds Android permissions and service declarations required for:
 * - @notifee/react-native foreground service (2025 best practice)
 * - Voice/video calls running in background
 * - Android 14+ (API 34) and Android 15 foreground service types
 * 
 * CRITICAL FIX for Android 15 (SDK 36):
 * 1. Notifee's AAR declares ForegroundService with android:foregroundServiceType="shortService"
 *    But we need "mediaPlayback|phoneCall|microphone" for voice/video calls.
 *    This plugin uses tools:replace to override the AAR's declaration.
 * 
 * 2. Android 15 requires MANAGE_OWN_CALLS permission alongside FOREGROUND_SERVICE_PHONE_CALL
 *    Without this, the app crashes with SecurityException when starting phoneCall foreground service.
 *    Error: "Starting FGS with type phoneCall... requires permissions: allOf=true 
 *    [FOREGROUND_SERVICE_PHONE_CALL] anyOf=false [MANAGE_OWN_CALLS, android.app.role.DIALER]"
 * 
 * Permissions added:
 * - FOREGROUND_SERVICE (for starting foreground service)
 * - FOREGROUND_SERVICE_PHONE_CALL (for VoIP calls - Android 14+)
 * - FOREGROUND_SERVICE_MEDIA_PLAYBACK (for audio in background - Android 14+)
 * - FOREGROUND_SERVICE_MICROPHONE (for microphone in foreground service - Android 14+)
 * - FOREGROUND_SERVICE_CAMERA (for camera in foreground service - Android 14+)
 * - MANAGE_OWN_CALLS (required by Android 15 for phoneCall foreground service type)
 * - WAKE_LOCK (keep device awake during calls)
 */
const withForegroundService = (config) => {
  return withAndroidManifest(config, async (config) => {
    const androidManifest = config.modResults;
    
    // Ensure tools namespace is declared for manifest merger attributes
    if (!androidManifest.manifest.$['xmlns:tools']) {
      androidManifest.manifest.$['xmlns:tools'] = 'http://schemas.android.com/tools';
    }
    
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
      // CRITICAL for Android 15 (SDK 36): Required alongside FOREGROUND_SERVICE_PHONE_CALL
      // Android 15 requires MANAGE_OWN_CALLS or being the default dialer to use phoneCall foreground service type
      'android.permission.MANAGE_OWN_CALLS',
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
    
    // Get or create the application element
    const application = androidManifest.manifest.application?.[0];
    if (!application) {
      console.warn('[withForegroundService] ⚠️ No application element found in manifest');
      return config;
    }
    
    // Ensure service array exists
    if (!application.service) {
      application.service = [];
    }
    
    // Find or create Notifee's ForegroundService with correct foregroundServiceType
    // CRITICAL: We need to use tools:replace to override the shortService type from Notifee's AAR
    const notifeeServiceName = 'app.notifee.core.ForegroundService';
    let notifeeService = application.service.find(
      (s) => s.$['android:name'] === notifeeServiceName
    );
    
    if (notifeeService) {
      // Service exists - update it with tools:replace to override AAR
      notifeeService.$['android:foregroundServiceType'] = 'mediaPlayback|phoneCall|microphone';
      notifeeService.$['tools:replace'] = 'android:foregroundServiceType';
      console.log('[withForegroundService] ✅ Updated existing Notifee ForegroundService with foregroundServiceType override');
    } else {
      // Service doesn't exist yet - add it with full declaration
      // This will merge with/override the AAR's declaration
      application.service.push({
        $: {
          'android:name': notifeeServiceName,
          'android:exported': 'false',
          'android:foregroundServiceType': 'mediaPlayback|phoneCall|microphone',
          'tools:replace': 'android:foregroundServiceType',
        },
      });
      console.log('[withForegroundService] ✅ Added Notifee ForegroundService with correct foregroundServiceType');
    }
    
    return config;
  });
};

module.exports = withForegroundService;
