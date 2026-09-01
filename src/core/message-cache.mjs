// src/core/message-cache.mjs
import { normalizeMessage } from './message.mjs';

function cacheKey(value) {
  return String(value ?? '');
}

function numericId(value) {
  const text = String(value ?? '');
  return /^\d+$/.test(text) ? BigInt(text) : null;
}

function compareEntries(left, right) {
  const a = left.message;
  const b = right.message;

  if (a.timestamp !== null && b.timestamp !== null && a.timestamp !== b.timestamp) {
    return a.timestamp - b.timestamp;
  }

  const aid = numericId(a.id);
  const bid = numericId(b.id);
  if (aid !== null && bid !== null && aid !== bid) return aid < bid ? -1 : 1;

  return left.firstSeen - right.firstSeen;
}

function detachedMessage(message) {
  return normalizeMessage({
    ...message,
    source: null,
  });
}

function messageFingerprint(message) {
  return JSON.stringify([
    message.authorId,
    message.authorName,
    message.text,
    message.type,
    message.replyToId,
    message.media,
    message.timestamp,
    message.outgoing,
  ]);
}

export class NormalizedMessageCache {
  #chats = new Map();
  #sequence = 0;

  constructor({ maxMessagesPerChat = 1200, maxChats = 12 } = {}) {
    this.maxMessagesPerChat = Math.max(1, Number(maxMessagesPerChat) || 1200);
    this.maxChats = Math.max(1, Number(maxChats) || 12);
  }

  #touchChat(chatId, create = false) {
    const key = cacheKey(chatId);
    let chat = this.#chats.get(key);
    if (!chat && create) chat = { messages: new Map() };
    if (!chat) return null;

    this.#chats.delete(key);
    this.#chats.set(key, chat);

    while (this.#chats.size > this.maxChats) {
      const oldestChatId = this.#chats.keys().next().value;
      this.#chats.delete(oldestChatId);
    }

    return chat;
  }

  #trimChat(chat) {
    while (chat.messages.size > this.maxMessagesPerChat) {
      let oldestKey = null;
      let oldestSeen = Infinity;
      for (const [key, entry] of chat.messages) {
        if (entry.lastSeen < oldestSeen) {
          oldestSeen = entry.lastSeen;
          oldestKey = key;
        }
      }
      if (oldestKey === null) break;
      chat.messages.delete(oldestKey);
    }
  }

  upsert(messages) {
    const result = { added: 0, updated: 0, unchanged: 0 };

    for (const input of messages ?? []) {
      if (!input?.id || !input?.chatId) continue;
      const message = detachedMessage(input);
      const chat = this.#touchChat(message.chatId, true);
      const key = cacheKey(message.id);
      const previous = chat.messages.get(key);
      const seen = ++this.#sequence;
      const fingerprint = messageFingerprint(message);

      if (!previous) {
        chat.messages.set(key, {
          message,
          fingerprint,
          firstSeen: seen,
          lastSeen: seen,
        });
        result.added += 1;
      } else if (previous.fingerprint !== fingerprint) {
        chat.messages.set(key, {
          ...previous,
          message,
          fingerprint,
          lastSeen: seen,
        });
        result.updated += 1;
      } else {
        previous.lastSeen = seen;
        result.unchanged += 1;
      }

      this.#trimChat(chat);
    }

    return Object.freeze(result);
  }

  getChat(chatId) {
    const chat = this.#touchChat(chatId, false);
    if (!chat) return [];
    return [...chat.messages.values()]
      .sort(compareEntries)
      .map(entry => entry.message);
  }

  get(chatId, messageId) {
    const chat = this.#touchChat(chatId, false);
    return chat?.messages.get(cacheKey(messageId))?.message ?? null;
  }

  remove(chatId, messageId) {
    const chat = this.#touchChat(chatId, false);
    return Boolean(chat?.messages.delete(cacheKey(messageId)));
  }

  clearChat(chatId) {
    return this.#chats.delete(cacheKey(chatId));
  }

  clear() {
    this.#chats.clear();
  }

  get chatCount() {
    return this.#chats.size;
  }

  get messageCount() {
    let count = 0;
    for (const chat of this.#chats.values()) count += chat.messages.size;
    return count;
  }

  countForChat(chatId) {
    return this.#chats.get(cacheKey(chatId))?.messages.size ?? 0;
  }
}
