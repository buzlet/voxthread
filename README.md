<!-- README.md -->
# VoxThread

VoxThread is a userscript-first reader for Telegram Web on Android. The goal is continuous, human-friendly TTS playback of chat and group messages with per-author voices and minimal spoken UI/service noise.

## Current target

- Android 16 test device controlled from `u24` through Wireless ADB.
- Telegram Web K as the initial web client.
- Edge Android + Tampermonkey as the primary candidate runtime.
- Firefox Android retained as a comparison/fallback runtime.
- JavaScript core kept browser-agnostic where practical.

## Repository layout

- `src/core/` normalized messages, queue and reader state.
- `src/telegram/` Telegram Web adapters.
- `src/tts/` voice selection and speech engine abstraction.
- `src/ui/` reader controls.
- `tests/fixtures/` captured/synthetic Telegram DOM fixtures.
- `docs/architecture.md` current architecture.
- `docs/backlog.md` tracked work items (`TWR-xxx`).
- `docs/decisions/` architecture decision records.
- `docs/notes/` dated investigation notes.

See `docs/development.md` before running experimental code.
