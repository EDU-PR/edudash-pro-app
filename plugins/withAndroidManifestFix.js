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
      // expo-notifications and @react-native-firebase/messaging both set these meta-data entries
      // We need to find them and add tools:replace attributes
      // 
      // IMPORTANT: expo-notifications adds these entries, but we run AFTER it in plugin order
      // So they should exist. We need to add tools:replace to prevent manifest merger conflicts
      // with the @react-native-firebase/messaging library's AndroidManifest.xml
      
      const firebaseMetaDataConfigs = [
        {
          name: 'com.google.firebase.messaging.default_notification_channel_id',
          replaceAttr: 'android:value',
          defaultValue: 'default', // fallback if not set by expo-notifications
        },
        {
          name: 'com.google.firebase.messaging.default_notification_color',
          replaceAttr: 'android:resource',
          defaultResource: '@color/notification_icon_color',
        },
        {
          name: 'com.google.firebase.messaging.default_notification_icon',
          replaceAttr: 'android:resource',
          defaultResource: '@drawable/notification_icon',
        },
      ];
      
      console.log(`[withAndroidManifestFix] Found ${application['meta-data'].length} meta-data entries`);
      
      for (const metaDataConfig of firebaseMetaDataConfigs) {
        const existingIndex = application['meta-data'].findIndex(
          (m) => m.$?.['android:name'] === metaDataConfig.name
        );
        
        if (existingIndex !== -1) {
          // Entry exists - add tools:replace attribute
          application['meta-data'][existingIndex].$['tools:replace'] = metaDataConfig.replaceAttr;
          console.log(`[withAndroidManifestFix] ✅ Added tools:replace="${metaDataConfig.replaceAttr}" to existing ${metaDataConfig.name}`);
        } else {
          // Entry doesn't exist - create it with tools:replace
          // This ensures we have the entry even if expo-notifications didn't add it
          const newMetaData = {
            $: {
              'android:name': metaDataConfig.name,
              'tools:replace': metaDataConfig.replaceAttr,
            },
          };
          
          if (metaDataConfig.defaultValue) {
            newMetaData.$['android:value'] = metaDataConfig.defaultValue;
          } else if (metaDataConfig.defaultResource) {
            newMetaData.$['android:resource'] = metaDataConfig.defaultResource;
          }
          
          application['meta-data'].push(newMetaData);
          console.log(`[withAndroidManifestFix] ✅ Created ${metaDataConfig.name} with tools:replace="${metaDataConfig.replaceAttr}"`);
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
