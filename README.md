# Fieldnote

A free, offline task manager for the web and Android. Your tasks stay on your device. Not affiliated with Doist or Todoist.

Features: Inbox/Today/Upcoming, projects with sections (list or board layout), subtasks, priorities, labels, repeat rules, saved filters (`p1 | overdue`, `!`, `within:7`), quick add (`Call Dana tomorrow 9am p1 #Studio @errand every week`), history, undo, JSON/CSV export, JSON import, dark mode.

## Run
```sh
npm install
npm test
npm run dev        # http://localhost:5173
npm run build      # static site in dist/
```

## Build the Android APK
Needs Node 20+, JDK 21, Android SDK (`ANDROID_HOME`).
```sh
npm run android:apk   # -> android/app/build/outputs/apk/debug/app-debug.apk
```
Or push to GitHub and run the "Build APK" workflow (or push a `v*` tag for a release).

## Notes
Data lives in `localStorage` (key `fieldnote-v2`; v1 data is migrated). Use Settings > Export backup. Reminders work only while the app is open.

MIT licensed. See LICENSE.
