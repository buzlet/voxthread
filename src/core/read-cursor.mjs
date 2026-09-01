// src/core/read-cursor.mjs

const POSITIONS = new Set(['at', 'after']);

function normalizeEntry(chatId, value) {
  if (!chatId || !value || typeof value !== 'object') return null;
  const messageId = value.messageId === undefined || value.messageId === null
    ? ''
    : String(value.messageId);
  if (!messageId) return null;

  const updatedAt = Number(value.updatedAt);
  return Object.freeze({
    chatId: String(chatId),
    messageId,
    position: POSITIONS.has(value.position) ? value.position : 'at',
    updatedAt: Number.isFinite(updatedAt) ? updatedAt : 0,
  });
}

export class ReadCursorStore {
  constructor(storage, key = 'voxthread.readCursor.v1', { maxEntries = 100 } = {}) {
    this.storage = storage;
    this.key = key;
    this.maxEntries = Math.max(1, Number(maxEntries) || 100);
  }

  #readAll() {
    try {
      const parsed = JSON.parse(this.storage?.getItem?.(this.key) || '{}');
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? parsed
        : {};
    } catch {
      return {};
    }
  }

  #writeAll(entries) {
    try {
      this.storage?.setItem?.(this.key, JSON.stringify(entries));
      return true;
    } catch {
      return false;
    }
  }

  get(chatId) {
    const id = chatId === undefined || chatId === null ? '' : String(chatId);
    if (!id) return null;
    return normalizeEntry(id, this.#readAll()[id]);
  }

  set(chatId, messageId, { position = 'at', updatedAt = Date.now() } = {}) {
    const id = chatId === undefined || chatId === null ? '' : String(chatId);
    const mid = messageId === undefined || messageId === null ? '' : String(messageId);
    if (!id || !mid) return null;

    const entry = {
      messageId: mid,
      position: POSITIONS.has(position) ? position : 'at',
      updatedAt: Number.isFinite(Number(updatedAt)) ? Number(updatedAt) : Date.now(),
    };
    const entries = this.#readAll();
    entries[id] = entry;

    const ordered = Object.entries(entries)
      .map(([entryChatId, value]) => [entryChatId, normalizeEntry(entryChatId, value)])
      .filter(([, value]) => value)
      .sort((left, right) => right[1].updatedAt - left[1].updatedAt)
      .slice(0, this.maxEntries);

    const pruned = Object.fromEntries(ordered.map(([entryChatId, value]) => [
      entryChatId,
      {
        messageId: value.messageId,
        position: value.position,
        updatedAt: value.updatedAt,
      },
    ]));

    this.#writeAll(pruned);
    return normalizeEntry(id, entry);
  }

  clear(chatId) {
    const id = chatId === undefined || chatId === null ? '' : String(chatId);
    if (!id) return false;
    const entries = this.#readAll();
    if (!(id in entries)) return false;
    delete entries[id];
    return this.#writeAll(entries);
  }

  get count() {
    return Object.entries(this.#readAll())
      .filter(([chatId, value]) => normalizeEntry(chatId, value))
      .length;
  }
}
