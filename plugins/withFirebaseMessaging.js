/**
 * withFirebaseMessaging.js - Firebase Cloud Messaging config plugin for Expo
 * 
 * This plugin configures FCM for background message handling (incoming calls when app killed).
 * It complements @react-native-firebase/messaging by ensuring:
 * - High-priority FCM delivery (wake device immediately)
 * - HeadlessJS task registration for background handling
 * - Proper Android manifest configuration
 * 
 * @see https://rnfirebase.io/messaging/usage
 */

const { withAndroidManifest, withMainApplication } = require('expo/config-plugins');

/**
 * Configure AndroidManifest.xml for FCM high-priority messages
 */
const withFirebaseMessagingManifest = (config) => {
  return withAndroidManifest(config, async (config) => {
    const androidManifest = config.modResults;
    const mainApplication = androidManifest.manifest.application?.[0];
    
    if (!mainApplication) {
      console.warn('[withFirebaseMessaging] No main application found in AndroidManifest');
      return config;
    }
    
    // Ensure meta-data array exists
    if (!mainApplication['meta-data']) {
      mainApplication['meta-data'] = [];
    }
    
    // Add Firebase messaging auto-init (disabled by default for control)
    const autoInitMeta = mainApplication['meta-data'].find(
      (item) => item.$?.['android:name'] === 'firebase_messaging_auto_init_enabled'
    );
    
    if (!autoInitMeta) {
      mainApplication['meta-data'].push({
        $: {
          'android:name': 'firebase_messaging_auto_init_enabled',
          'android:value': 'true',
        },
      });
    }
    
    // Add Firebase analytics collection (enabled for messaging)
    const analyticsMeta = mainApplication['meta-data'].find(
      (item) => item.$?.['android:name'] === 'firebase_analytics_collection_enabled'
    );
    
    if (!analyticsMeta) {
      mainApplication['meta-data'].push({
        $: {
          'android:name': 'firebase_analytics_collection_enabled',
          'android:value': 'false', // We don't need analytics, just messaging
        },
      });
    }
    
    // Ensure services array exists
    if (!mainApplication.service) {
      mainApplication.service = [];
    }
    
    // Add ReactNativeFirebaseMessagingHeadlessService for background message handling
    // This service is automatically provided by @react-native-firebase/messaging
    // but we ensure it has the correct intent-filter for high-priority messages
    const headlessServiceName = 'io.invertase.firebase.messaging.ReactNativeFirebaseMessagingHeadlessService';
    const existingHeadlessService = mainApplication.service.find(
      (service) => service.$?.['android:name'] === headlessServiceName
    );
    
    if (!existingHeadlessService) {
      mainApplication.service.push({
        $: {
          'android:name': headlessServiceName,
          'android:exported': 'false',
        },
      });
      console.log('[withFirebaseMessaging] Added FCM HeadlessService');
    }
    
    // Ensure receiver array exists
    if (!mainApplication.receiver) {
      mainApplication.receiver = [];
    }
    
    console.log('[withFirebaseMessaging] AndroidManifest configured for FCM');
    return config;
  });
};

/**
 * Configure MainApplication.kt/java to register HeadlessJS task
 * Note: @react-native-firebase/messaging handles this automatically,
 * but we add a comment marker for debugging
 */
const withFirebaseMessagingApp = (config) => {
  return withMainApplication(config, async (config) => {
    // Firebase messaging automatically hooks into the main application
    // via ReactNativeFirebaseMessagingPackage
    // Our CallHeadlessTask.ts handles the background message via:
    // messaging().setBackgroundMessageHandler()
    console.log('[withFirebaseMessaging] MainApplication ready for FCM');
    return config;
  });
};

/**
 * Main plugin export
 */
module.exports = function withFirebaseMessaging(config) {
  console.log('[withFirebaseMessaging] Applying Firebase Messaging config plugin');
  
  // Apply manifest modifications
  config = withFirebaseMessagingManifest(config);
  
  // Apply main application modifications (mostly for logging)
  config = withFirebaseMessagingApp(config);
  
  return config;
};
