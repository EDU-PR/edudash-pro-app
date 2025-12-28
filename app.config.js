// Load environment variables from .env file
require('dotenv').config();

/**
 * app.config.js - Minimal Dynamic Configuration
 * 
 * This file handles ONLY truly dynamic configuration that cannot be static.
 * All static configuration is in app.json (primary source of truth).
 * 
 * Dynamic behaviors:
 * 1. Conditionally include expo-dev-client (only for development builds)
 * 2. Dynamic AdMob IDs from environment variables (for different environments)
 * 3. App variant suffix for dev builds (allows both dev and preview on same device)
 * 4. Google Services file from EAS env for Firebase (when building on EAS)
 * 
 * @param {import('@expo/config').ConfigContext} ctx
 */
module.exports = ({ config }) => {
  const profile = process.env.EAS_BUILD_PROFILE || '';
  const appVariant = process.env.APP_VARIANT || '';
  const isDevBuild = profile === 'development' || appVariant === 'development';
  const isWeb = process.env.EXPO_PUBLIC_PLATFORM === 'web';
  
  // Google Services file: use EAS env file path if available, fallback to local
  const googleServicesFile = process.env.GOOGLE_SERVICES_JSON || './android/app/google-services.json';

  // Get AdMob IDs from environment (fallback to test IDs)
  const androidAdMobId = process.env.EXPO_PUBLIC_ADMOB_ANDROID_APP_ID || 'ca-app-pub-3940256099942544~3347511713';
  const iosAdMobId = process.env.EXPO_PUBLIC_ADMOB_IOS_APP_ID || 'ca-app-pub-3940256099942544~1458002511';

  // Build plugins array with dynamic AdMob config
  const plugins = config.plugins.map((plugin) => {
    // Update AdMob plugin with environment-specific IDs
    if (Array.isArray(plugin) && plugin[0] === 'react-native-google-mobile-ads') {
      return [
        'react-native-google-mobile-ads',
        {
          androidAppId: androidAdMobId,
          iosAppId: iosAdMobId,
        },
      ];
    }
    return plugin;
  });

  // Conditionally add expo-dev-client for development builds only
  // This is required for OTA updates to work correctly in production
  if (!isWeb && (isDevBuild || !process.env.EAS_BUILD_PLATFORM)) {
    plugins.push('expo-dev-client');
  }

  // Development variant config (different package name so both can be installed)
  const devConfig = isDevBuild ? {
    name: 'EduDashPro Dev',
    android: {
      ...config.android,
      package: 'com.edudashpro.app.dev',
      googleServicesFile,
    },
    ios: {
      ...config.ios,
      bundleIdentifier: 'com.k1ngdevops.edudashpro.dev',
    },
  } : {
    // Production config also needs googleServicesFile
    android: {
      ...config.android,
      googleServicesFile,
    },
  };

  return {
    ...config,
    ...devConfig,
    plugins,
    extra: {
      ...config.extra,
      // Explicitly expose environment variables to the app
      EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
      EXPO_PUBLIC_SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
      EXPO_PUBLIC_API_BASE: process.env.EXPO_PUBLIC_API_BASE,
      DAILY_API_KEY: process.env.DAILY_API_KEY,
    },
  };
};
