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
 * 5. EAS Project ID switching via EAS_PROJECT_ID environment variable
 * 
 * EAS Project Switching:
 * Set EAS_PROJECT_ID env var to switch between projects/accounts without editing app.json
 * 
 * Available Project IDs:
 * - dash-t:           d3bb7cfc-56c8-4266-be3a-9892dab09c0c (default)
 * - edudashproplay-store: (set in EAS_PROJECT_ID_PLAYSTORE env var)
 * - king-prod:        (set in EAS_PROJECT_ID_KINGPROD env var)
 * 
 * Usage: EAS_PROJECT_ID=your-project-id npx eas build ...
 * 
 * @param {import('@expo/config').ConfigContext} ctx
 */

// EAS Project ID configuration
// Use aliases like: EAS_PROJECT_ID=playstore npx eas build ...
const EAS_PROJECTS = {
  // Default project (dash-t account)
  default: { id: 'd3bb7cfc-56c8-4266-be3a-9892dab09c0c', owner: 'dash-t', slug: 'edudashpro' },
  // Aliases for easy switching
  'dash-t': { id: 'd3bb7cfc-56c8-4266-be3a-9892dab09c0c', owner: 'dash-t', slug: 'edudashpro' },
  // edudashproplay-store org - EduPro-Final project (has build quota)
  'playstore': { id: 'accd5738-9ee6-434c-a3be-668d9674f541', owner: 'edudashproplay-store', slug: 'edupro-final' },
  'edupro-final': { id: 'accd5738-9ee6-434c-a3be-668d9674f541', owner: 'edudashproplay-store', slug: 'edupro-final' },
  // king-prod account (set ID via env var)
  'king-prod': { id: process.env.EAS_PROJECT_ID_KINGPROD || '', owner: 'king-prod', slug: 'edudashpro' },
};

// Resolve project config from environment or use default
function getEasProjectConfig() {
  const envProjectId = process.env.EAS_PROJECT_ID;
  
  if (envProjectId) {
    // Check if it's an alias
    if (EAS_PROJECTS[envProjectId]) {
      console.log(`[app.config.js] Using EAS project alias: ${envProjectId}`);
      return EAS_PROJECTS[envProjectId];
    }
    // Otherwise treat as direct project ID (use default owner/slug)
    console.log(`[app.config.js] Using custom EAS project ID: ${envProjectId}`);
    return { 
      id: envProjectId, 
      owner: process.env.EAS_PROJECT_OWNER || 'dash-t',
      slug: process.env.EAS_PROJECT_SLUG || 'edudashpro'
    };
  }
  
  // Default
  return EAS_PROJECTS.default;
}

module.exports = ({ config }) => {
  const profile = process.env.EAS_BUILD_PROFILE || '';
  const appVariant = process.env.APP_VARIANT || '';
  const isDevBuild = profile === 'development' || appVariant === 'development';
  const isWeb = process.env.EXPO_PUBLIC_PLATFORM === 'web';
  
  // Get dynamic EAS project config (ID and owner)
  const easConfig = getEasProjectConfig();
  
  // Google Services file: use EAS env file path if available, fallback to local root file
  const googleServicesFile = process.env.GOOGLE_SERVICES_JSON || './google-services.json';

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

  // Add Picture-in-Picture support for video calls
  plugins.push('./plugins/withPictureInPicture.js');

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
    // Dynamic owner and slug based on EAS_PROJECT_ID (allows switching accounts)
    owner: easConfig.owner,
    slug: easConfig.slug,
    plugins,
    // Dynamic updates URL to match the selected EAS project
    updates: {
      ...config.updates,
      url: `https://u.expo.dev/${easConfig.id}`,
    },
    extra: {
      ...config.extra,
      // Dynamic EAS project ID (allows switching without editing app.json)
      eas: {
        projectId: easConfig.id,
      },
      // Explicitly expose environment variables to the app
      EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
      EXPO_PUBLIC_SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
      EXPO_PUBLIC_API_BASE: process.env.EXPO_PUBLIC_API_BASE,
      DAILY_API_KEY: process.env.DAILY_API_KEY,
    },
  };
};
