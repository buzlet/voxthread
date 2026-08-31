// tests/message-observer.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  TelegramMessageObserver,
  scrollTowardOlder,
} from '../src/telegram/message-observer.mjs';

function classList(...names) {
  const values = new Set(names);
  return { contains: name => values.has(name) };
}

function bubble(mid, text) {
  return {
    dataset: { mid, peerId: '10' },
    classList: classList('bubble', 'is-in', 'hide-name'),
    querySelector(selector) {
      if (selector === '.translatable-message') return { innerText: text };
      return null;
    },
  };
}

class FakeMutationObserver {
  static latest = null;

  constructor(callback) {
    this.callback = callback;
    this.observed = null;
    this.disconnected = false;
    FakeMutationObserver.latest = this;
  }

  observe(root, options) {
    this.observed = { root, options };
  }

  disconnect() {
    this.disconnected = true;
  }

  trigger() {
    this.callback([]);
  }
}

test('discovers initial messages and deduplicates later scans', () => {
  const nodes = [bubble('1', 'one'), bubble('2', 'two')];
  const batches = [];
  const root = {
    querySelectorAll() {
      return nodes;
    },
  };

  const observer = new TelegramMessageObserver({
    root,
    MutationObserverCtor: FakeMutationObserver,
    onMessages: messages => batches.push(messages.map(x => x.id)),
  });

  const initial = observer.start();
  assert.deepEqual(initial.map(x => x.id), ['1', '2']);
  assert.equal(observer.seenCount, 2);

  nodes.push(bubble('3', 'three'));
  FakeMutationObserver.latest.trigger();

  assert.deepEqual(batches, [['1', '2'], ['3']]);
  assert.equal(observer.seenCount, 3);
});

test('stop disconnects MutationObserver', () => {
  const root = { querySelectorAll: () => [] };
  const observer = new TelegramMessageObserver({
    root,
    MutationObserverCtor: FakeMutationObserver,
  });

  observer.start();
  const instance = FakeMutationObserver.latest;
  observer.stop();

  assert.equal(instance.disconnected, true);
});

test('scrollTowardOlder moves upward by viewport fraction', () => {
  const calls = [];
  const container = {
    scrollTop: 1000,
    clientHeight: 400,
    scrollTo(options) {
      calls.push(options);
      this.scrollTop = options.top;
    },
  };

  const result = scrollTowardOlder(container, { screens: 0.5 });

  assert.deepEqual(result, {
    before: 1000,
    after: 800,
    moved: true,
  });
  assert.equal(calls[0].top, 800);
});

test('can prime current DOM without emitting initial messages', () => {
  const nodes = [bubble('10', 'ten')];
  const batches = [];
  const root = { querySelectorAll: () => nodes };

  const observer = new TelegramMessageObserver({
    root,
    MutationObserverCtor: FakeMutationObserver,
    onMessages: messages => batches.push(messages.map(x => x.id)),
  });

  observer.start({ emitInitial: false });

  assert.deepEqual(batches, []);
  assert.equal(observer.seenCount, 1);

  nodes.push(bubble('11', 'eleven'));
  FakeMutationObserver.latest.trigger();

  assert.deepEqual(batches, [['11']]);
});

test('finds Telegram Web K bubbles scroll container', async () => {
  const { findTelegramMessageScroller } = await import(
    '../src/telegram/message-observer.mjs'
  );

  const expected = { id: 'scroller' };
  const root = {
    querySelector(selector) {
      return selector === '.bubbles-scrollable' ? expected : null;
    },
  };

  assert.equal(findTelegramMessageScroller(root), expected);
});

test('scrollTowardNewer moves toward scroll end without overshoot', async () => {
  const { scrollTowardNewer } = await import(
    '../src/telegram/message-observer.mjs'
  );

  const calls = [];
  const container = {
    scrollTop: 700,
    clientHeight: 400,
    scrollHeight: 1200,
    scrollTo(options) {
      calls.push(options);
      this.scrollTop = options.top;
    },
  };

  const result = scrollTowardNewer(container, { screens: 0.5 });

  assert.deepEqual(result, {
    before: 700,
    after: 800,
    moved: true,
  });
  assert.equal(calls[0].top, 800);
});
