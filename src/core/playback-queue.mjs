// src/core/playback-queue.mjs

export class PlaybackQueue {
  #segments = [];
  #index = -1;
  #status = 'empty';

  constructor(onChange = null) {
    this.onChange = typeof onChange === 'function' ? onChange : null;
  }

  get status() {
    return this.#status;
  }

  get index() {
    return this.#index;
  }

  get length() {
    return this.#segments.length;
  }

  get current() {
    return this.#segments[this.#index] ?? null;
  }

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

  load(segments, { startMessageId = null } = {}) {
    this.#segments = [...segments];
    this.#index = this.#segments.length ? 0 : -1;
    this.#status = this.#segments.length ? 'ready' : 'empty';

    if (startMessageId !== null) {
      const found = this.#segments.findIndex(segment =>
        segment.messageIds?.includes?.(String(startMessageId))
      );
      if (found >= 0) this.#index = found;
    }

    return this.#emit();
  }

  append(segments) {
    const items = [...segments];
    if (!items.length) return this.#emit();

    const oldLength = this.#segments.length;
    this.#segments.push(...items);

    if (oldLength === 0) {
      this.#index = 0;
      this.#status = 'ready';
    } else if (this.#status === 'completed') {
      this.#index = oldLength;
      this.#status = 'ready';
    }

    return this.#emit();
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

    if (this.#index < this.#segments.length - 1) {
      this.#index += 1;
    } else {
      this.#status = 'completed';
    }

    return this.#emit();
  }

  seekToMessage(messageId) {
    const target = String(messageId);
    const found = this.#segments.findIndex(segment =>
      segment.messageIds?.includes?.(target)
    );

    if (found < 0) return false;

    this.#index = found;
    if (this.#status === 'completed' || this.#status === 'stopped') {
      this.#status = 'ready';
    }
    this.#emit();
    return true;
  }
}
