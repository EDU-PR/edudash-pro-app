const { withAndroidManifest, withGradleProperties } = require('@expo/config-plugins');

/**
 * Config plugin to fix Android Manifest merger errors and configure foreground services
 * - Ensures AndroidX compatibility
 * - Removes conflicting tools:replace attributes
 * - Adds foreground service type declarations for PHONE_CALL and MEDIA_PLAYBACK
 * - Works with both local builds (expo run:android) and EAS builds
 */
const withAndroidManifestFix = (config) => {
  // First, ensure AndroidX is enabled in gradle.properties
  config = withGradleProperties(config, (config) => {
    config.modResults = config.modResults.filter(
      (item) => !['android.useAndroidX', 'android.enableJetifier'].includes(item.key)
    );
    
    config.modResults.push(
      { type: 'property', key: 'android.useAndroidX', value: 'true' },
      { type: 'property', key: 'android.enableJetifier', value: 'true' }
    );
    
    return config;
  });

  // Then fix the manifest
  return withAndroidManifest(config, async (config) => {
    const androidManifest = config.modResults;
    
    // Ensure the application tag exists
    if (androidManifest.manifest.application) {
      const application = androidManifest.manifest.application[0];
      
      // Ensure tools namespace is declared
      if (!androidManifest.manifest.$['xmlns:tools']) {
        androidManifest.manifest.$['xmlns:tools'] = 'http://schemas.android.com/tools';
      }
      
      // Remove any existing tools:replace that might be causing issues
      if (application.$['tools:replace']) {
        delete application.$['tools:replace'];
      }
      
      // Set the appComponentFactory to use AndroidX version
      // This should be set without tools:replace since we're using AndroidX throughout
      application.$['android:appComponentFactory'] = 'androidx.core.app.CoreComponentFactory';
      
      // Ensure services array exists
      if (!application.service) {
        application.service = [];
      }
      
      // Add/update CallKeep foreground service with proper foregroundServiceType
      const callServiceName = 'io.wazo.callkeep.VoiceConnectionService';
      let callService = application.service.find(
        (s) => s.$['android:name'] === callServiceName
      );
      
      if (!callService) {
        callService = {
          $: {
            'android:name': callServiceName,
            'android:permission': 'android.permission.BIND_TELECOM_CONNECTION_SERVICE',
            'android:exported': 'true',
            'android:foregroundServiceType': 'phoneCall',
          },
          'intent-filter': [
            {
              action: [{ $: { 'android:name': 'android.telecom.ConnectionService' } }],
            },
          ],
        };
        application.service.push(callService);
      } else {
        // Ensure foregroundServiceType is set
        callService.$['android:foregroundServiceType'] = 'phoneCall';
      }
      
      // Add media playback foreground service for TTS/audio (if using expo-av or similar)
      // This is handled by expo-audio plugin, but we ensure the type is set
      const audioServiceName = 'expo.modules.av.AudioForegroundService';
      let audioService = application.service.find(
        (s) => s.$['android:name'] === audioServiceName
      );
      
      if (audioService) {
        audioService.$['android:foregroundServiceType'] = 'mediaPlayback';
      }
      
      // Add Notifee foreground service for call persistence (Android 14+)
      // This service is used by @notifee/react-native to keep calls alive in background
      const notifeeServiceName = 'app.notifee.core.ForegroundService';
      let notifeeService = application.service.find(
        (s) => s.$['android:name'] === notifeeServiceName
      );
      
      if (!notifeeService) {
        // Create new service declaration
        notifeeService = {
          $: {
            'android:name': notifeeServiceName,
            'android:foregroundServiceType': 'phoneCall',
            'android:exported': 'false',
          },
        };
        application.service.push(notifeeService);
        console.log('[withAndroidManifestFix] ✅ Added Notifee service with phoneCall type');
      } else {
        // Update existing service to ensure correct type
        notifeeService.$['android:foregroundServiceType'] = 'phoneCall';
        notifeeService.$['android:exported'] = 'false';
        console.log('[withAndroidManifestFix] ✅ Updated Notifee service with phoneCall type');
      }
    }
    
    return config;
  });
};

module.exports = withAndroidManifestFix;
