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

# The Play Store image may start updating Chrome during the regression run.
# That restarts Chrome, drops the DevTools socket and can also re-enable
# first-run feature promos. Freeze the preinstalled browser for this ephemeral
# emulator and pre-grant notifications so Chrome does not place its own
# notification education modal over real-touch tests.
adb shell pm disable-user --user 0 com.android.vending >/dev/null 2>&1 || true
adb shell pm grant com.android.chrome android.permission.POST_NOTIFICATIONS >/dev/null 2>&1 || true
adb shell appops set com.android.chrome POST_NOTIFICATION allow >/dev/null 2>&1 || true

adb shell am set-debug-app --persistent com.android.chrome
adb shell 'echo "chrome --disable-fre --no-default-browser-check --no-first-run --skip_first_run_ui --disable-features=Translate" > /data/local/tmp/chrome-command-line'
adb shell am force-stop com.android.chrome
adb shell am start -n com.android.chrome/com.google.android.apps.chrome.Main
sleep 3

# Dismiss any residual one-shot browser chrome without coordinate taps. BACK
# closes an in-app promo/dialog but leaves the current tab/activity alive.
adb shell input keyevent KEYCODE_BACK >/dev/null 2>&1 || true
sleep 1

npm run test:emulator
npm run test:emulator:lifecycle
npm run test:emulator:live
npm run test:emulator:selection
npm run test:emulator:matrix
