// tests/message-cache.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeMessage } from '../src/core/message.mjs';
import { NormalizedMessageCache } from '../src/core/message-cache.mjs';

function message(id, {
  chatId = 'chat-1',
  text = `m${id}`,
  timestamp = Number(id),
  source = { id: `dom-${id}` },
} = {}) {
  return normalizeMessage({
    id,
    chatId,
    authorId: 'a1',
    authorName: 'Author',
    text,
    type: 'text',
    timestamp,
    source,
  });
}

test('stores detached normalized messages in chronological order', () => {
  const cache = new NormalizedMessageCache();
  cache.upsert([
    message('3', { timestamp: 30 }),
    message('1', { timestamp: 10 }),
    message('2', { timestamp: 20 }),
  ]);

  const snapshot = cache.getChat('chat-1');
  assert.deepEqual(snapshot.map(item => item.id), ['1', '2', '3']);
  assert.equal(snapshot.every(item => item.source === null), true);
});

test('updates an existing message without duplicating it', () => {
  const cache = new NormalizedMessageCache();
  assert.deepEqual(cache.upsert([message('1', { text: 'old' })]), {
    added: 1,
    updated: 0,
    unchanged: 0,
  });
  assert.deepEqual(cache.upsert([message('1', { text: 'new' })]), {
    added: 0,
    updated: 1,
    unchanged: 0,
  });

  assert.equal(cache.countForChat('chat-1'), 1);
  assert.equal(cache.get('chat-1', '1').text, 'new');
});

test('bounds messages per chat by recently observed working set', () => {
  const cache = new NormalizedMessageCache({ maxMessagesPerChat: 3 });
  cache.upsert([message('1'), message('2'), message('3')]);

  cache.upsert([message('1')]);
  cache.upsert([message('4')]);

  assert.equal(cache.countForChat('chat-1'), 3);
  assert.deepEqual(cache.getChat('chat-1').map(item => item.id), ['1', '3', '4']);
  assert.equal(cache.get('chat-1', '2'), null);
});

test('bounds number of chats using chat-level recency', () => {
  const cache = new NormalizedMessageCache({ maxChats: 2 });
  cache.upsert([message('1', { chatId: 'a' })]);
  cache.upsert([message('2', { chatId: 'b' })]);
  cache.getChat('a');
  cache.upsert([message('3', { chatId: 'c' })]);

  assert.equal(cache.chatCount, 2);
  assert.equal(cache.countForChat('a'), 1);
  assert.equal(cache.countForChat('b'), 0);
  assert.equal(cache.countForChat('c'), 1);
});

test('supports explicit deletion and clearing without persistent storage', () => {
  const cache = new NormalizedMessageCache();
  cache.upsert([message('1'), message('2')]);

  assert.equal(cache.remove('chat-1', '1'), true);
  assert.equal(cache.get('chat-1', '1'), null);
  assert.equal(cache.messageCount, 1);
  assert.equal(cache.clearChat('chat-1'), true);
  assert.equal(cache.messageCount, 0);
});
