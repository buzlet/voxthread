// src/telegram/message-observer.mjs
import {
  extractTelegramBubbles,
  TelegramAuthorContext,
} from './dom-adapter.mjs';

const BUBBLE_SELECTOR = '.bubble[data-mid]';

function keyOf(message) {
  return `${message.chatId}:${message.id}`;
}

function collectAddedBubbles(records) {
  const bubbles = [];
  const unique = new Set();

  const add = bubble => {
    if (!bubble || unique.has(bubble)) return;
    unique.add(bubble);
    bubbles.push(bubble);
  };

  for (const record of records ?? []) {
    for (const node of record?.addedNodes ?? []) {
      if (node?.matches?.(BUBBLE_SELECTOR)) add(node);
      for (const bubble of node?.querySelectorAll?.(BUBBLE_SELECTOR) ?? []) {
        add(bubble);
      }
    }
  }

  return bubbles;
}

export class TelegramMessageObserver {
  #observer = null;
  #seen = new Set();
  #authorContext = new TelegramAuthorContext();
  #mutationBatches = 0;

  constructor({
    root,
    MutationObserverCtor = globalThis.MutationObserver,
    onMessages = null,
    reconcileEvery = 25,
  }) {
    if (!root?.querySelectorAll) {
      throw new TypeError('TelegramMessageObserver.root must support querySelectorAll');
    }

    this.root = root;
    this.MutationObserverCtor = MutationObserverCtor;
    this.onMessages = typeof onMessages === 'function' ? onMessages : null;
    this.reconcileEvery = Math.max(1, Number(reconcileEvery) || 25);
  }

  #accept(messages, { emit = true } = {}) {
    const fresh = [];

    for (const message of messages) {
      const key = keyOf(message);
      if (this.#seen.has(key)) continue;
      this.#seen.add(key);
      fresh.push(message);
    }

    if (emit && fresh.length) this.onMessages?.(fresh);
    return fresh;
  }

  #extract(bubbles, options) {
    return this.#accept(
      extractTelegramBubbles(bubbles, {
        authorContext: this.#authorContext,
      }),
      options,
    );
  }

  scan({ emit = true } = {}) {
    const bubbles = [...this.root.querySelectorAll(BUBBLE_SELECTOR)];
    return this.#extract(bubbles, { emit });
  }

  processMutations(records, { emit = true } = {}) {
    const bubbles = collectAddedBubbles(records);
    const fresh = bubbles.length
      ? this.#extract(bubbles, { emit })
      : [];

    this.#mutationBatches += 1;
    if (this.#mutationBatches % this.reconcileEvery === 0) {
      const reconciled = this.scan({ emit });
      return fresh.length ? [...fresh, ...reconciled] : reconciled;
    }

    return fresh;
  }

  start({ emitInitial = true } = {}) {
    if (this.#observer) return this.scan();

    const initial = this.scan({ emit: emitInitial });
    this.#observer = new this.MutationObserverCtor(records => {
      this.processMutations(records);
    });
    this.#observer.observe(this.root, {
      childList: true,
      subtree: true,
    });
    return initial;
  }

  stop() {
    this.#observer?.disconnect?.();
    this.#observer = null;
  }

  resetSeen() {
    this.#seen.clear();
  }

  resetContext() {
    this.#authorContext.reset();
  }

  get seenCount() {
    return this.#seen.size;
  }

  get authorContextSize() {
    return this.#authorContext.size;
  }
}

export function scrollTowardOlder(container, { screens = 0.9 } = {}) {
  if (!container) throw new TypeError('scroll container is required');

  const before = Number(container.scrollTop || 0);
  const height = Number(container.clientHeight || 0);
  const distance = Math.max(1, height * screens);
  const target = Math.max(0, before - distance);

  if (typeof container.scrollTo === 'function') {
    container.scrollTo({ top: target, behavior: 'instant' });
  } else {
    container.scrollTop = target;
  }

  return {
    before,
    after: target,
    moved: target !== before,
  };
}

export function findTelegramMessageScroller(root = document) {
  return root.querySelector?.('.bubbles-scrollable') ?? null;
}

export function scrollTowardNewer(container, { screens = 0.9 } = {}) {
  if (!container) throw new TypeError('scroll container is required');

  const before = Number(container.scrollTop || 0);
  const height = Number(container.clientHeight || 0);
  const scrollHeight = Number(container.scrollHeight || 0);
  const distance = Math.max(1, height * screens);
  const maxTop = Math.max(0, scrollHeight - height);
  const target = Math.min(maxTop, before + distance);

  if (typeof container.scrollTo === 'function') {
    container.scrollTo({ top: target, behavior: 'auto' });
  } else {
    container.scrollTop = target;
  }

  return {
    before,
    after: target,
    moved: target !== before,
  };
}
