#!/usr/bin/env bash
# scripts/ci-android-emulator.sh
set -euo pipefail

mkdir -p artifacts

collect_diagnostics() {
  timeout 8s adb devices -l > artifacts/adb-devices.txt 2>&1 || true
  timeout 8s adb logcat -d > artifacts/logcat.txt 2>&1 || true
  timeout 8s adb shell dumpsys power > artifacts/dumpsys-power.txt 2>&1 || true
  timeout 8s adb exec-out screencap -p > artifacts/emulator.png 2>/dev/null || true
}

trap collect_diagnostics EXIT

adb shell pm list packages | grep -q '^package:com.android.chrome$'
adb shell am set-debug-app --persistent com.android.chrome
adb shell 'echo "chrome --disable-fre --no-default-browser-check --no-first-run --skip_first_run_ui" > /data/local/tmp/chrome-command-line'
adb shell am force-stop com.android.chrome
adb shell am start -n com.android.chrome/com.google.android.apps.chrome.Main
sleep 3

npm run test:emulator
npm run test:emulator:lifecycle
npm run test:emulator:live
npm run test:emulator:selection
