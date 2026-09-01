<!-- docs/architecture.md -->
# Architecture

Status: baseline, 2026-09-01.

## Goal

Read Telegram Web conversations as a continuous audio stream suitable for listening with the screen off. Speech should contain message content rather than Telegram UI metadata, and different authors should be distinguishable by voice.

## System boundary

Telegram authentication, synchronization and message rendering remain the responsibility of Telegram Web. The project does not initially implement MTProto or TDLib.

The reader is injected into Telegram Web as a userscript. Browser-specific integration is isolated so that Firefox, Chromium/Edge or another Android runtime can be substituted without changing Telegram/core logic.

## Data flow

`Telegram Web DOM/state -> Telegram adapter -> NormalizedMessage -> bounded message cache -> speech planner -> playback queue -> TTS backend`

The normalized message model and TTS backend are stable boundaries. Telegram selectors, DOM grouping and provider-specific speech APIs must not leak into core queue logic.

## Modules

- `src/telegram/`: visible/incremental message discovery, author context and structured Telegram entity extraction.
- `src/core/`: normalized messages, bounded RAM cache, speech/read state, queueing, message ordering, read cursors, text policy and privacy-safe diagnostics.
- `src/tts/`: provider-neutral TTS API v2, sentence chunking, voice/language policy and provider implementations.
- `src/ui/`: minimal playback controls and reader diagnostics.
- `src/runtime/`: thin composition/integration layer for the userscript runtime.

## Telegram ingestion and virtualization

Telegram Web virtualizes chat history, so DOM presence is not message lifetime.

The Telegram adapter keeps an explicit `TelegramAuthorContext` across scans. A leading grouped `.hide-name` bubble can therefore inherit the previous inbound author even when Telegram has already removed that previous bubble from the DOM. Outgoing/service boundaries clear inherited inbound-author state.

`TelegramMessageObserver` processes affected/added nodes incrementally instead of rescanning every bubble after every mutation. Periodic reconciliation remains as recovery for mutations that do not expose the expected added-node path.

Observer deduplication is bounded using a recent window plus a larger bounded history window. Runtime live-follow additionally compares timestamp and numeric Telegram message ID against the latest queued message, so old virtualized history cannot become new speech merely because its dedup entry was eventually evicted. DOM `removedNodes` never imply Telegram deletion; only explicit deletion/tombstone state does.

## Normalized message model

Each message exposes stable message ID, chat ID, author ID/name, text, type, reply metadata, media metadata, structured speech entities, timestamp/order key and source element/reference when available.

Structured speech entities may include links, mentions, hashtags, code/pre blocks, spoilers and quotes. Where the DOM permits it, the adapter records which occurrence of repeated text corresponds to the entity so later policy applies only to the marked content.

Core code tolerates missing author labels caused by Telegram bubble grouping and recovers the author through adapter context.

## Normalized-message cache

VoxThread keeps a bounded in-memory cache of normalized messages per chat. The cache exists so queue rebuilds, edits/deletions and virtualized-history transitions do not require the original Telegram bubble to remain alive.

Current defaults are 1200 messages per chat and 12 chats. Eviction is based on the recently observed working set. Cached messages are normalized copies with `source: null`, preventing detached Telegram DOM subtrees from being retained through the cache.

The cache is RAM-only and cleared on `pagehide`. Message text is not written to `localStorage`, IndexedDB or GitHub diagnostics. A real Chrome/API 36 regression removes a Telegram bubble from the DOM and verifies that the cached normalized message remains available to a rebuilt queue.

An empty/transitioning active chat never guesses its identity from the previous queue. Cached data for older chats may remain in RAM, but it is not made active without current chat evidence.

## Read cursor

VoxThread persists a small per-chat read cursor, not message content. The cursor records only chat/message identifiers, whether playback should resume `at` the message or `after` a fully completed message, and an update timestamp.

An interrupted/current segment is stored as `at`, so a restart repeats rather than silently skips it. A fully completed final segment is stored as `after`, allowing a later run to begin with the first newly available message. Cursor persistence is separate from the RAM-only normalized-message cache.

## Speech text pipeline

The current speech-text path is:

`structured Telegram entities -> Telegram-aware normalization -> sentence segmentation -> Telegram boundary correction -> hard max-length wrapping`

The normalizer owns speech policy for URLs, mentions, hashtags, code/pre blocks, spoilers and quotes. Structured entity policy targets the exact DOM-derived occurrence rather than globally replacing matching text elsewhere in a message. Plain-text fallback still recognizes common URLs, mentions and hashtags when Telegram structure is unavailable.

`Intl.Segmenter(..., { granularity: 'sentence' })` is used when available, but is not trusted as a Telegram parser. Its output passes through corrections for common messenger abbreviations, initials and domain boundaries before the existing hard-length wrapper. A deterministic regex fallback is retained for runtimes without Segmenter.

## Speech policy

- Do not speak timestamps, delivery state, reactions or UI labels by default.
- Speak author name only when useful, normally on author change.
- Merge adjacent text messages from the same author when this improves listening flow.
- Closing quotes, brackets, emoji and locale punctuation count as valid terminal punctuation when messages are merged.
- Skip service messages by default; media handling is policy-driven.
- Keep voice, rate, pitch and language policy separate from message extraction.

## Language and voice policy

