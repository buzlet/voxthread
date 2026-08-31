<!-- docs/notes/2026-08-31-edge-cdp-telegram-dom.md -->
# Edge Android CDP and Telegram Web K DOM

Date: 2026-08-31
Device: Android 16, Edge Android 152.0.4191.53
Transport: Wireless ADB from `u24`

## CDP

Edge exposes `@chrome_devtools_remote` over ADB.

```sh
adb forward tcp:9222 localabstract:chrome_devtools_remote
curl -s http://127.0.0.1:9222/json/list | jq
```

Telegram Web K appears as a normal CDP page target. Runtime evaluation and CDP touch input both work.

## Chat list

Telegram keeps several virtual chat lists in the DOM for different filters, including hidden lists. Do not select the first matching peer row blindly; require the target to be visibly laid out.

Useful chat-list attributes/classes include `a.chatlist-chat[data-peer-id]`, `data-thread-id`, `.peer-title`, `.message-time`, and `.dialog-subtitle`.
## Messages

Useful message structure observed:

- `.bubble[data-mid][data-peer-id][data-timestamp]`
- `.message`
- `.translatable-message`
- `.time` is separate UI metadata inside the message container.
- date separators use `.bubble.service.is-date` and must not be treated as messages.

For TTS text, prefer `.translatable-message` text over the whole `.message` or `.bubble` `innerText`. The narrower node preserves the actual message text and naturally excludes timestamps/status UI.

Emoji may be represented as `<img class="emoji" alt="…">`; extraction must preserve the `alt` text when appropriate.

CDP `Input.dispatchTouchEvent` successfully opens a visible chat row. A synthetic DOM `.click()` was not reliable for the mobile Telegram interaction path.

No credentials, login codes, private message text or session material are recorded in this note.
