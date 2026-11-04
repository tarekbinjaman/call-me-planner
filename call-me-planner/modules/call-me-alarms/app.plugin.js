// Lets the ring screen appear over the lock screen and wake the display (plan 1.7).
// Only the full-screen ring alert launches the app while the phone is locked.
const { withAndroidManifest, AndroidConfig } = require('expo/config-plugins');

module.exports = function withCallMeAlarms(config) {
  return withAndroidManifest(config, (cfg) => {
    const activity = AndroidConfig.Manifest.getMainActivityOrThrow(cfg.modResults);
    activity.$['android:showWhenLocked'] = 'true';
    activity.$['android:turnScreenOn'] = 'true';
    return cfg;
  });
};
