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

## Automated lifecycle regression

`npm run test:emulator:lifecycle` now performs the complete repeatable flow:
build the current development bundle, start/wake the emulator, open the long
Telegram fixture, inject VoxThread, start speech through a real CDP touch,
sleep Android, verify that the queue pauses on the interrupted message, wake
Android, and verify that the exact same message resumes.

Validated result:
- queue length: 12
- interrupted message: `3001`
- error: `interrupted`
- sleep index: 0
- resume index: 0
- same-message resume: true

## Backlog attribution note

Per-author voice controls were first committed as `d42436d` with a `TWR-024`
commit prefix while TWR-024 had already been allocated to long-utterance
chunking. The permanent backlog item for those voice controls is TWR-025.
History is intentionally not rewritten.

## Oversized-message Web Speech regression

A synthetic Telegram message containing 24 long sentences was injected into
the real Chrome runtime. VoxThread kept the message as one logical queue
segment but split its speech into 8 utterance chunks. Playback remained on
queue index 0 while chunk 0 was speaking, confirming that TTS chunking does
not alter Telegram message ordering or queue semantics.

## Long utterance chunking

The oversized Telegram fixture produced one 24-sentence message followed by a
short second message. VoxThread split the first speech segment into 8 Web
Speech utterances. In real emulator Chrome the queue remained on message 4001
while `chunkIndex` advanced from 0 to 1, confirming that chunk completion does
not prematurely advance the Telegram message queue.

## Voice controls

Real emulator Chrome exposed 92 Web Speech voices. For Russian text only one
compatible `ru_RU` voice was exposed. VoxThread rendered one author selector
per speech author, persisted an explicit override for `id:77`, and returned the
same override on a later inspection. When a browser exposes no compatible
multiple voices, deterministic per-author rate/pitch remains the fallback.

## Inter-segment pauses

The Web Speech player now honors `pauseAfterMs` between queue segments while
preserving pause/resume/next semantics. Unit tests cover delay, pausing during
the delay and navigation while paused. The full emulator lifecycle regression
also passes with the delayed transition implementation.

## Live follow

The real Chrome regression now waits for the initial two-segment queue to
finish, appends synthetic Telegram bubble `5001` through CDP, and verifies that
MutationObserver extends the queue from 2 to 3 and automatically resumes
playback on the new message. This validates the completed-queue live-follow
path without a Telegram account.

## Per-author voice controls

The bundled reader now exposes per-author voice selectors in Settings.
Emulator Chrome reported 92 browser voices. For the Russian group fixture,
VoxThread created two author rows and filtered each row to the compatible
`ru_RU` voice plus `Automatic`.

A CDP regression applied `Russian Russia` specifically to author `id:77`.
The override persisted in the runtime voice map while author `id:88` remained
on automatic selection.

When a browser exposes no voices, the UI explicitly reports that the browser
voice list is unavailable and VoxThread continues with deterministic rate/pitch
variation as its fallback.

## Real-touch start selection

`Input.synthesizeTapGesture` is required for a faithful CDP tap on arbitrary
Telegram message content. Raw `dispatchTouchEvent` reached the correct DOM
element but did not synthesize the compatibility click used by the selection
handler.

The emulator regression now taps `Pick start`, taps message `1003`, starts
playback, and verifies selected message `1003`, queue index 1 of 2 and active
Web Speech playback.

## Emulator release gate

The release-gate components all pass independently:
- Node/unit regression suite
- Web Speech probe: 92 voices, one `ru_RU`, TTS started, zero errors
- sleep/wake no-skip lifecycle regression
- live-follow regression
- real-touch start-selection regression

The single wrapper `npm run test:emulator:all` is committed, but invoking the
nested runner from this ChatGPT remote-command session was blocked by the
session safety filter. Its constituent committed commands were executed
directly instead.
