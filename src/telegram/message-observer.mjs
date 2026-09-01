// src/telegram/message-observer.mjs
import {
  extractTelegramBubbles,
  TelegramAuthorContext,
} from './dom-adapter.mjs';

const BUBBLE_SELECTOR = '.bubble[data-mid]';

function keyOf(message) {
  return `${message.chatId}:${message.id}`;
}

function messageFingerprint(message) {
  return JSON.stringify([
    message.authorId,
    message.authorName,
    message.text,
    message.type,
    message.replyToId,
    message.media,
    message.entities,
    message.timestamp,
    message.outgoing,
  ]);
}

function isDeletionTombstone(bubble) {
  return bubble?.dataset?.deleted === 'true'
    || bubble?.dataset?.deleted === '1'
    || bubble?.classList?.contains?.('is-deleted')
    || bubble?.classList?.contains?.('deleted-message')
    || bubble?.classList?.contains?.('message-deleted');
}

class BoundedSeenMessages {
  #recent = new Map();
  #history = new Map();

  constructor({ maxRecent = 4096, maxHistory = 32768 } = {}) {
    this.maxRecent = Math.max(1, Number(maxRecent) || 4096);
    this.maxHistory = Math.max(0, Number(maxHistory) || 0);
  }

  observe(key, fingerprint) {
    const previous = this.#recent.get(key) ?? this.#history.get(key) ?? null;
    const state = previous === null ? 'new' : (previous === fingerprint ? 'seen' : 'changed');

    this.#history.delete(key);
    this.#recent.delete(key);
    this.#recent.set(key, fingerprint);

    while (this.#recent.size > this.maxRecent) {
      const oldest = this.#recent.keys().next().value;
      const value = this.#recent.get(oldest);
      this.#recent.delete(oldest);
      if (this.maxHistory) this.#history.set(oldest, value);
    }
    while (this.#history.size > this.maxHistory) {
      const oldest = this.#history.keys().next().value;
      this.#history.delete(oldest);
    }
    return state;
  }

