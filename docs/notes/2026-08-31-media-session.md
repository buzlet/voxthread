<!-- docs/notes/2026-08-31-media-session.md -->
# Browser MediaSession probe

Date: 2026-08-31
Target: Android 16 emulator, Chrome 133

`navigator.mediaSession` is available. Chrome accepted handlers for:
- play
- pause
- stop
- previoustrack
- nexttrack

Metadata and `playbackState='playing'` were also accepted without exception.

Android `dumpsys media_session` still reported zero active app media sessions.
A second probe attached a looping silent WAV to the real VoxThread Play gesture
and kept MediaSession metadata/handlers enabled. Chrome and Google TTS then
appeared in Android audio playback history, but Android still reported zero
active media sessions and no Chrome media-button session.

Conclusion: MediaSession API calls alone do not create useful lock-screen or
Bluetooth controls for the current `speechSynthesis` runtime. Do not add this
complexity to the browser MVP. Revisit MediaSession if VoxThread gains a native
Android foreground-service/TTS wrapper, where a real Android MediaSession can
be owned directly.
