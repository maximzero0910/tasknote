#!/usr/bin/env bash
# Usage: npm run android:apk            -> android/app/build/outputs/apk/debug/app-debug.apk
#        npm run android:release        -> unsigned release APK (sign it with your own keystore)
# Needs Node 20+, JDK 21 and the Android SDK (ANDROID_HOME set).
set -euo pipefail
cd "$(dirname "$0")/.."
MODE="${1:-debug}"
bash scripts/android-setup.sh
cd android
if [ "$MODE" = "release" ]; then ./gradlew assembleRelease; else ./gradlew assembleDebug; fi
echo "APK files:"; find app/build/outputs/apk -name '*.apk'
