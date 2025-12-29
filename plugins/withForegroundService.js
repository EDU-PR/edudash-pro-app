const { withAndroidManifest } = require('@expo/config-plugins');

/**
 * Config plugin to enable foreground service for voice/video calls
 * 
 * This adds:
 * - FOREGROUND_SERVICE permission (for starting foreground service)
 * - FOREGROUND_SERVICE_PHONE_CALL permission (for VoIP calls)
 * - FOREGROUND_SERVICE_MEDIA_PLAYBACK permission (for audio in background)
 * - Service declaration for VoximplantForegroundService
 */
const withForegroundService = (config) => {
  return withAndroidManifest(config, async (config) => {
    const androidManifest = config.modResults;
    
    // Add permissions if not already present
    if (!androidManifest.manifest['uses-permission']) {
      androidManifest.manifest['uses-permission'] = [];
    }
    
    const permissions = androidManifest.manifest['uses-permission'];
    
    const requiredPermissions = [
      'android.permission.FOREGROUND_SERVICE',
      'android.permission.FOREGROUND_SERVICE_PHONE_CALL',
      'android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK',
      'android.permission.WAKE_LOCK',
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
    
    // Add the foreground service to the application
    if (androidManifest.manifest.application) {
      const application = androidManifest.manifest.application[0];
      
      if (!application.service) {
        application.service = [];
      }
      
      // Check if service already exists
      const serviceExists = application.service.some(
        (s) => s.$['android:name'] === 'com.voximplant.foregroundservice.VoximplantForegroundService'
      );
      
      if (!serviceExists) {
        application.service.push({
          $: {
            'android:name': 'com.voximplant.foregroundservice.VoximplantForegroundService',
            'android:exported': 'false',
            'android:foregroundServiceType': 'phoneCall|mediaPlayback',
          },
        });
        console.log('[withForegroundService] ✅ Added VoximplantForegroundService');
      }
    }
    
    return config;
  });
};

module.exports = withForegroundService;
