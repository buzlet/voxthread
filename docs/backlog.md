<!-- docs/backlog.md -->
# Backlog

Identifiers are permanent. Do not renumber deleted/completed items. Commit messages implementing a tracked item should start with its ID, for example `TWR-004: normalize Telegram messages`.

Status values: `TODO`, `DOING`, `BLOCKED`, `DONE`, `DROPPED`.

| ID | Status | Priority | Task |
|---|---|---:|---|
| TWR-001 | DONE | P0 | Install/prepare Edge Android + Tampermonkey on the test device and verify userscript injection on Telegram Web K. |
| TWR-002 | DONE | P0 | Establish repeatable remote debugging of Edge Android from `u24` through Wireless ADB/CDP. |
| TWR-003 | DONE | P0 | Build a diagnostic TTS userscript: enumerate voices and exercise a long queued `speechSynthesis` sequence. |
| TWR-004 | BLOCKED | P0 | Measure TTS behaviour foreground, background, screen-off and locked-screen; record exact failure modes. |
| TWR-005 | DONE | P0 | Inspect Telegram Web K message DOM/state and capture sanitized fixtures for private/group chats. |
| TWR-006 | DONE | P0 | Define and implement the normalized message model and Telegram adapter boundary. |
| TWR-007 | DONE | P1 | Implement deterministic author-to-voice mapping with language compatibility and persistent overrides. |
| TWR-008 | DONE | P1 | Implement speech planning: author-change announcements, merging, filtering and pauses. |
| TWR-009 | DONE | P1 | Implement playback queue with play/pause/resume/stop/previous/next semantics. |
| TWR-010 | DONE | P1 | Add incremental message discovery using MutationObserver and virtualized-history scrolling. |
| TWR-011 | DONE | P1 | Add minimal overlay UI and start-reading-from-selected-message interaction. |
| TWR-012 | DONE | P1 | Define policy for replies, forwards, links, emoji-only messages, media and Telegram service messages. |
| TWR-013 | DONE | P1 | Add Node unit tests and browser fixture/regression tests. |
| TWR-014 | BLOCKED | P1 | Compare the same reader on Firefox Android and document background/TTS differences. |
| TWR-015 | DONE | P2 | Evaluate MediaSession/Bluetooth headset controls for playback. |
| TWR-016 | BLOCKED | P2 | Build reproducible userscript bundling/install/update workflow. |
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
| TWR-027 | DOING | P1 | Validate live-follow in real emulator Chrome: append a new Telegram bubble after queue completion and verify automatic queue extension/resume. |
