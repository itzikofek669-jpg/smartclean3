#!/usr/bin/env bash
#
# Build A&M Clean for a real iPhone.
#
# The CI job compiles for the simulator, and a simulator slice cannot be
# installed on a physical device at any price — different architecture. This
# builds the arm64 binary that can.
#
# ── SIGNING: read this before believing anything about "free" ───────────────
#
# For most apps a free Apple ID signs a build for your own device. NOT this one.
# It carries the Push Notifications entitlement (ios/AMClean/AMClean.entitlements,
# `aps-environment`), and Apple does not offer that capability to the free tier.
# Verified in Xcode's own capability database:
#
#   APP_GROUPS          validTeamTypes = [..., XCODE_FREE_PROGRAM]
#   HEALTHKIT           validTeamTypes = [..., XCODE_FREE_PROGRAM]
#   PUSH_NOTIFICATIONS  validTeamTypes = [ENTERPRISE, DEVELOPER, UNIVERSITY]   <-- no free
#
# So there are two honest paths:
#
#   --no-push   Strips the entitlement so a FREE Apple ID can sign it. Everything
#               works on the phone EXCEPT push notifications — and therefore also
#               except the background calendar cleanup, which is triggered by a
#               push. Good for checking screens, booking flow, maps, calendar
#               writes. Costs nothing.
#
#   (default)   Keeps push. Needs the $99/year Apple Developer Program, which is
#               required for the App Store anyway.
#
#   bash scripts/ios-device-build.sh            # compile with push, unsigned
#   bash scripts/ios-device-build.sh --no-push  # compile without push (free signing)
#   bash scripts/ios-device-build.sh --open     # ... and open Xcode afterwards
#
# Xcode does the signing either way, because only it can talk to your Apple ID.

set -euo pipefail
cd "$(dirname "$0")/.."

export LANG=en_US.UTF-8
export LC_ALL=en_US.UTF-8

command -v xcodebuild >/dev/null || { echo "Xcode is not installed."; exit 1; }

NO_PUSH=0
OPEN_XCODE=0
for arg in "$@"; do
  case "$arg" in
    --no-push) NO_PUSH=1 ;;
    --open)    OPEN_XCODE=1 ;;
    *) echo "Unknown option: $arg"; exit 1 ;;
  esac
done
export NO_PUSH

# `ios/` is gitignored and generated, so it can be stale — this one was four
# months old and predated expo-task-manager entirely.
#
# Without --clean this does NOT wipe the folder: a signing team you set in Xcode
# survives, because withDevelopmentTeam is a no-op when ios.appleTeamId is unset.
# What IS rewritten every run is Info.plist, the entitlements and
# AppDelegate.swift — so hand edits to those do not survive, by design.
echo "→ Regenerating the native project from app.json…"
EXPO_NO_GIT_STATUS=1 npx expo prebuild --platform ios --no-install >/dev/null

if [ "${NO_PUSH:-0}" = "1" ]; then
  # A free Apple ID cannot sign an app that asks for push. Removing the
  # entitlement is what makes free signing possible, and it is why push and the
  # background calendar cleanup will not work in this build.
  echo "→ Removing the push entitlement so a free Apple ID can sign…"
  cat > ios/AMClean/AMClean.entitlements <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
  <dict/>
</plist>
PLIST
fi

echo "→ Installing pods…"
# stdout only. This is the step most likely to fail — it is the react-native-maps
# podspec break the whole iOS CI job exists to guard — and swallowing stderr left
# it exiting with no reason printed at all.
( cd ios && pod install >/dev/null )

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

BIN="$APP/$(basename "$APP" .app)"

# `platform 2` is iOS; a simulator build reports 7. lipo alone cannot tell them
# apart — an arm64 simulator slice prints exactly the same "Non-fat file: arm64".
PLATFORM=$(otool -l "$BIN" | awk '/LC_BUILD_VERSION/{f=1} f&&/platform/{print $2; exit}')
[ "$PLATFORM" = "2" ] || { echo "Built for platform $PLATFORM, not iOS device (2). Refusing to call this a device build."; exit 1; }

# An app without its bundle launches to a white screen. Assert, do not mention.
[ -f "$APP/main.jsbundle" ] || { echo "main.jsbundle is missing — this app would have no JavaScript."; exit 1; }

echo
echo "Built: $APP"
lipo -info "$BIN"
echo "iOS device build confirmed (LC_BUILD_VERSION platform 2)"
echo "JS bundle: $(du -h "$APP/main.jsbundle" | cut -f1)"

cat <<'NEXT'

This binary is UNSIGNED, so it cannot be installed as-is. To get it onto your
iPhone:

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

If step 3 fails with a push/entitlement error, that is the free tier refusing
the Push Notifications capability. Re-run with --no-push to strip it, or join
the Apple Developer Program ($99/year), which you need for the App Store anyway.
NEXT

if [ "$OPEN_XCODE" = "1" ]; then open ios/AMClean.xcworkspace; fi
