<!-- docs/notes/2026-08-31-edge-webspeech.md -->
# Edge Android Web Speech diagnostic

Date: 2026-08-31
Device: Samsung SM-A576B, Android 16
Browser: Edge Android 152.0.4191.53
Userscript: VoxThread Diagnostics 0.2.0

## Voice enumeration

`speechSynthesis.getVoices()` returned an empty array.
This remained true before speech, after a real CDP touch on the Voices button, and after a completed speech session.
No `voiceschanged` event populated the list during the observed test.

## Queue test

A synthetic queue of 20 `SpeechSynthesisUtterance` objects was started through a real touch event.
Final counters were `queued=20`, `started=20`, `ended=20`, `errors=[]`.
Therefore Edge Android Web Speech can speak queued utterances using its default system path even though voice enumeration is unavailable.

## Consequence

Current Edge behaviour does not provide selectable `SpeechSynthesisVoice` objects for deterministic per-author voice assignment.
Pitch/rate variation remains possible, but true per-author voice selection requires another browser/runtime if this result persists.
Firefox comparison under TWR-014 is therefore important in addition to the background test.

## Clarification from audible observation

The 20 utterances were synthetic diagnostics such as `Message number 1`, `Message number 2`, and so on, spoken in English.
No Telegram message text was spoken during either of the two audible queue runs.
The `20/20` result therefore proves queue execution and background continuity only; it does not prove the end-to-end Telegram-message-to-TTS path.
