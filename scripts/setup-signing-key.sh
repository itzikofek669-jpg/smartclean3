#!/usr/bin/env bash
#
# Create a private Android signing key and install it as repository secrets.
#
# WHY THIS EXISTS
# ---------------
# Every APK this project has shipped is signed with the debug keystore that
# ships inside `expo-template-bare-minimum` on npm, under the password
# `android`. Verified on builds 186 and 190:
#
#     SHA1: 5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25
#
# Anyone can download that package, take the private key, and build an APK with
# this app's package name. Android accepts a same-signature APK as an in-place
# update, with no uninstall and no warning — and this app is distributed as a
# sideloaded APK, which is exactly that install path. The SHA-1 registered in
# Firebase for Google Sign-In is that public fingerprint too.
#
# ⚠️ ONE-WAY DOOR
# Changing the signing key breaks in-place upgrades. Everyone who already has
# the app installed must uninstall and reinstall — their local data goes with
# it. Do this once, deliberately.
#
# ⚠️ BACK THE KEYSTORE UP
# If you lose it you can never publish an update to the same Play Store
# listing. Keep a copy somewhere that is not this laptop and not this repo.
#
# You are prompted for the password; it is never written to disk in plain text,
# never printed, and never passed through the assistant.

set -euo pipefail

REPO="itzikofek669-jpg/smartclean3"
OUT="$HOME/am-clean-release.keystore"
ALIAS="amclean"

export JAVA_HOME="${JAVA_HOME:-/opt/homebrew/opt/openjdk@21}"
export PATH="$JAVA_HOME/bin:$PATH"

command -v keytool >/dev/null || { echo "keytool not found. Install openjdk@21."; exit 1; }
command -v gh      >/dev/null || { echo "gh not found. Install the GitHub CLI."; exit 1; }

if [ -e "$OUT" ]; then
  echo "$OUT already exists. Refusing to overwrite a signing key — move it aside first."
  exit 1
fi

echo "This creates a new signing key at $OUT and uploads it to $REPO as secrets."
echo "Existing installs will NOT be able to update in place afterwards."
read -r -p "Type 'yes' to continue: " ok
[ "$ok" = "yes" ] || { echo "Cancelled."; exit 1; }

read -r -s -p "Choose a keystore password (min 6 chars): " PASS; echo
read -r -s -p "Confirm: " PASS2; echo
[ "$PASS" = "$PASS2" ] || { echo "Passwords do not match."; exit 1; }
[ ${#PASS} -ge 6 ]     || { echo "Too short."; exit 1; }

keytool -genkeypair -v \
  -keystore "$OUT" \
  -alias "$ALIAS" \
  -keyalg RSA -keysize 4096 -validity 10000 \
  -storepass "$PASS" -keypass "$PASS" \
  -dname "CN=A&M Clean, O=A&M Clean, C=IL"

chmod 600 "$OUT"

echo
echo "─── Fingerprints — register BOTH in Firebase ────────────────────────────"
keytool -list -v -keystore "$OUT" -alias "$ALIAS" -storepass "$PASS" \
  | grep -E 'SHA1:|SHA256:'
echo "─────────────────────────────────────────────────────────────────────────"
echo

SHA1=$(keytool -list -v -keystore "$OUT" -alias "$ALIAS" -storepass "$PASS" \
       | grep -m1 'SHA1:' | awk '{print $NF}')

echo "Uploading secrets to $REPO ..."
base64 < "$OUT" | gh secret set ANDROID_KEYSTORE_BASE64  --repo "$REPO"
printf '%s' "$PASS"  | gh secret set ANDROID_KEYSTORE_PASSWORD --repo "$REPO"
printf '%s' "$ALIAS" | gh secret set ANDROID_KEY_ALIAS         --repo "$REPO"
printf '%s' "$PASS"  | gh secret set ANDROID_KEY_PASSWORD      --repo "$REPO"
gh variable set EXPECTED_SIGNING_SHA1 --repo "$REPO" --body "$SHA1"

unset PASS PASS2

cat <<DONE

Done. Still to do, by hand:

  1. Firebase Console -> Project settings -> your Android app
     https://console.firebase.google.com/project/smartclean1-db1fb/settings/general
     Add the SHA-1 and SHA-256 printed above.
     Remove 5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25 —
     that is the public template key.

  2. Back up $OUT somewhere off this laptop.
     Lose it and you can never update the app on the Play Store.

  3. Build:  gh workflow run build-android.yml --ref main
     The log will print the new fingerprint and check it against
     EXPECTED_SIGNING_SHA1, which this script just set.

  4. Tell anyone with the old APK to uninstall before installing the new one.
     The install will fail with a signature mismatch otherwise.
DONE
