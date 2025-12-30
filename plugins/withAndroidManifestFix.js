const { withAndroidManifest, withGradleProperties } = require('@expo/config-plugins');

/**
 * Config plugin to fix Android Manifest merger errors and configure foreground services
 * - Ensures AndroidX compatibility
 * - Fixes Firebase messaging meta-data conflicts between expo-notifications and @react-native-firebase/messaging
 * - Updates foreground service type declarations for existing services
 * 
 * NOTE: We DO NOT manually add services here. Services are added by their respective libraries:
 * - @notifee/react-native adds its own ForegroundService
 * - @react-native-firebase/messaging adds its own MessagingService
 * We only modify existing services to ensure correct foregroundServiceType
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
    
    if (androidManifest.manifest.application) {
      const application = androidManifest.manifest.application[0];
      
      // Ensure tools namespace is declared
      if (!androidManifest.manifest.$['xmlns:tools']) {
        androidManifest.manifest.$['xmlns:tools'] = 'http://schemas.android.com/tools';
      }
      
      // Remove any existing tools:replace on application that might be causing issues
      if (application.$['tools:replace']) {
        delete application.$['tools:replace'];
      }
      
      // Set the appComponentFactory to use AndroidX version
      application.$['android:appComponentFactory'] = 'androidx.core.app.CoreComponentFactory';
      
      // Ensure meta-data array exists
      if (!application['meta-data']) {
        application['meta-data'] = [];
      }
      
      // Fix Firebase messaging meta-data conflicts
      // expo-notifications and @react-native-firebase/messaging both set these values
      // We need to add tools:replace to override the Firebase library's values
      const firebaseMetaDataKeys = [
        'com.google.firebase.messaging.default_notification_channel_id',
        'com.google.firebase.messaging.default_notification_color',
        'com.google.firebase.messaging.default_notification_icon',
      ];
      
      for (const metaData of application['meta-data']) {
        const name = metaData.$?.['android:name'];
        if (firebaseMetaDataKeys.includes(name)) {
          // Add tools:replace to override the library's value
          if (metaData.$['android:value']) {
            metaData.$['tools:replace'] = 'android:value';
          } else if (metaData.$['android:resource']) {
            metaData.$['tools:replace'] = 'android:resource';
          }
          console.log(`[withAndroidManifestFix] ✅ Added tools:replace to ${name}`);
        }
      }
      
      if (!application.service) {
        application.service = [];
      }
      
      // NOTE: CallKeep service removed - CallKeep is no longer used (Expo SDK 54+ incompatible)
      
      // Update expo-audio foreground service if it exists (added by expo-audio plugin)
      const audioService = application.service.find(
        (s) => s.$?.['android:name'] === 'expo.modules.av.AudioForegroundService'
      );
      if (audioService) {
        audioService.$['android:foregroundServiceType'] = 'mediaPlayback';
        console.log('[withAndroidManifestFix] ✅ Updated expo-audio service');
      }
      
      // Update Notifee foreground service if it exists (added by @notifee/react-native)
      const notifeeService = application.service.find(
        (s) => s.$?.['android:name'] === 'app.notifee.core.ForegroundService'
      );
      if (notifeeService) {
        notifeeService.$['android:foregroundServiceType'] = 'phoneCall|mediaPlayback|microphone';
        console.log('[withAndroidManifestFix] ✅ Updated Notifee service with call types');
      }
    }
    
    return config;
  });
};

module.exports = withAndroidManifestFix;
