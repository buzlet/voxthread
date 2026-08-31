<!-- docs/backlog.md -->
# Backlog

Identifiers are permanent. Do not renumber deleted/completed items. Commit messages implementing a tracked item should start with its ID, for example `TWR-004: normalize Telegram messages`.

Status values: `TODO`, `DOING`, `BLOCKED`, `DONE`, `DROPPED`.

| ID | Status | Priority | Task |
|---|---|---:|---|
| TWR-001 | DONE | P0 | Install/prepare Edge Android + Tampermonkey on the test device and verify userscript injection on Telegram Web K. |
| TWR-002 | DONE | P0 | Establish repeatable remote debugging of Edge Android from `u24` through Wireless ADB/CDP. |
| TWR-003 | DONE | P0 | Build a diagnostic TTS userscript: enumerate voices and exercise a long queued `speechSynthesis` sequence. |
| TWR-004 | DOING | P0 | Measure TTS behaviour foreground, background, screen-off and locked-screen; record exact failure modes. |
| TWR-005 | DOING | P0 | Inspect Telegram Web K message DOM/state and capture sanitized fixtures for private/group chats. |
| TWR-006 | DOING | P0 | Define and implement the normalized message model and Telegram adapter boundary. |
| TWR-007 | TODO | P1 | Implement deterministic author-to-voice mapping with language compatibility and persistent overrides. |
| TWR-008 | TODO | P1 | Implement speech planning: author-change announcements, merging, filtering and pauses. |
| TWR-009 | TODO | P1 | Implement playback queue with play/pause/resume/stop/previous/next semantics. |
| TWR-010 | TODO | P1 | Add incremental message discovery using MutationObserver and virtualized-history scrolling. |
| TWR-011 | TODO | P1 | Add minimal overlay UI and start-reading-from-selected-message interaction. |
| TWR-012 | TODO | P1 | Define policy for replies, forwards, links, emoji-only messages, media and Telegram service messages. |
| TWR-013 | TODO | P1 | Add Node unit tests and browser fixture/regression tests. |
| TWR-014 | TODO | P0 | Compare the same reader on Firefox Android and document background/TTS differences. |
| TWR-015 | TODO | P2 | Evaluate MediaSession/Bluetooth headset controls for playback. |
| TWR-016 | DOING | P2 | Build reproducible userscript bundling/install/update workflow. |
| TWR-017 | DONE | P2 | Select and apply the final public project/repository name: VoxThread; update paths, README and future GitHub remote metadata consistently. |
| TWR-018 | DONE | P0 | Verify the first end-to-end path from visible Telegram message extraction to speaking the actual message text through TTS. |
