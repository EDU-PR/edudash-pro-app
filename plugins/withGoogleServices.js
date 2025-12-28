/**
 * Config plugin to write google-services.json from EAS secret
 * This allows us to keep the file out of git while still using it in EAS builds
 */
const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const withGoogleServices = (config) => {
  return withDangerousMod(config, [
    'android',
    async (config) => {
      const googleServicesJson = process.env.GOOGLE_SERVICES_JSON;
      
      if (!googleServicesJson) {
        console.warn(
          '⚠️ GOOGLE_SERVICES_JSON environment variable not set. ' +
          'Firebase/FCM features may not work correctly.'
        );
        return config;
      }

      const projectRoot = config.modRequest.projectRoot;
      const androidAppDir = path.join(projectRoot, 'android', 'app');
      
      // Ensure the directory exists
      if (!fs.existsSync(androidAppDir)) {
        fs.mkdirSync(androidAppDir, { recursive: true });
      }

      const googleServicesPath = path.join(androidAppDir, 'google-services.json');
      
      try {
        // Write the google-services.json file from the environment variable
        fs.writeFileSync(googleServicesPath, googleServicesJson, 'utf8');
        console.log('✅ google-services.json written successfully from EAS secret');
      } catch (error) {
        console.error('❌ Failed to write google-services.json:', error.message);
      }

      return config;
    },
  ]);
};

module.exports = withGoogleServices;
