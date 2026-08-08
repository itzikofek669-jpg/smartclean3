# Releasing the Android app

## Where the version lives

**`app.json` is the source of truth.** Both numbers come from there:

| Field | Becomes |
|---|---|
| `expo.version` | `versionName` — the string users see (`1.1.0`) |
| `expo.android.versionCode` | `versionCode` — the integer Play orders builds by |

Nothing else should carry a version. `android/app/build.gradle` reads
`app.json` at configure time and fails the build if either value is missing,
so the two cannot drift apart.

Check the current version any time:

```bash
npm run version:show
```

## Cutting a release

```bash
npm run version:bump
```

`patch` by default; pass `minor` or `major` for a bigger step
(`npm run version:bump -- minor`). It bumps `app.json`, increments
`versionCode` by exactly one, and prepends a `CHANGELOG.md` entry listing
the commits since the last `v*` tag.

Then commit, tag, and build:

```bash
git add app.json CHANGELOG.md && git commit -m "Release 1.1.1" && git tag v1.1.1
```

```bash
cd android && ./gradlew assembleRelease --no-daemon
```

The APK lands at `android/app/build/outputs/apk/release/app-release.apk`.
Budget 16–48 minutes.

**`versionCode` must never repeat or go backwards.** Play rejects the upload,
and a sideloaded APK with a code equal to or lower than the installed one
gives no update prompt — the install silently appears to do nothing. The bump
script is the only thing that should touch it.

## Why this exists

Every build shipped before 1.1.0 went out as `1.0.0` / `versionCode 1`. The
numbers were hardcoded in `android/app/build.gradle`, and `/android` is
gitignored, so they were invisible to review and nobody noticed they never
moved.

## ⚠️ `android/` is generated, and hand-edited here

`/android` is gitignored — it is meant to be produced by `expo prebuild`.
This project does **not** run prebuild, so the checked-out directory is
maintained by hand and its edits exist only on this machine:

- Calendar permissions (`READ_CALENDAR` / `WRITE_CALENDAR`) in
  `android/app/src/main/AndroidManifest.xml`.
- The `app.json` version reader in `android/app/build.gradle`.

**If anyone ever runs `expo prebuild`, both are wiped — and both come back
on their own**, because `app.json` is the real source for each: the
`expo-calendar` plugin is configured there and re-adds the permissions, and
prebuild writes `versionCode`/`versionName` from `app.json` directly. That is
the whole reason the version belongs in `app.json` and not in Gradle.

After any prebuild, confirm before shipping:

```bash
grep -E "CALENDAR|versionCode|versionName" android/app/src/main/AndroidManifest.xml android/app/build.gradle
```

## Verifying a built APK

Read the version straight out of the APK rather than trusting the build log:

```bash
"$ANDROID_HOME/build-tools/36.0.0/aapt.exe" dump badging android/app/build/outputs/apk/release/app-release.apk | head -1
```
