// src/core/content-policy.mjs
import {
  normalizeTelegramTextForSpeech,
  simplifyLinks,
} from './tts-text-normalizer.mjs';

export { simplifyLinks };

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
    mentionMode = 'plain',
    hashtagMode = 'plain',
    codeMode = 'verbatim',
    spoilerMode = 'verbatim',
    quoteMode = 'verbatim',
  } = options;

  if (!message) return null;
  if (message.type === 'service') return null;

  let text = normalizeTelegramTextForSpeech(message.text, {
    entities: message.entities,
    linkMode,
    mentionMode,
    hashtagMode,
    codeMode,
    spoilerMode,
    quoteMode,
  });

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
