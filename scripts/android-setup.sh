#!/usr/bin/env bash
# Creates the native Android project (android/) and generates icons. Needs Node 20+ and JDK 21.
set -euo pipefail
cd "$(dirname "$0")/.."
npm install
npm run build
[ -d android ] || npx cap add android
npx capacitor-assets generate --android --iconBackgroundColor '#c24d2c' --splashBackgroundColor '#f3eee6' --splashBackgroundColorDark '#141311' || echo "icon generation skipped"
npx cap sync android