Language inference uses script proportions rather than a single Cyrillic/Latin presence check. URL/mention noise and isolated short Latin brands are discounted, and short/ambiguous text can inherit a configured preference instead of forcing a voice switch.

Language preference precedence is manual author override, author preference, chat preference, then automatic detection/default. These preferences may persist, but message text does not.

Authors map deterministically to a compatible provider voice when available, with stable prosody fallback when provider voice choice is limited.

## Playback queue and edits/deletions

The provider-neutral queue remains an array of planned speech segments and maintains an internal `messageId -> segment/index` lookup for efficient reconciliation.

A same-ID Telegram edit updates the RAM cache and locally replans the affected pending segment. An explicit deletion tombstone removes the cached message and replans/removes only the affected pending segment. The actively speaking/paused segment and already-completed history are never rewritten, preventing edit events from causing skips or replay of consumed speech.

## TTS provider boundary

The runtime must not call `speechSynthesis`, construct provider utterances, inspect provider-native voice objects or implement provider-specific compatibility rules.

TTS backend API v2 supplies:

- `apiVersion` and normalized `getCapabilities()` metadata;
- `createPlayer({ queue })`;
- normalized voice discovery through `listVoices(segment?)`;
- optional voice-list change notifications;
- provider-neutral diagnostics.

Capabilities describe provider/execution type, network requirements, background expectations, voice selection, pause/resume, streaming, word-boundary support and provider text limits. Provider-native voice objects never leave the backend.

`WebSpeechBackend` is the default implementation and owns browser Web Speech objects plus `WebSpeechPlayer`. A future native Android or remote backend should replace the composition point rather than change Telegram/core/UI code. See ADR 0003.

Remote TTS remains opt-in architecture work: transmitting Telegram message text off-device requires a separate privacy/security ADR and explicit user configuration.

## Diagnostics

Shareable diagnostics are constructed from an explicit whitelist. They include VoxThread version, browser family/major version, adapter aggregate state, queue state, read-cursor counts, bounded-cache counts, TTS API/capabilities/state, voice counts, safe preferences and page visibility.

The diagnostic export must not contain message text, chat/message/author identifiers, Telegram URLs or arbitrary provider error strings. Known TTS error codes may be exported; unknown free-form errors collapse to `provider-error`.

## Runtime strategy

Firefox Android is the preferred browser runtime for continuous background/screen-off reading. A reproducible API 36 comparison using the same VoxThread bundle and accessibility-targeted real ADB touch showed Firefox 154.0.1 continuing Web Speech through background and screen-off/wake without TTS errors.

Chrome remains a supported fallback and the primary automated regression target because CDP provides substantially better inspection/control. On API 36 Chrome reports `interrupted` when backgrounded or the screen is turned off; VoxThread's no-skip recovery retains the current message and resumes it instead of advancing silently.

GitHub Actions is the primary reproducible development/test environment. Pure ES modules can additionally be mirrored into the ChatGPT sandbox for fast dependency-free Node tests when network access is unavailable. A real Galaxy A57 remains the acceptance target for Samsung-specific power management, audio focus, calls, secure lock-screen behaviour and final userscript-manager deployment.

## Background execution and media playback

Browser Web Speech is a provider implementation, not an architectural guarantee. Firefox currently gives the best measured browser-only continuity on the generic API 36 target, but Samsung/Android policy may still suspend or interrupt it on real hardware.

A controlled Chrome/API 36 experiment compared no media anchor, looping silent media and looping audible 440 Hz media. The media element continued advancing in background/screen-off cases, but Web Speech still reported `interrupted` while VoxThread preserved the same message. Audible or silent media must therefore not be used as a background-TTS keepalive assumption. MediaSession/media playback remain useful for lock-screen/Bluetooth controls as a separate concern.

If physical-device acceptance proves browser Web Speech insufficient, preserve Telegram, normalized/core and queue layers and replace only the TTS backend/runtime composition, preferably with native Android TTS in a foreground service. A remote TTS backend is technically possible through the same boundary but changes privacy properties.

## Security and privacy

- Do not store Telegram credentials, session data, cookies or exported private chat content in Git.
- Test fixtures should be synthetic or explicitly sanitized before commit.
- Persistent read cursors contain identifiers/position metadata only, never message text.
- The normalized-message cache is bounded, RAM-only and detaches DOM references.
- Shareable diagnostics are whitelist-built and must not expose Telegram identifiers or content.
- Prefer local Android/browser TTS; any external TTS backend requires an explicit architecture decision because it receives message text.
- Remote debugging endpoints should remain reachable only through the local ADB/control path.

## Testability

Core modules run under Node without Telegram or a browser. Browser APIs (`speechSynthesis`, DOM observers, storage, MediaSession) are accessed through thin adapters/backends and can be replaced with fakes in tests.

Captured DOM fixtures are compatibility contracts. Regressions cover persistent author context, bounded observer dedup, edit/deletion reconciliation, Telegram entity occurrence policy, Segmenter boundary repair, mixed-language selection and live-follow message ordering. Real Chrome/API 36 regressions additionally cover read-cursor reload behavior and normalized-message survival after a virtualized bubble is removed from the DOM.

## Change policy

Every executable experiment is committed before it is run on Android, a browser or CI. Significant architectural choices are recorded under `docs/decisions/`. Work that is not immediately implemented is assigned a permanent `TWR-xxx` identifier in `docs/backlog.md`.
