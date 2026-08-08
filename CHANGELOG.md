# Changelog

## 1.1.0 (versionCode 2) — 2026-08-08

First release to carry a real version. Everything before this shipped as
1.0.0 / versionCode 1, because the numbers were hardcoded in `android/` —
a gitignored directory that `expo prebuild` regenerates — so they were
never reviewed and never moved. The version now lives in `app.json` and
the Gradle build reads it from there.

- Close the last double-booking gap: claiming an open job
- Post a job straight from the client profile (app)
- Free the cleaner's slot when a booking is cancelled
- Name the date as well as the hour when a cleaner is busy
- Sync confirmed bookings to the device calendar

## 1.0.0 (versionCode 1)

Everything up to and including the 2026-08-01 build. Not individually
recorded — see `git log` for the history.
