<!-- docs/backlog.md -->
# Backlog

Identifiers are permanent. Do not renumber deleted/completed items. Commit messages implementing a tracked item should start with its ID, for example `TWR-004: normalize Telegram messages`.

Status values: `TODO`, `DOING`, `BLOCKED`, `DONE`, `DROPPED`.

| ID | Status | Priority | Task |
|---|---|---:|---|
| TWR-001 | DONE | P0 | Install/prepare Edge Android + Tampermonkey on the test device and verify userscript injection on Telegram Web K. |
| TWR-002 | DONE | P0 | Establish repeatable remote debugging of Edge Android from `u24` through Wireless ADB/CDP. |
| TWR-003 | DONE | P0 | Build a diagnostic TTS userscript: enumerate voices and exercise a long queued `speechSynthesis` sequence. |
| TWR-004 | DONE | P0 | Measure generic Android TTS behaviour foreground, background, screen-off and lock-like/keyguard transitions; record exact failure modes and no-skip recovery. |
| TWR-005 | DONE | P0 | Inspect Telegram Web K message DOM/state and capture sanitized fixtures for private/group chats. |
| TWR-006 | DONE | P0 | Define and implement the normalized message model and Telegram adapter boundary. |
| TWR-007 | DONE | P1 | Implement deterministic author-to-voice mapping with language compatibility and persistent overrides. |
| TWR-008 | DONE | P1 | Implement speech planning: author-change announcements, merging, filtering and pauses. |
| TWR-009 | DONE | P1 | Implement playback queue with play/pause/resume/stop/previous/next semantics. |
| TWR-010 | DONE | P1 | Add incremental message discovery using MutationObserver and virtualized-history scrolling. |
| TWR-011 | DONE | P1 | Add minimal overlay UI and start-reading-from-selected-message interaction. |
| TWR-012 | DONE | P1 | Define policy for replies, forwards, links, emoji-only messages, media and Telegram service messages. |
| TWR-013 | DONE | P1 | Add Node unit tests and browser fixture/regression tests. |
| TWR-014 | DONE | P1 | Compare the same reader on Firefox Android and document background/TTS differences. Firefox 154.0.1 on API 36 is preferred for background/screen-off continuity; Chrome remains a supported fallback/regression target. |
| TWR-015 | DONE | P2 | Evaluate MediaSession/Bluetooth headset controls for playback. |
| TWR-016 | DONE | P2 | Build reproducible userscript bundling/install/update workflow with stable production artifact, metadata verification and release SHA-256. |
| TWR-017 | DONE | P2 | Select and apply the final public project/repository name: VoxThread; update paths, README and future GitHub remote metadata consistently. |
| TWR-018 | DONE | P0 | Verify the first end-to-end path from visible Telegram message extraction to speaking the actual message text through TTS. |
| TWR-019 | DONE | P1 | Add an Android Emulator as a secondary fast test target on `u24` with KVM, Chrome/CDP and reproducible launch helpers. |
| TWR-020 | DONE | P0 | Preserve the current message on Web Speech runtime errors so sleep/audio-focus failures cannot silently skip unread content. |
| TWR-021 | DONE | P1 | Add a real-Chrome emulator smoke test for the bundled VoxThread runtime against sanitized Telegram DOM fixtures. |
| TWR-022 | DONE | P1 | Add persistent reader preferences and compact mobile UI controls that can be fully tested on emulator Chrome. |
| TWR-023 | DONE | P1 | Automate emulator lifecycle regression: build, inject, play, sleep, verify no-skip recovery, wake and resume. |
| TWR-024 | DONE | P0 | Add sentence-aware TTS chunking so long or merged Telegram messages do not depend on one oversized Web Speech utterance. |
| TWR-025 | DONE | P1 | Add emulator-testable per-author voice controls and clearly expose browser voice capability/fallback state. |
| TWR-026 | DONE | P1 | Honor configured pauses between speech segments without breaking pause/resume/next semantics. |
| TWR-027 | DONE | P1 | Validate live-follow in real emulator Chrome: append a new Telegram bubble after queue completion and verify automatic queue extension/resume. |
| TWR-028 | DONE | P1 | Validate real-touch Pick start interaction in emulator Chrome and verify playback starts from the selected Telegram message. |
| TWR-029 | DONE | P1 | Add one-command emulator release gate covering unit, Web Speech, lifecycle, live-follow and real-touch selection regressions. |
| TWR-030 | DONE | P0 | Isolate TTS behind a replaceable backend boundary so browser Web Speech can be replaced by remote/native speech without changes to Telegram, planner or queue layers. |
| TWR-031 | BLOCKED | P0 | Final physical Galaxy acceptance: Samsung lock screen/Doze, phone-call and audio-focus behaviour, and real Tampermonkey install/update verification. Requires the physical device and is not a software-development blocker. |
| TWR-032 | DONE | P0 | Persist a per-chat read cursor and resume position so VoxThread can continue from the interrupted message or begin after the last completed message; verified across a real Chrome/API 36 page reload. |
| TWR-033 | DONE | P0 | Evolve the TTS backend contract to API v2 with provider-neutral capabilities and no provider-native objects leaking through the public interface. |
| TWR-034 | DONE | P1 | Add privacy-safe self-diagnostics/export covering version, runtime, adapter state, TTS capabilities/errors and playback queue state without message text or Telegram identifiers. |
| TWR-035 | TODO | P0 | Make Telegram author recovery resilient to virtualized-history boundaries: persist adapter author context across scans so a leading `.hide-name` bubble can inherit the correct author even when the preceding bubble has been virtualized out of the DOM. Add regression fixtures for this case. |
| TWR-036 | TODO | P0 | Replace full `querySelectorAll('.bubble[data-mid]')` rescans on every MutationObserver callback with incremental `addedNodes` processing plus periodic/recovery reconciliation. Preserve ordering, deduplication and live-follow semantics under bursty DOM mutations. |
| TWR-037 | TODO | P1 | Bound Telegram observer deduplication memory: replace the unbounded `#seen` Set with an eviction/window strategy keyed by chat/message ID while ensuring virtualized bubbles that re-enter the DOM are not re-spoken. |
| TWR-038 | TODO | P1 | Handle Telegram message edits and deletions after queue planning. Keep the segment array/provider-neutral queue model, add efficient `messageId -> segment/index` lookup, and locally re-plan/update/remove affected pending segments without converting the queue to a linked MessageID chain. |
| TWR-039 | TODO | P1 | Improve speech text joining so closing quotes, brackets, emoji and similar terminal characters do not trigger an artificial period when adjacent messages are merged. Add multilingual regression cases. |
| TWR-040 | TODO | P1 | Introduce a Telegram-aware TTS text sanitizer/normalizer before sentence segmentation. Preserve/extract structured Telegram entities where possible instead of reconstructing them from flattened `innerText`; define speech policy for URLs, `@mentions`, hashtags, code/pre blocks, spoilers, quotes, emoji-only content and other non-prose entities. |
| TWR-041 | TODO | P1 | Replace regex-only sentence splitting with a layered segmentation pipeline: sanitized/normalized text -> `Intl.Segmenter(..., { granularity: 'sentence' })` when available -> Telegram-specific boundary corrections -> existing hard max-length wrapper, with deterministic fallback when Segmenter is unavailable. Do not treat `Intl.Segmenter` as sufficient by itself. |
| TWR-042 | TODO | P2 | Improve mixed-language detection beyond the current Cyrillic/Latin regex heuristic. Prefer script proportions, per-chat/per-author language preference and confidence/length thresholds, with manual override; avoid switching language because of isolated brands, URLs or short foreign fragments. |
| TWR-043 | TODO | P2 | Run a controlled audible-media/MediaSession experiment only as a measured browser-lifecycle option: test whether a real audible media path changes Android background/audio-focus behaviour and separately evaluate lock-screen/Bluetooth controls. Do not assume silent audio, AudioContext or MediaSession keeps JavaScript alive. |
| TWR-044 | TODO | P2 | If TWR-031 proves browser TTS unreliable on the physical Galaxy, prototype a native Android foreground-service TTS backend/runtime shell while preserving Telegram adapter, normalized core, planner and queue boundaries. Remote TTS remains a separate privacy/security decision. |
| TWR-045 | DROPPED | P2 | Do not replace the DOM adapter with monkey-patching of Telegram Web Worker/SharedWorker internals as the primary ingestion path. Internal worker protocols are not a stable API, can change independently of rendered DOM contracts, and may be created before userscript interception. Re-evaluate only if DOM integration becomes the dominant unsolved limitation. |
| TWR-046 | DROPPED | P2 | Do not adopt Piper/Sherpa/other WASM TTS merely to solve Android background lifecycle. WASM remains subject to browser suspension while adding model size, CPU/battery cost and runtime complexity. Re-evaluate only for voice-quality/offline-provider requirements independent of lifecycle. |
| TWR-047 | DROPPED | P2 | Do not merge provider-neutral `PlaybackQueue` state with `WebSpeechPlayer` into one provider-specific state machine. Provider lifecycle may be refactored into an explicit FSM internally, but the queue/backend boundary must remain intact so native or remote TTS can replace Web Speech. |

## Architecture-review notes

The preferred text path after TWR-040/TWR-041 is:

`Telegram DOM/state -> entity extraction -> TTS sanitizer/normalizer -> sentence segmentation -> Telegram-specific boundary correction -> max-length chunking -> TTS backend`

`Intl.Segmenter` is a useful Unicode/locale-aware baseline, not a Telegram parser. The sanitizer must handle entities and technical/non-prose content before sentence boundaries are inferred. Code blocks, links, mentions, spoilers and similar content should carry structured policy where the Telegram adapter can recover it rather than forcing the segmenter to infer semantics from plain text.

The current userscript-first architecture remains intentional. WebExtension/PWA packaging may provide permissions or UX improvements but does not by itself provide an Android foreground service or guarantee persistent background execution. Native Android runtime/TTS is the conditional escalation path after physical-device acceptance, not a prerequisite for the browser implementation.
