# Changelog

## 1.2.2 (versionCode 5) — 2026-08-15

- Make calendar sync say why it failed instead of vanishing
- Drop the duplicate work-days picker; derive the days from availability

## 1.2.1 (versionCode 4) — 2026-08-14

- Stop adding a photo destroying the gallery it was added to

## 1.2.0 (versionCode 3) — 2026-08-14

- Move the app's work gallery off the user document, and wire up the viewer
- Fix the client's booking listener, which had never once fired
- Mirror the cleaner service-details card in the app
- Mirror the web app's photo, validation and error-handling work
- Carry the same rules the web repo ships
- Untrack the files a mispasted terminal command created

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
