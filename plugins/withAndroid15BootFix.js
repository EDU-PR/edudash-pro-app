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
    // 
    // Google Play error specifically mentions:
    // - expo.modules.audio.service.AudioRecordingService.startForegroundWithNotification
    // - expo.modules.audio.service.AudioControlsService.postOrStartForegroundNotification
    //
    // These are triggered by BOOT_COMPLETED receivers in expo-audio
    const receiversToDisable = [
      // expo-audio module receivers that listen to BOOT_COMPLETED
      'expo.modules.audio.AudioBroadcastReceiver',
      'expo.modules.audio.AudioModule$AudioBroadcastReceiver',
      'expo.modules.audio.service.AudioBroadcastReceiver',
      // Service classes that also act as receivers
      'expo.modules.audio.service.AudioControlsService',
      'expo.modules.audio.service.AudioRecordingService',
    ];
    
    // Add tools:node="remove" entries for problematic receivers
    for (const receiverName of receiversToDisable) {
      const existingIndex = application.receiver.findIndex(
        (r) => r.$['android:name'] === receiverName
      );
      
      if (existingIndex >= 0) {
        // Modify existing receiver to add tools:node="remove"
        application.receiver[existingIndex].$['tools:node'] = 'remove';
        console.log(`[withAndroid15BootFix] ✅ Modified receiver for removal: ${receiverName}`);
      } else {
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
    // IMPORTANT: These services must NOT be started from BOOT_COMPLETED receivers
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
      let serviceIndex = application.service.findIndex(
        (s) => s.$['android:name'] === serviceConfig.name
      );
      
      if (serviceIndex >= 0) {
        let service = application.service[serviceIndex];
        // Update existing service
        service.$['android:foregroundServiceType'] = serviceConfig.foregroundServiceType;
        service.$['tools:replace'] = 'android:foregroundServiceType';
        // Important: Disable exported to prevent issues
        service.$['android:exported'] = 'false';
        
        // Remove any BOOT_COMPLETED intent-filters from this service
        if (service['intent-filter']) {
          service['intent-filter'] = service['intent-filter'].filter((filter) => {
            const actions = filter.action || [];
            const hasBootCompleted = actions.some(
              (a) => a.$?.['android:name']?.includes('BOOT_COMPLETED')
            );
            if (hasBootCompleted) {
              console.log(`[withAndroid15BootFix] ✅ Removed BOOT_COMPLETED intent-filter from: ${serviceConfig.name}`);
              return false;
            }
            return true;
          });
        }
        
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
    
    // Also remove any uses-permission for RECEIVE_BOOT_COMPLETED
    if (androidManifest.manifest['uses-permission']) {
      const bootPermIndex = androidManifest.manifest['uses-permission'].findIndex(
        (p) => p.$?.['android:name'] === 'android.permission.RECEIVE_BOOT_COMPLETED'
      );
      if (bootPermIndex >= 0) {
        androidManifest.manifest['uses-permission'].splice(bootPermIndex, 1);
        console.log('[withAndroid15BootFix] ✅ Removed RECEIVE_BOOT_COMPLETED permission');
      }
    }
    
    console.log('[withAndroid15BootFix] ✅ Android 15 BOOT_COMPLETED fix applied');
    
    return config;
  });
};

module.exports = withAndroid15BootFix;
