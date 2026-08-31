<!-- docs/notes/2026-08-31-edge-tampermonkey-injection.md -->
# Edge Tampermonkey injection verification

Date: 2026-08-31
Device: Samsung SM-A576B, Android 16
Browser: Edge Android 152.0.4191.53
Tampermonkey: 5.5.0

## Result

`voxthread-001.user.js` was installed from a temporary HTTP server on `u24`.
Tampermonkey intercepted the `.user.js` URL and displayed its normal install page.
After installation and reopening Telegram Web K, the VoxThread panel appeared automatically.

The userscript matched `https://web.telegram.org/k/*` and injected with `@grant none`.
A scan inside peer `777000` found seven visible `.bubble[data-mid]` messages.
The CDP verification returned only message IDs, not message content.

## Verified path

`u24 -> Wireless ADB -> Edge Android -> Tampermonkey -> Telegram Web K -> VoxThread userscript`

This completes the injection part of TWR-001.
