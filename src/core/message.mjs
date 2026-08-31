// src/core/message.mjs

function cleanText(value) {
  return String(value ?? '')
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function stringOrNull(value) {
  if (value === undefined || value === null || value === '') return null;
  return String(value);
}

function numberOrNull(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function normalizeMessage(input) {
  const id = stringOrNull(input?.id);
  const chatId = stringOrNull(input?.chatId);

  if (!id) throw new TypeError('NormalizedMessage.id is required');
  if (!chatId) throw new TypeError('NormalizedMessage.chatId is required');

  return Object.freeze({
    id,
    chatId,
    authorId: stringOrNull(input.authorId),
    authorName: cleanText(input.authorName) || null,
    text: cleanText(input.text),
    type: stringOrNull(input.type) || 'unknown',
    replyToId: stringOrNull(input.replyToId),
    media: input.media ?? null,
    timestamp: numberOrNull(input.timestamp),
    outgoing: Boolean(input.outgoing),
    source: input.source ?? null,
  });
}
