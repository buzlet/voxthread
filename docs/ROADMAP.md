# Product roadmap

This document keeps product-development ideas that are intentionally not part of the next integration. Order reflects current expected value and architectural leverage, not a permanent promise.

## 1. Internal normalized-message cache

Keep a bounded in-memory/session cache of already normalized messages per chat so playback, previous/next and recovery do not depend on Telegram keeping the corresponding virtualized DOM nodes alive. Start with no persistent text storage; define explicit capacity/eviction rules and preserve stable message IDs.

Original proposal item: 3.

## 2. Multi-chat / Radio mode

Let the user select several chats and consume them as one continuous spoken stream while clearly announcing chat/context changes. This is the strongest candidate for VoxThread's distinctive product experience: a personal conversational radio made from selected chats.

Original proposal item: 2.

## 3. Smart deterministic speech policy

Improve spoken output without requiring AI: shorten long URLs, handle quotations and forwards compactly, speak media captions sensibly, collapse repeated emoji, treat code blocks separately and avoid reading low-value Telegram UI-derived content.

Original proposal item: 10.

## 4. Native Android TTS/background companion, conditional on hardware acceptance

If physical Samsung testing shows browser Web Speech is not reliable enough under Doze/secure lock/audio focus, add a minimal native Android companion using Android TTS and a foreground media service. Keep Telegram extraction and core queue logic unchanged.

Original proposal item: 5.

## 5. Firefox WebExtension distribution

Build a Firefox Android extension from the same core/runtime sources while retaining the userscript package. This can provide cleaner installation, storage/options and browser integration without abandoning portable userscript deployment.

Original proposal item: 6.

## 6. Per-chat profiles

Allow chat-specific voice mappings, playback rate, author-announcement policy, pauses and ignored participants/bots. Profiles should layer cleanly over global defaults.

Original proposal item: 9.

## 7. Podcast-style audio UX

Improve MediaSession/lock-screen/Bluetooth interaction with actions such as previous/next spoken segment, short rewind semantics, sleep timer and bookmarks for the current Telegram message.

Original proposal item: 13.

## 8. Telegram compatibility watchdog

Detect adapter breakage explicitly. Conditions such as many Telegram bubbles discovered but zero normalized messages should produce a visible diagnostic instead of silently appearing as an empty queue. Keep regression fixtures as compatibility contracts.

Original proposal item: 14.

## 9. Telegram Web A adapter

Implement Web A as a second Telegram frontend adapter. Besides giving users another runtime choice, this is a useful architectural test: core/queue/TTS code should remain unchanged when the Telegram frontend changes.

Original proposal item: 7.

## 10. Digest mode

Add an optional processing stage for large unread backlogs: messages -> summarizer -> speech planner. Prefer local summarization where practical; any remote summarizer must be explicit opt-in because Telegram message text would leave the device.

Original proposal item: 11.

## 11. TTS backend fallback policy

Once more than one provider exists, define explicit failover/capability selection such as Firefox Web Speech -> native companion -> user-enabled remote TTS. Remote providers must never receive message text merely because a local provider failed.

Original proposal item: 12.

## Next integration (tracked in backlog, therefore excluded above)

The next integration is intentionally limited to: persistent per-chat read cursor/resume position, TTS backend API v2/capabilities cleanup, and self-diagnostics/export. These correspond to original proposal items 1, 4 and 8.
