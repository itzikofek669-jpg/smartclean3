#!/usr/bin/env node
/**
 * Point the Android release build at a real signing key.
 *
 * `expo prebuild` writes a build.gradle whose release buildType is signed with
 * `signingConfigs.debug` — and that debug keystore is the one shipped inside
 * the expo template package on npm, password `android`. An APK signed with it
 * can be replaced in place by anyone who downloads that package, because
 * Android accepts a same-signature APK as an update with no warning.
 *
 * This adds a `release` signingConfig reading its credentials from the
 * environment (never from a file in the repo) and repoints the release
 * buildType at it. Run from CI after prebuild, only when the signing secrets
 * exist; see .github/workflows/build-android.yml.
 *
 * It refuses to do anything it does not recognise. Silently leaving the build
 * debug-signed is the failure worth preventing.
 */
const fs = require('fs');

const path = process.argv[2];
if (!path) {
  console.error('::error::usage: wire-release-signing.js <path to build.gradle>');
  process.exit(1);
}

let gradle = fs.readFileSync(path, 'utf8');

if (!/signingConfigs\s*\{/.test(gradle)) {
  console.error(`::error::No signingConfigs block in ${path}. The prebuild template changed.`);
  process.exit(1);
}
if (!/signingConfig\s+signingConfigs\.debug/.test(gradle)) {
  console.error(`::error::No release buildType pointing at signingConfigs.debug in ${path}. The prebuild template changed; update this script rather than shipping a debug-signed APK.`);
  process.exit(1);
}

const releaseConfig = `signingConfigs {
        release {
            storeFile file('release.keystore')
            storePassword System.getenv('KEYSTORE_PASS')
            keyAlias System.getenv('KEY_ALIAS')
            keyPassword System.getenv('KEY_PASS')
        }`;

gradle = gradle.replace(/signingConfigs\s*\{/, releaseConfig);

// Only the RELEASE buildType. A blanket replace also moved the debug buildType
// onto the release key, which breaks `expo run:android` for anyone building
// locally — they have no release.keystore and no reason to need one.
const repointed = gradle.replace(
  /(buildTypes[\s\S]*?\brelease\s*\{[\s\S]*?signingConfig\s+)signingConfigs\.debug/,
  '$1signingConfigs.release',
);
if (repointed === gradle) {
  console.error('::error::Found a debug signingConfig but not inside the release buildType. Refusing to guess.');
  process.exit(1);
}
gradle = repointed;

// Verify BEFORE writing. The check below used to run after fs.writeFileSync, so
// a bad rewrite was already on disk by the time it was caught — in CI the step
// exits and no APK ships, but run locally it left `expo run:android` broken and
// asking for a release.keystore the developer does not have.
//
// The `[\s\S]*?` above can cross a block boundary when the release buildType
// has no signingConfig line of its own, and the debug block that follows gets
// repointed instead. That is the corruption this refuses to write.
{
  const releaseBlock = gradle.match(/buildTypes[\s\S]*?\brelease\s*\{[\s\S]*?\}/);
  const debugBlock = gradle.match(/buildTypes[\s\S]*?\bdebug\s*\{[\s\S]*?\}/);
  if (!releaseBlock || !/signingConfigs\.release/.test(releaseBlock[0])) {
    console.error('::error::The release buildType is still not on the release key. Refusing to write.');
    process.exit(1);
  }
  if (debugBlock && /signingConfigs\.release/.test(debugBlock[0])) {
    console.error('::error::The rewrite moved the DEBUG buildType onto the release key, which would break local builds. Refusing to write.');
    process.exit(1);
  }
}

fs.writeFileSync(path, gradle);
console.log('Release signing config wired into build.gradle');
