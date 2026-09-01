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

function bubble(mid, text, { chatId = '10', authorId = null, authorName = null } = {}) {
  const author = authorId || authorName
    ? { dataset: { peerId: authorId }, innerText: authorName }
    : null;
  return {
    dataset: { mid, peerId: chatId },
    classList: classList('bubble', 'is-in', author ? '' : 'hide-name'),
    matches(selector) {
      return selector === '.bubble[data-mid]';
    },
    querySelector(selector) {
      if (selector === '.translatable-message') return { innerText: text };
      if (selector === '.peer-title[data-peer-id]') return author;
      return null;
    },
    querySelectorAll() {
      return [];
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

  trigger(records = []) {
    this.callback(records);
  }
}

function addition(...nodes) {
  return [{ addedNodes: nodes }];
}

test('discovers initial messages and processes addedNodes without full rescan', () => {
  const nodes = [bubble('1', 'one'), bubble('2', 'two')];
  const batches = [];
  let queryCount = 0;
  const root = {
    querySelectorAll() {
      queryCount += 1;
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
  assert.equal(queryCount, 1);

  const third = bubble('3', 'three');
  nodes.push(third);
  FakeMutationObserver.latest.trigger(addition(third));

  assert.deepEqual(batches, [['1', '2'], ['3']]);
  assert.equal(queryCount, 1);
  assert.equal(observer.seenCount, 3);
});

test('periodic reconciliation recovers bubbles missing from mutation records', () => {
  const nodes = [bubble('10', 'ten')];
  const batches = [];
  const root = { querySelectorAll: () => nodes };
  const observer = new TelegramMessageObserver({
    root,
    MutationObserverCtor: FakeMutationObserver,
    reconcileEvery: 2,
    onMessages: messages => batches.push(messages.map(x => x.id)),
  });

  observer.start({ emitInitial: false });
  nodes.push(bubble('11', 'eleven'));
  FakeMutationObserver.latest.trigger([]);
  assert.deepEqual(batches, []);

  FakeMutationObserver.latest.trigger([]);
  assert.deepEqual(batches, [['11']]);
});

test('observer-owned author context survives virtualized incremental boundary', () => {
  const first = bubble('20', 'first', { authorId: '77', authorName: 'Автор', chatId: '-2' });
  const nodes = [first];
  const batches = [];
  const root = { querySelectorAll: () => nodes };
  const observer = new TelegramMessageObserver({
    root,
    MutationObserverCtor: FakeMutationObserver,
    onMessages: messages => batches.push(messages),
  });

  observer.start({ emitInitial: false });
  nodes.splice(0, nodes.length);
  const continuation = bubble('21', 'continued', { chatId: '-2' });
  nodes.push(continuation);
  FakeMutationObserver.latest.trigger(addition(continuation));

  assert.equal(batches.length, 1);
  assert.equal(batches[0][0].authorId, '77');
  assert.equal(batches[0][0].authorName, 'Автор');
  assert.equal(observer.authorContextSize, 1);
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
  const nodes = [bubble('30', 'thirty')];
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

  const next = bubble('31', 'thirty-one');
  nodes.push(next);
  FakeMutationObserver.latest.trigger(addition(next));

  assert.deepEqual(batches, [['31']]);
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
