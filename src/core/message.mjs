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

function nonNegativeIntegerOrNull(value) {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(value);
  return Number.isInteger(n) && n >= 0 ? n : null;
}

function normalizeEntities(value) {
  if (!Array.isArray(value)) return Object.freeze([]);
  return Object.freeze(value
    .map(entity => {
      const type = stringOrNull(entity?.type);
      const text = cleanText(entity?.text);
      if (!type || !text) return null;
      return Object.freeze({
        type,
        text,
        href: stringOrNull(entity.href),
        language: stringOrNull(entity.language),
        occurrence: nonNegativeIntegerOrNull(entity.occurrence),
      });
    })
    .filter(Boolean));
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
    entities: normalizeEntities(input.entities),
    timestamp: numberOrNull(input.timestamp),
    outgoing: Boolean(input.outgoing),
    source: input.source ?? null,
  });
}
