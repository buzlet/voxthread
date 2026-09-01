# Product roadmap

This document keeps product-development ideas that are intentionally outside the completed post-v0.7 backlog integration. Order reflects expected product value and architectural leverage, not a permanent promise.

## 1. Multi-chat / Radio mode

Let the user select several chats and consume them as one continuous spoken stream while clearly announcing chat/context changes. This remains the strongest candidate for VoxThread's distinctive product experience: a personal conversational radio made from selected chats.

Original proposal item: 2.

## 2. Native Android TTS/background companion, conditional on hardware acceptance

If physical Samsung testing shows browser Web Speech is not reliable enough under Doze/secure lock/audio focus, add a minimal native Android companion using Android TTS and a foreground media service. Keep Telegram extraction and core queue logic unchanged.

Original proposal item: 5. Tracked conditionally as `TWR-044` after `TWR-031`.

## 3. Firefox WebExtension distribution

Build a Firefox Android extension from the same core/runtime sources while retaining the userscript package. This can provide cleaner installation, storage/options and browser integration without pretending an extension alone supplies an Android foreground service.

Original proposal item: 6.

## 4. Per-chat profiles

Allow chat-specific voice mappings, playback rate, author-announcement policy, pauses and ignored participants/bots. Language preference already supports per-chat/per-author layering; future profiles should extend that model instead of introducing another unrelated settings store.

Original proposal item: 9.

## 5. Podcast-style audio UX

Improve MediaSession/lock-screen/Bluetooth interaction with actions such as previous/next spoken segment, short rewind semantics, sleep timer and bookmarks for the current Telegram message. The TWR-043 experiment showed audible media does not keep Chrome Web Speech alive, so this work is strictly about controls/UX rather than lifecycle keepalive.

Original proposal item: 13.

## 6. Telegram compatibility watchdog

Detect adapter breakage explicitly. Conditions such as many Telegram bubbles discovered but zero normalized messages should produce a visible diagnostic instead of silently appearing as an empty queue. Keep regression fixtures as compatibility contracts.

Original proposal item: 14.

## 7. Telegram Web A adapter

Implement Web A as a second Telegram frontend adapter. Besides giving users another runtime choice, this is a useful architectural test: core/cache/queue/TTS code should remain unchanged when the Telegram frontend changes.

Original proposal item: 7.

## 8. Digest mode

Add an optional processing stage for large unread backlogs: messages -> summarizer -> speech planner. Prefer local summarization where practical; any remote summarizer must be explicit opt-in because Telegram message text would leave the device.

Original proposal item: 11.

## 9. TTS backend fallback policy

Once more than one provider exists, define explicit failover/capability selection such as Firefox Web Speech -> native companion -> user-enabled remote TTS. Remote providers must never receive message text merely because a local provider failed.

Original proposal item: 12.

## Completed post-v0.7 integrations

Original proposal items 1, 4 and 8 are implemented as `TWR-032`, `TWR-033` and `TWR-034`: persistent per-chat read cursor/resume position, TTS backend API v2/provider-neutral capabilities, and privacy-safe self-diagnostics/export.

Original proposal item 3, the internal normalized-message buffer, is implemented as `TWR-048`: a bounded RAM-only per-chat cache that detaches DOM references, survives Telegram DOM virtualization within the page session and never persists message text.

The core of original proposal item 10, deterministic smart speech policy, is now implemented by `TWR-039` through `TWR-042`: punctuation-aware merging, Telegram entity normalization, layered sentence segmentation with Telegram corrections, and mixed-language preference/detection. Future policy refinements should be added as concrete backlog defects/features rather than keeping a duplicate umbrella roadmap item.
