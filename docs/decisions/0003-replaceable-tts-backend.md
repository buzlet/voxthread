<!-- docs/decisions/0003-replaceable-tts-backend.md -->
# ADR 0003: Replaceable TTS provider boundary

- Status: Accepted
- Date: 2026-09-01

## Context

VoxThread currently uses browser Web Speech because it is local, requires no
credentials and is immediately available to the userscript. Browser lifecycle
or platform limitations may nevertheless make local Web Speech unsuitable on
some Android devices. A future native or remote TTS provider must not require
changes throughout the Telegram adapter, core queue, UI and lifecycle code.

Provider-specific voice enumeration had leaked into `userscript-main.mjs`, so
simply replacing `WebSpeechPlayer` was not enough: the UI and diagnostics still
knew about `window.speechSynthesis`, `SpeechSynthesisUtterance` and browser
voice objects.

## Decision

All provider-specific speech capabilities are owned by a TTS backend under
`src/tts/`.

The runtime consumes a narrow provider surface:

- `createPlayer({ queue })` returns playback controls bound to the core queue;
- `listVoices(segment?)` returns normalized provider-neutral voice descriptors;
- `onVoicesChanged(listener)` exposes optional capability changes;
- `diagnostics(player)` returns provider-neutral runtime state plus a provider
  identifier.

`WebSpeechBackend` is the default implementation and is the only application
component that receives browser Web Speech objects. Voice compatibility,
provider-native voice objects and Web Speech event wiring remain behind this
boundary.

Persistent author-to-voice overrides intentionally remain application data.
The backend receives the override map and resolves provider-specific voice IDs.
A future provider may reuse the same logical override mechanism while storing
different provider IDs.

## Consequences

- A native Android or remote TTS implementation can replace the backend at the
  composition point without changing Telegram extraction, speech planning or
  playback queue semantics.
- Remote TTS is not enabled by this ADR. Any backend that transmits message text
  off-device still requires a separate privacy/security decision and explicit
  configuration.
- The runtime may display normalized voice names/languages but must not inspect
  browser `SpeechSynthesisVoice` objects or call Web Speech APIs directly.
- Provider implementations must preserve queue safety semantics, especially the
  no-skip rule when playback is interrupted.
