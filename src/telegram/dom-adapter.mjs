// src/telegram/dom-adapter.mjs
import { normalizeMessage } from '../core/message.mjs';

function hasClass(element, name) {
  return Boolean(element?.classList?.contains?.(name));
}

function getTextElement(bubble) {
  return bubble.querySelector?.('.translatable-message')
    || bubble.querySelector?.('.message')
    || null;
}

function getAuthorElement(bubble) {
  return bubble.querySelector?.('.peer-title[data-peer-id]')
    || null;
}

export function extractTelegramBubble(bubble) {
  if (!bubble?.dataset?.mid || !bubble?.dataset?.peerId) return null;

  const textElement = getTextElement(bubble);
  const authorElement = getAuthorElement(bubble);
  const text = textElement?.innerText ?? textElement?.textContent ?? '';

  return normalizeMessage({
    id: bubble.dataset.mid,
    chatId: bubble.dataset.peerId,
    authorId: authorElement?.dataset?.peerId ?? null,
    authorName: authorElement?.innerText ?? authorElement?.textContent ?? null,
    text,
    type: hasClass(bubble, 'service') ? 'service' : (text.trim() ? 'text' : 'unknown'),
    timestamp: bubble.dataset.timestamp,
    outgoing: hasClass(bubble, 'is-out'),
    source: bubble,
  });
}
