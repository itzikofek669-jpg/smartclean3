#!/usr/bin/env bash
#
# Build A&M Clean for a real iPhone.
#
# The CI job compiles for the simulator, and a simulator slice cannot be
# installed on a physical device at any price — different architecture. This
# builds the arm64 binary that can.
#
# Installing it on YOUR OWN iPhone costs nothing: a free Apple ID signs an app
# for personal devices. The $99/year Apple Developer Program is only needed to
# distribute to other people, through TestFlight or the App Store.
#
#   bash scripts/ios-device-build.sh          # compile, unsigned (verification)
#   bash scripts/ios-device-build.sh --open    # compile, then open Xcode to run it
#
# To actually put it on the phone, Xcode has to do the signing, because only it
# can talk to your Apple ID. See the instructions this prints at the end.

set -euo pipefail
cd "$(dirname "$0")/.."

export LANG=en_US.UTF-8
export LC_ALL=en_US.UTF-8

command -v xcodebuild >/dev/null || { echo "Xcode is not installed."; exit 1; }

# `ios/` is gitignored and generated, so it can be stale — this one was four
# months old and predated expo-task-manager entirely.
echo "→ Regenerating the native project from app.json…"
EXPO_NO_GIT_STATUS=1 npx expo prebuild --platform ios --no-install >/dev/null

echo "→ Installing pods…"
( cd ios && pod install >/dev/null 2>&1 )

echo "→ Compiling for arm64 (device)…"
( cd ios && xcodebuild \
    -workspace AMClean.xcworkspace \
    -scheme AMClean \
    -configuration Release \
    -sdk iphoneos \
    -destination 'generic/platform=iOS' \
    -derivedDataPath ../build-ios-device \
    CODE_SIGNING_ALLOWED=NO CODE_SIGNING_REQUIRED=NO \
    build >/dev/null )

APP=$(find build-ios-device/Build/Products/Release-iphoneos -maxdepth 1 -name "*.app" | head -1)
[ -n "$APP" ] || { echo "No .app was produced."; exit 1; }

echo
echo "Built: $APP"
lipo -info "$APP/$(basename "$APP" .app)"
[ -f "$APP/main.jsbundle" ] && echo "JS bundle: $(du -h "$APP/main.jsbundle" | cut -f1)"

cat <<'NEXT'

This binary is UNSIGNED, so it cannot be installed as-is. To get it onto your
iPhone — free, no developer account:

  1. Connect the iPhone by USB and unlock it. Trust the Mac if asked.
  2. open ios/AMClean.xcworkspace
  3. In Xcode: pick the AMClean target → Signing & Capabilities.
     Tick "Automatically manage signing".
     Team → Add an Account… → sign in with your ordinary Apple ID (free).
     Xcode will pick a "Personal Team" and generate a certificate itself.
  4. Choose your iPhone from the device menu at the top, then press Run (⌘R).
  5. First launch only: on the phone, Settings → General → VPN & Device
     Management → trust the developer certificate.

A free Personal Team profile expires after 7 days — rebuild from Xcode to renew.
That limit, and only that limit, is what the paid programme removes.
NEXT

if [ "${1:-}" = "--open" ]; then open ios/AMClean.xcworkspace; fi
