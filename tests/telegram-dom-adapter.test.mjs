// tests/telegram-dom-adapter.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  extractTelegramBubble,
  extractTelegramBubbles,
  TelegramAuthorContext,
} from '../src/telegram/dom-adapter.mjs';

function fakeClassList(...values) {
  const set = new Set(values);
  return { contains: value => set.has(value) };
}

function makeBubble({
  mid,
  chatId = '-20',
  text = `M${mid}`,
  classes = ['is-in'],
  authorId = null,
  authorName = null,
}) {
  const author = authorId || authorName
    ? { dataset: { peerId: authorId }, innerText: authorName }
    : null;
  return {
    dataset: { mid, peerId: chatId },
    classList: fakeClassList('bubble', ...classes),
    querySelector(selector) {
      if (selector === '.translatable-message') return { innerText: text };
      if (selector === '.peer-title[data-peer-id]') return author;
      return null;
    },
  };
}

test('extracts Telegram bubble into normalized boundary', () => {
  const bubble = makeBubble({
    mid: '1001',
    chatId: '-2002',
    text: 'Привет',
    authorId: '77',
    authorName: 'Автор',
  });
  bubble.dataset.timestamp = '1780000100';

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

test('keeps grouped bubble author unresolved without context', () => {
  const message = extractTelegramBubble(makeBubble({
    mid: '1002',
    chatId: '-2002',
    text: 'Продолжение',
    classes: ['is-in', 'hide-name'],
  }));

  assert.equal(message.authorId, null);
  assert.equal(message.authorName, null);
  assert.equal(message.text, 'Продолжение');
});

test('rejects elements without Telegram message identifiers', () => {
  assert.equal(extractTelegramBubble({ dataset: {} }), null);
});

test('recovers author across grouped inbound bubbles in one scan', () => {
  const messages = extractTelegramBubbles([
    makeBubble({ mid: '10', authorId: '77', authorName: 'Автор' }),
    makeBubble({ mid: '11', classes: ['is-in', 'hide-name'] }),
  ]);

  assert.equal(messages[1].authorId, '77');
  assert.equal(messages[1].authorName, 'Автор');
});

test('persists author context across virtualized scan boundary', () => {
  const context = new TelegramAuthorContext();

  extractTelegramBubbles([
    makeBubble({ mid: '30', authorId: '77', authorName: 'Автор' }),
  ], { authorContext: context });

  const [continuation] = extractTelegramBubbles([
    makeBubble({ mid: '31', classes: ['is-in', 'hide-name'] }),
  ], { authorContext: context });

  assert.equal(continuation.authorId, '77');
  assert.equal(continuation.authorName, 'Автор');
  assert.equal(context.size, 1);
});

test('infers inbound private-chat author from positive chat id', () => {
  const [message] = extractTelegramBubbles([
    makeBubble({
      mid: '12',
      chatId: '99',
      text: 'Привет',
      classes: ['is-in', 'hide-name'],
    }),
  ]);

  assert.equal(message.authorId, '99');
  assert.equal(message.authorName, null);
});

test('does not carry inbound author across outgoing bubble', () => {
  const context = new TelegramAuthorContext();
  const messages = extractTelegramBubbles([
    makeBubble({ mid: '20', authorId: '77', authorName: 'Автор' }),
    makeBubble({ mid: '21', classes: ['is-out'] }),
    makeBubble({ mid: '22', classes: ['is-in', 'hide-name'] }),
  ], { authorContext: context });

  assert.equal(messages[2].authorId, null);
  assert.equal(messages[2].authorName, null);
  assert.equal(context.size, 0);
});
