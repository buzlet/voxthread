<!-- docs/notes/2026-09-01-firefox-android-comparison.md -->
# Firefox Android lifecycle comparison

Measured on GitHub-hosted Ubuntu 24.04 with an Android 16 / API 36 x86_64 Google Play emulator. Firefox Android 154.0.1 x86_64 was compared with the image's Chrome using the same VoxThread development bundle and the same synthetic Telegram fixture.

The start of speech was deliberately initiated through an ADB-generated real touch on an accessibility-located full-screen button. This avoids comparing different browser autoplay/user-gesture policies.

## Result

| Browser | Foreground | Background / Home | Screen off + wake |
|---|---|---|---|
| Chrome | Web Speech continues, no error | `interrupted`; VoxThread keeps the current message and recovers | `interrupted`; VoxThread keeps the current message and recovers |
| Firefox 154.0.1 | Web Speech continues, no error | Web Speech continues, no TTS error | Web Speech continues, no TTS error |

In every successful scenario both browsers exposed `speechSynthesis` and `SpeechSynthesisUtterance`, the VoxThread backend reported `provider: web-speech`, and playback entered `playing` after the same real-touch gesture.

Chrome's interruption does not silently skip content because `WebSpeechPlayer` pauses the queue on runtime errors and resumes the same message. That is a recovery mechanism, not continuous background speech.

Firefox therefore becomes the preferred Android browser runtime when background/screen-off continuity is required. Chromium remains a supported fallback and regression target because its CDP automation is stronger and its failure/recovery path is useful to test.

This result is generic Android/API 36 evidence. Samsung-specific Doze, lock-screen policy, phone-call/audio-focus behaviour and Tampermonkey installation/update still require the physical Galaxy acceptance target; those are tracked separately rather than blocking completion of the browser/runtime implementation.

Evidence: GitHub Actions `Firefox Android comparison` run 33450944630, artifact `firefox-android-comparison-33450944630`.