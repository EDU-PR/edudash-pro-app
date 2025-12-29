/**
 * withFirebaseMessaging.js - Firebase Cloud Messaging config plugin for Expo
 * 
 * This plugin configures FCM metadata only. The actual services are added by
 * @react-native-firebase/messaging plugin automatically - we don't add them here
 * to avoid manifest merger conflicts.
 * 
 * @see https://rnfirebase.io/messaging/usage
 */

const { withAndroidManifest } = require('expo/config-plugins');

module.exports = function withFirebaseMessaging(config) {
  return withAndroidManifest(config, async (config) => {
    const androidManifest = config.modResults;
    const mainApplication = androidManifest.manifest.application?.[0];
    
    if (!mainApplication) {
      return config;
    }
    
    // Ensure meta-data array exists
    if (!mainApplication['meta-data']) {
      mainApplication['meta-data'] = [];
    }
    
    // Add Firebase messaging auto-init
    const autoInitExists = mainApplication['meta-data'].find(
      (item) => item.$?.['android:name'] === 'firebase_messaging_auto_init_enabled'
    );
    if (!autoInitExists) {
      mainApplication['meta-data'].push({
        $: {
          'android:name': 'firebase_messaging_auto_init_enabled',
          'android:value': 'true',
        },
      });
    }
    
    // Disable Firebase analytics (we only need messaging)
    const analyticsExists = mainApplication['meta-data'].find(
      (item) => item.$?.['android:name'] === 'firebase_analytics_collection_enabled'
    );
    if (!analyticsExists) {
      mainApplication['meta-data'].push({
        $: {
          'android:name': 'firebase_analytics_collection_enabled',
          'android:value': 'false',
        },
      });
    }
    
    // NOTE: We do NOT add Firebase services here - the @react-native-firebase/messaging
    // plugin handles that automatically. Adding them here causes manifest merger conflicts.
    
    console.log('[withFirebaseMessaging] ✅ FCM metadata configured');
    return config;
  });
};
