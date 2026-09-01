# Changelog

All notable changes to VoxThread are recorded here.

## [0.7.0] - 2026-09-01

First development baseline suitable for regular Android testing and further product work.

### Added

- Telegram Web message normalization with isolated Telegram adapter and sanitized regression fixtures.
- Continuous playback queue with play, pause, resume, stop, previous, next and start-from-selected-message behaviour.
- Incremental live-follow for newly arriving Telegram messages.
- Deterministic per-author voice mapping, persistent overrides and mobile voice controls.
- Author announcements, adjacent-message merging, configurable pauses and sentence-aware TTS chunking.
- Explicit handling policy for replies, forwards, links, emoji-only messages, media and service messages.
- MediaSession/Bluetooth control support evaluation and integration hooks.
- Replaceable TTS provider boundary through `WebSpeechBackend`; Telegram/core/queue code no longer owns browser-native Web Speech objects.
- Production userscript build with stable `voxthread.user.js` filename, verified update/download metadata and SHA-256 release artifact.
- GitHub Actions CI, API 36 Android Chrome regression gate, lifecycle/no-skip tests, live-follow tests and real-touch selection tests.
- Reproducible Firefox Android 154.0.1 comparison workflow.

### Changed

- Firefox Android is now the preferred browser runtime for continuous background/screen-off reading based on API 36 measurements.
- Chrome remains a supported fallback and the primary CDP-driven automated regression target.
- GitHub Actions is the primary reproducible development environment; `u24` is optional rather than required.

### Reliability

- Web Speech interruptions no longer silently advance the queue: VoxThread keeps the current message and resumes it after recovery.
- Chrome onboarding/Play Store update interference was removed from the Android CI environment.
- Userscript development and production bundles are checked for reproducibility in CI.

### Known limitations

- Final Samsung-specific acceptance remains pending on physical hardware: Doze, secure lock screen, phone-call/audio-focus behaviour and real userscript-manager installation/update.
- Browser Web Speech remains subject to Android/browser lifecycle policy. The TTS backend boundary exists specifically so a native or remote provider can be added without rewriting Telegram/core logic.

