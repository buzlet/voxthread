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

function withAuthor(message, authorId, authorName) {
  return normalizeMessage({
    ...message,
    authorId,
    authorName,
  });
}

export function extractTelegramBubbles(bubbles) {
  const result = [];
  const lastInboundAuthor = new Map();

  for (const bubble of bubbles) {
    let message = extractTelegramBubble(bubble);
    if (!message) continue;

    const chatId = message.chatId;

    if (message.type === 'service' || message.outgoing) {
      lastInboundAuthor.delete(chatId);
      result.push(message);
      continue;
    }

    if (message.authorId || message.authorName) {
      lastInboundAuthor.set(chatId, {
        authorId: message.authorId,
        authorName: message.authorName,
      });
      result.push(message);
      continue;
    }

    if (hasClass(bubble, 'hide-name')) {
      const previous = lastInboundAuthor.get(chatId);
      if (previous) {
        message = withAuthor(
          message,
          previous.authorId,
          previous.authorName,
        );
      }
    }

    if (!message.authorId && !message.authorName && !chatId.startsWith('-')) {
      message = withAuthor(message, chatId, null);
    }

    if (message.authorId || message.authorName) {
      lastInboundAuthor.set(chatId, {
        authorId: message.authorId,
        authorName: message.authorName,
      });
    }

    result.push(message);
  }

  return result;
}
