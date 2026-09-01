# Chrome API 36 audible-media lifecycle experiment

Date: 2026-09-01  
Tested commit: `0d06ae3a4f17326eee09515d837265af12a1fd9c`  
GitHub Actions run: `33466043531` (`Android emulator regression`, success)

## Question

Does keeping a real HTML media path active materially improve Chrome Android Web Speech survival in background or with the display off?

## Method

The same VoxThread fixture and Web Speech playback were exercised on the generic Android 16/API 36 Chrome emulator with three media-anchor modes:

1. no media anchor;
2. looping silent PCM/WAV media;
3. looping audible 440 Hz PCM/WAV media.

For each mode the test observed VoxThread queue/message state, Web Speech errors and media-element playback progress while Chrome was backgrounded and while Android entered screen-off/asleep state.

The hosted emulator may suppress physical speaker output, so the experiment establishes browser/media-pipeline lifecycle behavior rather than acoustic loudness at a real device speaker.

## Result

In both silent and audible modes, the media element continued playing and its `currentTime` advanced through lifecycle transitions. Despite that active media path, Chrome Web Speech still reported `interrupted` when backgrounded/screen-off, matching the no-anchor case.

VoxThread's no-skip handling kept the queue on the same Telegram message instead of advancing past it.

## Decision

Do not use silent audio, audible audio, AudioContext or MediaSession as an assumed Web Speech keepalive. Real media playback does not solve Chrome's observed Web Speech lifecycle interruption on the API 36 target.

MediaSession and media playback may still be used for lock-screen/Bluetooth controls and podcast-style UX. Those benefits are separate from keeping Web Speech execution alive.

Physical Galaxy acceptance (`TWR-031`) remains authoritative for Samsung/Doze/audio-focus behavior. Native Android foreground-service TTS (`TWR-044`) remains the conditional escalation if that acceptance fails.
