// src/telegram/message-observer.mjs
import { extractTelegramBubbles } from './dom-adapter.mjs';

function keyOf(message) {
  return `${message.chatId}:${message.id}`;
}

export class TelegramMessageObserver {
  #observer = null;
  #seen = new Set();

  constructor({
    root,
    MutationObserverCtor = globalThis.MutationObserver,
    onMessages = null,
  }) {
    if (!root?.querySelectorAll) {
      throw new TypeError('TelegramMessageObserver.root must support querySelectorAll');
    }

    this.root = root;
    this.MutationObserverCtor = MutationObserverCtor;
    this.onMessages = typeof onMessages === 'function' ? onMessages : null;
  }

  scan({ emit = true } = {}) {
    const bubbles = [...this.root.querySelectorAll('.bubble[data-mid]')];
    const messages = extractTelegramBubbles(bubbles);
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

  start({ emitInitial = true } = {}) {
    if (this.#observer) return this.scan();

    const initial = this.scan({ emit: emitInitial });
    this.#observer = new this.MutationObserverCtor(() => this.scan());
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

  get seenCount() {
    return this.#seen.size;
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
