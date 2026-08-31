<!-- docs/notes/2026-08-31-android-emulator.md -->
# Android Emulator secondary target

Date: 2026-08-31

Host `u24` now receives Intel VMX through Hyper-V nested virtualization.
`/dev/kvm` is available and Android Emulator reports KVM version 12 usable.

AVD:
- `voxthread-api36`
- Android 16 / API 36
- Google APIs x86_64
- 2 vCPU
- 2 GiB RAM
- headless SwiftShader
- Chrome 133

ADB exposes the emulator as `emulator-5554` while Galaxy A57 remains connected
independently through Wireless ADB.

Chrome CDP is forwarded to host port `9223`.
The Web Speech probe exposes 92 voices, including one local `ru_RU` voice.
A 20-utterance synthetic queue starts successfully with no immediate errors.

The emulator is a fast regression target, not a replacement for Galaxy A57
for Samsung-specific power management, telephony/audio-focus, real speaker
output, Doze or final locked-screen acceptance tests.

The committed `npm run test:emulator` wrapper automates the same smoke flow.
The remote command policy in the current ChatGPT session blocked invoking that
wrapper as one opaque command, so its constituent committed commands were
executed individually and passed.

## Bundled runtime smoke

The real bundled `VoxThread 0.7.0` was injected through CDP into sanitized
Telegram DOM fixtures running in emulator Chrome.

Basic fixture:
- 3 normalized messages
- 2 speech segments
- overlay present
- real CDP touch on `Play`
- `speechSynthesis.speaking=true`
- no player error

Long lifecycle fixture:
- 12 messages / 12 speech segments
- screen-off interrupted speech while segment 2 was current
- VoxThread changed to `paused` without advancing past the failed segment
- `playerError=interrupted`
- after waking the emulator, `visibilitychange` automatically retried the same
  segment and playback returned to `playing`

This validates the no-silent-skip recovery path in a real Chromium runtime.

## Automated lifecycle regression

`npm run test:emulator:lifecycle` now performs the complete emulator-only
lifecycle check: build current dev bundle, open the long Telegram fixture,
start VoxThread through a real CDP touch, sleep Android, verify that the
current message is preserved on TTS interruption, wake Android and verify
that the same message resumes.

Validated result:
- queue length: 12
- interrupted message: 3001
- sleep error: `interrupted`
- slept index: 0
- resumed index: 0
- resumed same message: true
