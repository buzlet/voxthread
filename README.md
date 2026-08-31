<!-- README.md -->
# VoxThread

VoxThread is a userscript-first reader for Telegram Web on Android. It provides continuous, human-friendly TTS playback of chats and groups with per-author voices and minimal spoken UI/service noise.

## Runtime

- Telegram Web K supplies authentication, synchronization and rendered messages.
- A userscript supplies extraction, speech planning, queueing, controls and live-follow.
- `WebSpeechBackend` is the default local TTS provider.
- TTS is a replaceable boundary; a native or remote provider can be added without rewriting Telegram/core logic. Remote TTS would require a separate privacy decision because message text would leave the device.

## Install / update

Production releases publish one stable asset named `voxthread.user.js`:

`https://github.com/buzlet/voxthread/releases/latest/download/voxthread.user.js`

Open that URL in a userscript manager such as Tampermonkey and install it. The production metadata contains the same URL as both `@downloadURL` and `@updateURL`, so subsequent releases can be discovered by the userscript manager.

The production artifact is generated, not committed:

```bash
npm ci
npm run build:userscript
npm run verify:userscript
```

Output: `dist/voxthread.user.js`.

A `vX.Y.Z` tag must match `package.json` version. `.github/workflows/release.yml` runs tests, rebuilds the userscript twice to verify reproducibility, generates a SHA-256 file and publishes both files to the GitHub release.

## Development and tests

GitHub Actions is the primary reproducible development environment:

- `CI` runs Node tests plus deterministic development/production bundle checks.
- `Android emulator regression` runs the API 36 Chrome release gate and saves lifecycle diagnostics.
- `Firefox Android comparison` is an investigation workflow for browser/runtime decisions.

Run the complete emulator-capable gate with:

```bash
npm run test:emulator:all
```

The real Galaxy A57 remains the acceptance target for Samsung-specific power management, calls/audio focus, secure lock-screen behaviour and final Tampermonkey deployment.

## Repository layout

- `src/core/` normalized messages, queue and reader state.
- `src/telegram/` Telegram Web adapters.
- `src/tts/` provider boundary, Web Speech backend, voice selection and chunking.
- `src/ui/` reader controls.
- `src/runtime/` thin userscript composition.
- `tests/fixtures/` captured/synthetic Telegram DOM fixtures.
- `docs/architecture.md` current architecture.
- `docs/backlog.md` tracked work items (`TWR-xxx`).
- `docs/decisions/` architecture decision records.
- `docs/notes/` dated investigation notes.

See `docs/development.md` before running experimental code.
