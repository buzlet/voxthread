// src/core/content-policy.mjs

const URL_RE = /\bhttps?:\/\/[^\s<>()]+/giu;

function domainFromUrl(value) {
  try {
    return new URL(value).hostname.replace(/^www\./i, '');
  } catch {
    return value;
  }
}

export function simplifyLinks(text, mode = 'domain') {
  if (mode === 'verbatim') return text;
  if (mode === 'skip') return text.replace(URL_RE, '').replace(/\s{2,}/g, ' ').trim();

  return text.replace(URL_RE, url => domainFromUrl(url));
}

export function isEmojiOnly(text) {
  const value = String(text ?? '').trim();
  if (!value) return false;
  if (/[\p{L}\p{N}]/u.test(value)) return false;
  return /\p{Extended_Pictographic}/u.test(value);
}

export function prepareMessageForSpeech(message, options = {}) {
  const {
    linkMode = 'domain',
    skipEmojiOnly = true,
    announceMedia = false,
    mediaLabels = {},
  } = options;

  if (!message) return null;
  if (message.type === 'service') return null;

  let text = simplifyLinks(String(message.text ?? '').trim(), linkMode);

  if (skipEmojiOnly && isEmojiOnly(text)) return null;

  if (!text && announceMedia && message.media?.kind) {
    text = mediaLabels[message.media.kind] ?? message.media.kind;
  }

  if (!text) return null;

  return {
    ...message,
    text,
  };
}
