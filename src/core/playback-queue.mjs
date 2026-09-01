// src/core/playback-queue.mjs

export class PlaybackQueue {
  #segments = [];
  #index = -1;
  #status = 'empty';
  #messageIndex = new Map();

  constructor(onChange = null) {
    this.onChange = typeof onChange === 'function' ? onChange : null;
  }

  get status() { return this.#status; }
  get index() { return this.#index; }
  get length() { return this.#segments.length; }
  get current() { return this.#segments[this.#index] ?? null; }

  get snapshot() {
    return Object.freeze({
      status: this.#status,
      index: this.#index,
      length: this.#segments.length,
      current: this.current,
    });
  }

  #emit() {
    this.onChange?.(this.snapshot);
    return this.snapshot;
  }

  #rebuildMessageIndex() {
    this.#messageIndex.clear();
    for (let index = 0; index < this.#segments.length; index += 1) {
      for (const messageId of this.#segments[index]?.messageIds ?? []) {
        this.#messageIndex.set(String(messageId), index);
      }
    }
  }

  #indexForMessage(messageId) {
    return this.#messageIndex.get(String(messageId)) ?? -1;
  }

  load(segments, { startMessageId = null, afterMessageId = null } = {}) {
    this.#segments = [...segments];
    this.#rebuildMessageIndex();
    this.#index = this.#segments.length ? 0 : -1;
    this.#status = this.#segments.length ? 'ready' : 'empty';

    if (startMessageId !== null) {
      const found = this.#indexForMessage(startMessageId);
      if (found >= 0) this.#index = found;
    } else if (afterMessageId !== null) {
      const found = this.#indexForMessage(afterMessageId);
      if (found >= 0 && found < this.#segments.length - 1) {
        this.#index = found + 1;
      } else if (found === this.#segments.length - 1 && found >= 0) {
        this.#index = found;
        this.#status = 'completed';
      }
    }

    return this.#emit();
  }

  append(segments) {
    const items = [...segments];
    if (!items.length) return this.#emit();

    const oldLength = this.#segments.length;
    this.#segments.push(...items);
    this.#rebuildMessageIndex();

    if (oldLength === 0) {
      this.#index = 0;
      this.#status = 'ready';
    } else if (this.#status === 'completed') {
      this.#index = oldLength;
      this.#status = 'ready';
    }

    return this.#emit();
  }

  messageIdsFor(messageId) {
    const found = this.#indexForMessage(messageId);
    return found < 0 ? [] : [...(this.#segments[found]?.messageIds ?? [])];
  }

  replacePendingForMessage(messageId, replacementSegments = []) {
    const found = this.#indexForMessage(messageId);
    if (found < 0) return false;
    if (found < this.#index) return false;
    if (
      found === this.#index
      && (this.#status === 'playing' || this.#status === 'paused')
    ) return false;

    const replacements = [...replacementSegments];
    const oldIndex = this.#index;
    this.#segments.splice(found, 1, ...replacements);
    const delta = replacements.length - 1;

    if (!this.#segments.length) {
      this.#index = -1;
      this.#status = 'empty';
    } else if (found < oldIndex) {
      this.#index = Math.max(0, oldIndex + delta);
    } else if (found === oldIndex) {
      this.#index = Math.min(found, this.#segments.length - 1);
      if (this.#status === 'completed' || this.#status === 'stopped') {
        this.#status = 'ready';
      }
    }

    this.#rebuildMessageIndex();
    this.#emit();
    return true;
  }

  play() {
    if (!this.#segments.length) return this.#emit();
    if (this.#status === 'completed') this.#index = 0;
    this.#status = 'playing';
    return this.#emit();
  }

  pause() {
    if (this.#status === 'playing') this.#status = 'paused';
    return this.#emit();
  }

  resume() {
    if (this.#status === 'paused') this.#status = 'playing';
    return this.#emit();
  }

  stop() {
    if (!this.#segments.length) {
      this.#index = -1;
      this.#status = 'empty';
    } else {
      this.#index = 0;
      this.#status = 'stopped';
    }
    return this.#emit();
  }

  previous() {
    if (!this.#segments.length) return this.#emit();
    this.#index = Math.max(0, this.#index - 1);
    if (this.#status === 'completed') this.#status = 'ready';
    return this.#emit();
  }

  next() {
    if (!this.#segments.length) return this.#emit();
    if (this.#index < this.#segments.length - 1) {
      this.#index += 1;
      if (this.#status === 'completed') this.#status = 'ready';
    } else {
      this.#status = 'completed';
    }
    return this.#emit();
  }

  advance() {
    if (this.#status !== 'playing') return this.#emit();
    if (this.#index < this.#segments.length - 1) this.#index += 1;
    else this.#status = 'completed';
    return this.#emit();
  }

  seekToMessage(messageId) {
    const found = this.#indexForMessage(messageId);
    if (found < 0) return false;
    this.#index = found;
    if (this.#status === 'completed' || this.#status === 'stopped') {
      this.#status = 'ready';
    }
    this.#emit();
    return true;
  }
}
