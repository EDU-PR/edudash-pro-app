const { withAndroidManifest } = require('@expo/config-plugins');

/**
 * Config plugin to fix Android 15 (SDK 35+) BOOT_COMPLETED restrictions
 * 
 * Android 15 restricts apps from starting foreground services from BOOT_COMPLETED broadcast receivers
 * for certain foreground service types. expo-audio module has receivers that do this.
 * 
 * This plugin:
 * 1. Removes any BOOT_COMPLETED receivers that start restricted foreground services
 * 2. Ensures audio services have proper foreground service types for Android 15
 * 
 * Error from Google Play:
 * "Apps targeting Android 15 or later cannot use BOOT_COMPLETED broadcast receivers to launch 
 *  certain foreground service types. Your app starts restricted foreground service types using 
 *  BOOT_COMPLETED broadcast receivers in:
 *  - expo.modules.audio.service.AudioControlsService.postOrStartForegroundNotification
 *  - expo.modules.audio.service.AudioRecordingService.startForegroundWithNotification"
 * 
 * Solution: Use tools:node="remove" to disable problematic receivers from third-party libraries
 */
const withAndroid15BootFix = (config) => {
  return withAndroidManifest(config, async (config) => {
    const androidManifest = config.modResults;
    
    // Ensure tools namespace is declared
    if (!androidManifest.manifest.$['xmlns:tools']) {
      androidManifest.manifest.$['xmlns:tools'] = 'http://schemas.android.com/tools';
    }
    
    const application = androidManifest.manifest.application?.[0];
    if (!application) {
      console.warn('[withAndroid15BootFix] ⚠️ No application element found');
      return config;
    }
    
    // Ensure receiver array exists
    if (!application.receiver) {
      application.receiver = [];
    }
    
    // List of receivers to disable (from expo-audio and other libs that cause Android 15 issues)
    // These receivers try to start foreground services on BOOT_COMPLETED which is restricted
    const receiversToDisable = [
      // expo-audio module receivers
      'expo.modules.audio.AudioBroadcastReceiver',
      // Add any other problematic receivers here as they're discovered
    ];
    
    // Add tools:node="remove" entries for problematic receivers
    for (const receiverName of receiversToDisable) {
      const exists = application.receiver.some(
        (r) => r.$['android:name'] === receiverName
      );
      
      if (!exists) {
        // Add receiver with tools:node="remove" to prevent it from being included
        application.receiver.push({
          $: {
            'android:name': receiverName,
            'tools:node': 'remove',
          },
        });
        console.log(`[withAndroid15BootFix] ✅ Added removal entry for receiver: ${receiverName}`);
      }
    }
    
    // Ensure service array exists
    if (!application.service) {
      application.service = [];
    }
    
    // List of expo-audio services that need proper foreground service types
    // We override them to ensure they have compatible types and don't cause issues
    const audioServices = [
      {
        name: 'expo.modules.audio.service.AudioControlsService',
        foregroundServiceType: 'mediaPlayback',
      },
      {
        name: 'expo.modules.audio.service.AudioRecordingService',
        foregroundServiceType: 'microphone',
      },
    ];
    
    for (const serviceConfig of audioServices) {
      let service = application.service.find(
        (s) => s.$['android:name'] === serviceConfig.name
      );
      
      if (service) {
        // Update existing service
        service.$['android:foregroundServiceType'] = serviceConfig.foregroundServiceType;
        service.$['tools:replace'] = 'android:foregroundServiceType';
        // Important: Disable exported to prevent issues
        service.$['android:exported'] = 'false';
        console.log(`[withAndroid15BootFix] ✅ Updated service: ${serviceConfig.name}`);
      } else {
        // Add service declaration with override
        application.service.push({
          $: {
            'android:name': serviceConfig.name,
            'android:foregroundServiceType': serviceConfig.foregroundServiceType,
            'android:exported': 'false',
            'tools:replace': 'android:foregroundServiceType',
          },
        });
        console.log(`[withAndroid15BootFix] ✅ Added service: ${serviceConfig.name}`);
      }
    }
    
    console.log('[withAndroid15BootFix] ✅ Android 15 BOOT_COMPLETED fix applied');
    
    return config;
  });
};

module.exports = withAndroid15BootFix;
