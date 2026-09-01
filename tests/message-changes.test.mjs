// tests/message-changes.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { TelegramMessageObserver } from '../src/telegram/message-observer.mjs';

function classList(...names) {
  const set = new Set(names);
  return { contains: name => set.has(name) };
}

function bubble(mid, text, { deleted = false } = {}) {
  const node = {
    nodeType: 1,
    dataset: { mid, peerId: '-20', ...(deleted ? { deleted: 'true' } : {}) },
    classList: classList('bubble', 'is-in'),
    text,
    matches(selector) { return selector === '.bubble[data-mid]'; },
    closest(selector) { return selector === '.bubble[data-mid]' ? this : null; },
    querySelector(selector) {
      if (selector === '.translatable-message') {
        return { innerText: this.text, querySelectorAll: () => [] };
      }
      if (selector === '.peer-title[data-peer-id]') {
        return { dataset: { peerId: '77' }, innerText: 'Author' };
      }
      return null;
    },
    querySelectorAll() { return []; },
  };
  return node;
}

class FakeMutationObserver {
  static latest;
  constructor(callback) { this.callback = callback; FakeMutationObserver.latest = this; }
  observe() {}
  disconnect() {}
  trigger(records) { this.callback(records); }
}

test('emits same-ID content changes as updates rather than new messages', () => {
  const node = bubble('1', 'old');
  const changes = [];
  const batches = [];
  const observer = new TelegramMessageObserver({
    root: { querySelectorAll: () => [node] },
    MutationObserverCtor: FakeMutationObserver,
    onMessages: messages => batches.push(messages.map(message => message.id)),
    onChanges: items => changes.push(...items),
  });

  observer.start({ emitInitial: false });
  node.text = 'edited';
  FakeMutationObserver.latest.trigger([{ target: node, addedNodes: [] }]);

  assert.deepEqual(batches, []);
  assert.equal(changes.length, 1);
  assert.equal(changes[0].type, 'updated');
  assert.equal(changes[0].message.id, '1');
  assert.equal(changes[0].message.text, 'edited');
});

test('emits deletion only for an explicit Telegram deletion tombstone', () => {
  const changes = [];
  const observer = new TelegramMessageObserver({
    root: { querySelectorAll: () => [] },
    MutationObserverCtor: FakeMutationObserver,
    onChanges: items => changes.push(...items),
  });
  observer.start({ emitInitial: false });

  const deleted = bubble('2', '', { deleted: true });
  FakeMutationObserver.latest.trigger([{ target: deleted, addedNodes: [deleted] }]);

  assert.deepEqual(changes, [{ type: 'deleted', chatId: '-20', messageId: '2' }]);
});

test('removedNodes alone are not interpreted as deletion because Telegram virtualizes DOM', () => {
  const changes = [];
  const observer = new TelegramMessageObserver({
    root: { querySelectorAll: () => [] },
    MutationObserverCtor: FakeMutationObserver,
    onChanges: items => changes.push(...items),
  });
  observer.start({ emitInitial: false });
  FakeMutationObserver.latest.trigger([{ target: {}, addedNodes: [], removedNodes: [bubble('3', 'old')] }]);
  assert.deepEqual(changes, []);
});
