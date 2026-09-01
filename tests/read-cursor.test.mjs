// tests/read-cursor.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { ReadCursorStore } from '../src/core/read-cursor.mjs';

function memoryStorage() {
  const values = new Map();
  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, String(value));
    },
    removeItem(key) {
      values.delete(key);
    },
  };
}

test('stores only resume metadata per chat', () => {
  const store = new ReadCursorStore(memoryStorage());

  store.set('-100', '42', { position: 'at', updatedAt: 10 });
  store.set('-200', '99', { position: 'after', updatedAt: 20 });

  assert.deepEqual(store.get('-100'), {
    chatId: '-100',
    messageId: '42',
    position: 'at',
    updatedAt: 10,
  });
  assert.deepEqual(store.get('-200'), {
    chatId: '-200',
    messageId: '99',
    position: 'after',
    updatedAt: 20,
  });
  assert.equal(store.count, 2);
});

test('prunes oldest chat cursors without storing message text', () => {
  const storage = memoryStorage();
  const store = new ReadCursorStore(storage, 'cursor', { maxEntries: 2 });

  store.set('a', '1', { updatedAt: 1 });
  store.set('b', '2', { updatedAt: 2 });
  store.set('c', '3', { updatedAt: 3 });

  assert.equal(store.get('a'), null);
  assert.equal(store.get('b').messageId, '2');
  assert.equal(store.get('c').messageId, '3');
  assert.equal(storage.getItem('cursor').includes('message text'), false);
});

test('tolerates malformed storage and supports clearing one chat', () => {
  const storage = memoryStorage();
  storage.setItem('cursor', '{broken');
  const store = new ReadCursorStore(storage, 'cursor');

  assert.equal(store.get('chat'), null);
  store.set('chat', '7');
  assert.equal(store.clear('chat'), true);
  assert.equal(store.get('chat'), null);
});
