// tests/telegram-dom-adapter.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { extractTelegramBubble } from '../src/telegram/dom-adapter.mjs';

function fakeClassList(...values) {
  const set = new Set(values);
  return { contains: value => set.has(value) };
}

test('extracts Telegram bubble into normalized boundary', () => {
  const text = { innerText: 'Привет' };
  const author = {
    dataset: { peerId: '77' },
    innerText: 'Автор',
  };

  const bubble = {
    dataset: {
      mid: '1001',
      peerId: '-2002',
      timestamp: '1780000100',
    },
    classList: fakeClassList('bubble', 'is-in'),
    querySelector(selector) {
      if (selector === '.translatable-message') return text;
      if (selector === '.peer-title[data-peer-id]') return author;
      return null;
    },
  };

  const message = extractTelegramBubble(bubble);

  assert.equal(message.id, '1001');
  assert.equal(message.chatId, '-2002');
  assert.equal(message.authorId, '77');
  assert.equal(message.authorName, 'Автор');
  assert.equal(message.text, 'Привет');
  assert.equal(message.type, 'text');
  assert.equal(message.outgoing, false);
  assert.equal(message.source, bubble);
});

test('keeps grouped bubble author unresolved', () => {
  const bubble = {
    dataset: { mid: '1002', peerId: '-2002' },
    classList: fakeClassList('bubble', 'hide-name'),
    querySelector(selector) {
      if (selector === '.translatable-message') return { textContent: 'Продолжение' };
      return null;
    },
  };

  const message = extractTelegramBubble(bubble);

  assert.equal(message.authorId, null);
  assert.equal(message.authorName, null);
  assert.equal(message.text, 'Продолжение');
});

test('rejects elements without Telegram message identifiers', () => {
  assert.equal(extractTelegramBubble({ dataset: {} }), null);
});
