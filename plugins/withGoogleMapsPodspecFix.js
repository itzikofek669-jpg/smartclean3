/**
 * Rewrites the Google Maps pod that Expo's own maps plugin writes into the
 * Podfile, because the name it uses no longer exists.
 *
 * @expo/config-plugins emits:
 *     pod 'react-native-google-maps', path: ...
 *
 * That was a separate podspec until react-native-maps 1.21. From 1.27 — the
 * version Expo SDK 57 pins — the package ships one podspec with subspecs, and
 * Google support is `react-native-maps/Google` (default_subspec is 'Maps',
 * i.e. Apple Maps only). Leaving it alone fails `pod install` outright:
 *     [!] No podspec found for `react-native-google-maps`
 *
 * This runs as a mod so the fix is reapplied on every prebuild rather than
 * being a hand edit to ios/Podfile that `--clean` would throw away.
 *
 * Delete this once @expo/config-plugins emits the subspec itself.
 */
const { withPodfile } = require('expo/config-plugins');

const OLD = "pod 'react-native-google-maps'";
const NEW = "pod 'react-native-maps/Google'";

module.exports = function withGoogleMapsPodspecFix(config) {
  return withPodfile(config, (cfg) => {
    const { contents } = cfg.modResults;
    if (contents.includes(OLD)) {
      cfg.modResults.contents = contents.replace(OLD, NEW);
    }
    return cfg;
  });
};
