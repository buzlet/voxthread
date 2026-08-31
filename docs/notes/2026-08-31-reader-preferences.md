<!-- docs/notes/2026-08-31-reader-preferences.md -->
# Reader preferences and compact UI

Date: 2026-08-31

VoxThread now persists browser-local reader preferences:
- announce author changes
- merge adjacent messages from the same author
- link speech mode: domain / skip / full URL
- skip emoji-only messages
- speak media labels
- automatically retry an interrupted message after visibility returns
- collapsed/expanded panel state

The reader panel can collapse to its status header and exposes a compact
`Settings` section when expanded.

The Android emulator Chrome smoke test changed several options, rebuilt the
queue, verified the resulting speech plan and collapsed state, then opened a
fresh page on the same origin. The preferences were restored from localStorage
without being supplied again.
