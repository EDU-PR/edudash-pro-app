/**
 * Config plugin to copy call sound files to Android raw resources.
 *
 * Android notification channels require sound files to be in
 * android/app/src/main/res/raw/ to be referenced by name.
 *
 * This plugin copies:
 *   - assets/sounds/ringtone.mp3  → res/raw/ringtone.mp3   (incoming call ring)
 *   - assets/sounds/ringback.mp3  → res/raw/ringback.mp3   (outgoing call tone)
 *
 * After prebuild, Notifee / expo-notifications can reference them as:
 *   sound: 'ringtone'   // Android resolves to res/raw/ringtone.mp3
 */

const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const withCallSounds = (config) => {
  return withDangerousMod(config, [
    'android',
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const rawDir = path.join(
        config.modRequest.platformProjectRoot,
        'app',
        'src',
        'main',
        'res',
        'raw'
      );

      // Ensure res/raw/ exists
      if (!fs.existsSync(rawDir)) {
        fs.mkdirSync(rawDir, { recursive: true });
      }

      // Sound files to copy
      const sounds = ['ringtone.mp3', 'ringback.mp3'];

      for (const file of sounds) {
        const src = path.join(projectRoot, 'assets', 'sounds', file);
        const dest = path.join(rawDir, file);

        if (fs.existsSync(src)) {
          fs.copyFileSync(src, dest);
          console.log(`[withCallSounds] ✅ Copied ${file} → res/raw/${file}`);
        } else {
          console.warn(`[withCallSounds] ⚠️ ${src} not found — skipping`);
        }
      }

      return config;
    },
  ]);
};

module.exports = withCallSounds;
