<!-- docs/architecture.md -->
# Architecture

Status: baseline, 2026-08-31.

## Goal

Read Telegram Web conversations as a continuous audio stream suitable for listening with the screen off. Speech should contain message content rather than Telegram UI metadata, and different authors should be distinguishable by voice.

## System boundary

Telegram authentication, synchronization and message rendering remain the responsibility of Telegram Web. The project does not initially implement MTProto or TDLib.

The reader is injected into Telegram Web as a userscript. Browser-specific integration is isolated so that Edge/Tampermonkey can be replaced if Android background behaviour proves unsuitable.

## Data flow

`Telegram Web DOM/state -> Telegram adapter -> NormalizedMessage[] -> speech planner -> speech queue -> TTS engine`

The normalized message model is the stable boundary. Telegram selectors, DOM grouping and browser APIs must not leak into core queue logic.

## Modules

- `src/telegram/`: discover visible messages, author identity, ordering and incremental DOM changes.
- `src/core/`: normalize messages, merge consecutive messages, filtering and playback state.
- `src/tts/`: voice discovery, deterministic author-to-voice mapping and speech execution.
- `src/ui/`: minimal playback controls and reader diagnostics.

## Normalized message model

Each message should expose at least: stable message ID, chat ID, author ID/name, text, type, reply metadata, media metadata, timestamp/order key and source element/reference when available.

Core code must tolerate missing author labels caused by Telegram bubble grouping and recover the author through adapter context.

## Speech policy

- Do not speak timestamps, delivery state, reactions or UI labels by default.
- Speak author name only when useful, normally on author change.
- Merge adjacent text messages from the same author when this improves listening flow.
- Skip service messages by default; media handling is policy-driven.
- Map an author deterministically to a compatible installed voice.
- Keep voice, rate and pitch policy separate from message extraction.

## Runtime strategy

Primary candidate: Edge Android + Tampermonkey. Firefox Android remains a required comparison target until locked-screen/background TTS behaviour is measured on-device.

Desktop/CI tests use synthetic and captured fixtures. Android tests use Wireless ADB from `u24`; CDP/WebDriver is preferred over coordinate-driven UI automation whenever available.

## Background execution

Browser `speechSynthesis` is an experiment, not an architectural guarantee. If Android suspends queued speech while locked, preserve the normalized/core layers and replace only the runtime/TTS boundary, potentially with native Android foreground-service TTS.

## Security and privacy

- Do not store Telegram credentials, session data, cookies or exported private chat content in Git.
- Test fixtures should be synthetic or explicitly sanitized before commit.
- Prefer local Android/browser TTS; any external TTS backend requires an explicit architecture decision because it receives message text.
- Remote debugging endpoints should remain reachable only through the local ADB/control path.

## Testability

Core modules must run under Node without Telegram or a browser. Browser APIs (`speechSynthesis`, DOM observers, storage, MediaSession) are accessed through thin adapters and can be replaced with fakes in tests.

Captured DOM fixtures are treated as compatibility contracts. When Telegram Web changes, update the Telegram adapter and add a fixture reproducing the breakage.

## Change policy

Every executable experiment is committed before it is run on `u24` or Android. Significant architectural choices are recorded under `docs/decisions/`. Work that is not immediately implemented is assigned a `TWR-xxx` identifier in `docs/backlog.md`.
