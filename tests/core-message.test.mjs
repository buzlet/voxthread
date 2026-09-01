// tests/core-message.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeMessage } from '../src/core/message.mjs';

test('normalizes identifiers, text and timestamp', () => {
  const message = normalizeMessage({
    id: 123,
    chatId: -456,
    authorId: 789,
    authorName: '  Alice  ',
    text: ' first  \n\n\n second ',
    type: 'text',
    timestamp: '1780000000',
  });

  assert.equal(message.id, '123');
  assert.equal(message.chatId, '-456');
  assert.equal(message.authorId, '789');
  assert.equal(message.authorName, 'Alice');
  assert.equal(message.text, 'first\n\nsecond');
  assert.equal(message.timestamp, 1780000000);
});

test('allows missing author for grouped Telegram bubbles', () => {
  const message = normalizeMessage({
    id: '1',
    chatId: '2',
    text: 'Hello',
    type: 'text',
  });

  assert.equal(message.authorId, null);
  assert.equal(message.authorName, null);
});

test('keeps missing entity occurrence null and explicit zero intact', () => {
  const message = normalizeMessage({
    id: '3',
    chatId: '4',
    text: 'code code',
    type: 'text',
    entities: [
      { type: 'code', text: 'code', occurrence: null },
      { type: 'code', text: 'code', occurrence: 0 },
    ],
  });

  assert.equal(message.entities[0].occurrence, null);
  assert.equal(message.entities[1].occurrence, 0);
});

test('requires stable message and chat identifiers', () => {
  assert.throws(() => normalizeMessage({ chatId: '2' }), /id is required/);
  assert.throws(() => normalizeMessage({ id: '1' }), /chatId is required/);
});
