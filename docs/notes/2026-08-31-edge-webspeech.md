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

## Real Telegram end-to-end speech

Userscript `voxthread-003.user.js` added `Speak Telegram`.
The test opened peer `7769142292`, extracted one visible real Telegram message (`mid=59873`) from `.translatable-message`, and passed that text directly to `SpeechSynthesisUtterance`.
No message text was emitted to the terminal or committed.
Final counters were `queued=1`, `started=1`, `ended=1`, `errors=[]`.
This is the first confirmed end-to-end Telegram DOM -> extracted message text -> Android Web Speech execution.

## Real Telegram background and lock-screen test

Userscript `voxthread-004.user.js` queued 16 real visible Telegram messages from peer `-2250600192` without logging message text.
Foreground start succeeded. After switching to Samsung Launcher, the queue continued (`started=2`, `ended=1`, `errors=[]`).
After turning the screen off, Android reported `mWakefulness=Dozing`, `mDreamingLockscreen=true`, `isKeyguardShowing=true`; the queue advanced once more to `started=3`, `ended=2`.
After a longer lock interval, the Edge CDP endpoint stopped responding. The Edge process and `@chrome_devtools_remote` socket remained present, indicating renderer/browser suspension rather than immediate process death.
After waking the device and bringing Edge forward, CDP recovered but VoxThread state was reset to `queued=0`, `started=0`, `ended=0`; the Telegram page/runtime had been recreated and the queued speech was lost.
This lock-screen run is inconclusive for three independent reasons:
1. An incoming phone call occurred during the test and remained active for part of the experiment, so Android audio focus and scheduling were not in a clean state.
2. CDP was reached through Wireless ADB. Loss of the forwarded CDP endpoint while the phone was dozing may indicate Wireless ADB transport suspension rather than Edge renderer suspension.
3. After waking the phone, Edge was explicitly launched again before the final state check. The observed reset to `queued=0`, `started=0`, `ended=0` therefore does not prove that the original runtime had been destroyed by screen lock.

Repeat TWR-004 without a phone call. After wake, reconnect Wireless ADB/CDP and inspect the existing Edge tab without launching or navigating Edge first.
