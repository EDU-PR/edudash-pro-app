const { withAndroidManifest } = require('@expo/config-plugins');

/**
 * Config plugin to enable Picture-in-Picture mode for video calls
 * 
 * This adds:
 * - android:supportsPictureInPicture="true" to MainActivity
 * - android:configChanges to handle PiP transitions smoothly
 * - Required permissions for PiP mode
 */
const withPictureInPicture = (config) => {
  return withAndroidManifest(config, async (config) => {
    const androidManifest = config.modResults;
    
    if (androidManifest.manifest.application) {
      const application = androidManifest.manifest.application[0];
      
      // Find MainActivity
      if (application.activity) {
        const mainActivity = application.activity.find(
          (activity) => activity.$['android:name'] === '.MainActivity'
        );
        
        if (mainActivity) {
          // Enable Picture-in-Picture
          mainActivity.$['android:supportsPictureInPicture'] = 'true';
          
          // Update configChanges to handle PiP transitions
          // PiP requires handling screenSize and smallestScreenSize changes
          const existingConfigChanges = mainActivity.$['android:configChanges'] || '';
          const requiredChanges = ['screenSize', 'smallestScreenSize', 'screenLayout'];
          
          const currentChanges = existingConfigChanges.split('|').map(s => s.trim()).filter(Boolean);
          const newChanges = [...new Set([...currentChanges, ...requiredChanges])];
          
          mainActivity.$['android:configChanges'] = newChanges.join('|');
          
          // PiP works best with these settings
          mainActivity.$['android:resizeableActivity'] = 'true';
          
          console.log('[withPictureInPicture] ✅ Enabled PiP for MainActivity');
          console.log('[withPictureInPicture] configChanges:', mainActivity.$['android:configChanges']);
        }
      }
    }
    
    return config;
  });
};

module.exports = withPictureInPicture;