  clear() { this.#recent.clear(); this.#history.clear(); }
  get size() { return this.#recent.size + this.#history.size; }
  get recentSize() { return this.#recent.size; }
  get historySize() { return this.#history.size; }
}

function addBubble(bubbles, unique, bubble) {
  if (!bubble || unique.has(bubble)) return;
  unique.add(bubble);
  bubbles.push(bubble);
}

function collectAffectedBubbles(records) {
  const bubbles = [];
  const unique = new Set();

  for (const record of records ?? []) {
    for (const node of record?.addedNodes ?? []) {
      if (node?.matches?.(BUBBLE_SELECTOR)) addBubble(bubbles, unique, node);
      for (const bubble of node?.querySelectorAll?.(BUBBLE_SELECTOR) ?? []) {
        addBubble(bubbles, unique, bubble);
      }
    }

    const target = record?.target?.nodeType === 3
      ? record.target.parentElement
      : record?.target;
    const bubble = target?.matches?.(BUBBLE_SELECTOR)
      ? target
      : target?.closest?.(BUBBLE_SELECTOR);
    addBubble(bubbles, unique, bubble);
  }

  return bubbles;
}

export class TelegramMessageObserver {
  #observer = null;
  #seen;
  #authorContext;
  #mutationBatches = 0;

  constructor({
    root,
    MutationObserverCtor = globalThis.MutationObserver,
    onMessages = null,
    onChanges = null,
    authorContext = new TelegramAuthorContext(),
    reconcileEvery = 25,
    seenWindowSize = 4096,
    seenHistorySize = 32768,
  }) {
    if (!root?.querySelectorAll) {
      throw new TypeError('TelegramMessageObserver.root must support querySelectorAll');
    }
    this.root = root;
    this.MutationObserverCtor = MutationObserverCtor;
    this.onMessages = typeof onMessages === 'function' ? onMessages : null;
    this.onChanges = typeof onChanges === 'function' ? onChanges : null;
    this.reconcileEvery = Math.max(1, Number(reconcileEvery) || 25);
    this.#authorContext = authorContext;
    this.#seen = new BoundedSeenMessages({
      maxRecent: seenWindowSize,
      maxHistory: seenHistorySize,
    });
  }

  #processBubbles(bubbles, { emit = true } = {}) {
    const normal = [];
    const changes = [];

    for (const bubble of bubbles) {
      if (!bubble?.dataset?.mid || !bubble?.dataset?.peerId) continue;
      if (isDeletionTombstone(bubble)) {
        const key = `${bubble.dataset.peerId}:${bubble.dataset.mid}`;
        const state = this.#seen.observe(key, '__deleted__');
        if (state !== 'seen') {
          changes.push(Object.freeze({
            type: 'deleted',
            chatId: String(bubble.dataset.peerId),
            messageId: String(bubble.dataset.mid),
          }));
        }
      } else {
        normal.push(bubble);
      }
    }

    const messages = extractTelegramBubbles(normal, {
      authorContext: this.#authorContext,
    });
    const fresh = [];

    for (const message of messages) {
      const state = this.#seen.observe(keyOf(message), messageFingerprint(message));
      if (state === 'new') fresh.push(message);
      else if (state === 'changed') {
        changes.push(Object.freeze({ type: 'updated', message }));
      }
    }

    if (emit && fresh.length) this.onMessages?.(fresh);
    if (emit && changes.length) this.onChanges?.(changes);
    return { fresh, changes };
  }

  scan({ emit = true } = {}) {
    const bubbles = [...this.root.querySelectorAll(BUBBLE_SELECTOR)];
    return this.#processBubbles(bubbles, { emit }).fresh;
  }

  processMutations(records, { emit = true } = {}) {
    const bubbles = collectAffectedBubbles(records);
    const result = bubbles.length
      ? this.#processBubbles(bubbles, { emit })
      : { fresh: [], changes: [] };

    this.#mutationBatches += 1;
    if (this.#mutationBatches % this.reconcileEvery === 0) {
      const reconciled = this.scan({ emit });
      return result.fresh.length ? [...result.fresh, ...reconciled] : reconciled;
    }
    return result.fresh;
  }

  start({ emitInitial = true } = {}) {
    if (this.#observer) return this.scan();
    const initial = this.scan({ emit: emitInitial });
    this.#observer = new this.MutationObserverCtor(records => this.processMutations(records));
    this.#observer.observe(this.root, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
    });
    return initial;
  }

  stop() { this.#observer?.disconnect?.(); this.#observer = null; }
  resetSeen() { this.#seen.clear(); }
  resetContext() { this.#authorContext.reset(); }
  get seenCount() { return this.#seen.size; }
  get seenRecentCount() { return this.#seen.recentSize; }
  get seenHistoryCount() { return this.#seen.historySize; }
  get authorContextSize() { return this.#authorContext.size; }
}

export function scrollTowardOlder(container, { screens = 0.9 } = {}) {
  if (!container) throw new TypeError('scroll container is required');
  const before = Number(container.scrollTop || 0);
  const height = Number(container.clientHeight || 0);
  const target = Math.max(0, before - Math.max(1, height * screens));
  if (typeof container.scrollTo === 'function') container.scrollTo({ top: target, behavior: 'instant' });
  else container.scrollTop = target;
  return { before, after: target, moved: target !== before };
}

export function findTelegramMessageScroller(root = document) {
  return root.querySelector?.('.bubbles-scrollable') ?? null;
}

export function scrollTowardNewer(container, { screens = 0.9 } = {}) {
  if (!container) throw new TypeError('scroll container is required');
  const before = Number(container.scrollTop || 0);
  const height = Number(container.clientHeight || 0);
  const scrollHeight = Number(container.scrollHeight || 0);
  const maxTop = Math.max(0, scrollHeight - height);
  const target = Math.min(maxTop, before + Math.max(1, height * screens));
  if (typeof container.scrollTo === 'function') container.scrollTo({ top: target, behavior: 'auto' });
  else container.scrollTop = target;
  return { before, after: target, moved: target !== before };
}
