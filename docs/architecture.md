<!-- docs/architecture.md -->
# Architecture

Status: baseline, 2026-09-01.

## Goal

Read Telegram Web conversations as a continuous audio stream suitable for listening with the screen off. Speech should contain message content rather than Telegram UI metadata, and different authors should be distinguishable by voice.

## System boundary

Telegram authentication, synchronization and message rendering remain the responsibility of Telegram Web. The project does not initially implement MTProto or TDLib.

The reader is injected into Telegram Web as a userscript. Browser-specific integration is isolated so that Firefox, Chromium/Edge or another Android runtime can be substituted without changing Telegram/core logic.

## Data flow

`Telegram Web DOM/state -> Telegram adapter -> NormalizedMessage[] -> speech planner -> playback queue -> TTS backend`

The normalized message model and TTS backend are stable boundaries. Telegram selectors, DOM grouping and provider-specific speech APIs must not leak into core queue logic.

## Modules

- `src/telegram/`: discover visible messages, author identity, ordering and incremental DOM changes.
- `src/core/`: normalize messages, merge consecutive messages, filtering and playback state.
- `src/tts/`: provider-neutral TTS boundary, voice policy and provider implementations.
- `src/ui/`: minimal playback controls and reader diagnostics.
- `src/runtime/`: thin composition/integration layer for the userscript runtime.

## Normalized message model

Each message should expose at least: stable message ID, chat ID, author ID/name, text, type, reply metadata, media metadata, timestamp/order key and source element/reference when available.

Core code must tolerate missing author labels caused by Telegram bubble grouping and recover the author through adapter context.

## Speech policy

- Do not speak timestamps, delivery state, reactions or UI labels by default.
- Speak author name only when useful, normally on author change.
- Merge adjacent text messages from the same author when this improves listening flow.
- Skip service messages by default; media handling is policy-driven.
- Map an author deterministically to a compatible provider voice when available.
- Keep voice, rate and pitch policy separate from message extraction.

## TTS provider boundary

The runtime must not call `speechSynthesis`, construct provider utterances, inspect provider-native voice objects or implement provider-specific compatibility rules.

A TTS backend supplies:

- `createPlayer({ queue })`;
- normalized voice discovery through `listVoices(segment?)`;
- optional voice-list change notifications;
- provider-neutral diagnostics.

`WebSpeechBackend` is the default implementation and owns browser Web Speech objects plus `WebSpeechPlayer`. A future native Android or remote backend should replace the composition point rather than change Telegram/core/UI code. See ADR 0003.

Remote TTS remains opt-in architecture work: transmitting Telegram message text off-device requires a separate privacy/security ADR and explicit user configuration.

## Runtime strategy

Firefox Android is the preferred runtime for continuous background/screen-off reading. A reproducible API 36 comparison using the same VoxThread bundle and the same accessibility-targeted real ADB touch showed Firefox 154.0.1 continuing Web Speech through background and screen-off/wake without TTS errors.

Chrome remains a supported fallback and the primary automated regression target because CDP provides substantially better inspection/control. On the same API 36 comparison Chrome reports `interrupted` when backgrounded or the screen is turned off; VoxThread's no-skip recovery retains the current message and resumes it instead of advancing silently.

GitHub Actions is the primary reproducible development/test environment. Core tests use synthetic/captured fixtures and Android regression runs use a clean API 36 x86_64 emulator. A real Galaxy A57 remains the acceptance target for Samsung-specific power management, audio focus, calls, secure lock-screen behaviour and final userscript-manager deployment.

## Background execution

Browser Web Speech is a provider implementation, not an architectural guarantee. Firefox currently gives the best measured browser-only continuity on the generic API 36 target, but Samsung/Android policy may still suspend or interrupt it on real hardware.

If the physical-device acceptance target proves browser Web Speech insufficient, preserve Telegram, normalized/core and queue layers and replace only the TTS backend/runtime composition, preferably with native Android TTS in a foreground service. A remote TTS backend is technically possible through the same boundary but changes privacy properties.

## Security and privacy

- Do not store Telegram credentials, session data, cookies or exported private chat content in Git.
- Test fixtures should be synthetic or explicitly sanitized before commit.
- Prefer local Android/browser TTS; any external TTS backend requires an explicit architecture decision because it receives message text.
- Remote debugging endpoints should remain reachable only through the local ADB/control path.

## Testability

Core modules must run under Node without Telegram or a browser. Browser APIs (`speechSynthesis`, DOM observers, storage, MediaSession) are accessed through thin adapters/backends and can be replaced with fakes in tests.

Captured DOM fixtures are treated as compatibility contracts. When Telegram Web changes, update the Telegram adapter and add a fixture reproducing the breakage.

## Change policy

Every executable experiment is committed before it is run on Android, a browser or CI. Significant architectural choices are recorded under `docs/decisions/`. Work that is not immediately implemented is assigned a `TWR-xxx` identifier in `docs/backlog.md`.
