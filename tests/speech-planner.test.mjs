// tests/speech-planner.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeMessage } from '../src/core/message.mjs';
import { planSpeech } from '../src/core/speech-planner.mjs';

function m(id, overrides = {}) {
  return normalizeMessage({
    id,
    chatId: '-10',
    authorId: '20',
    authorName: 'Алиса',
    text: `Сообщение ${id}`,
    type: 'text',
    ...overrides,
  });
}

test('merges adjacent messages from the same author', () => {
  const plan = planSpeech([m('1'), m('2')]);

  assert.equal(plan.length, 1);
  assert.deepEqual(plan[0].messageIds, ['1', '2']);
  assert.equal(plan[0].text, 'Сообщение 1. Сообщение 2');
});

test('starts a new segment when author changes', () => {
  const plan = planSpeech([
    m('1'),
    m('2', { authorId: '21', authorName: 'Боб' }),
  ]);

  assert.equal(plan.length, 2);
  assert.equal(plan[0].announceAuthor, true);
  assert.equal(plan[1].announceAuthor, true);
});

test('does not merge unrelated unknown authors', () => {
  const plan = planSpeech([
    m('1', { authorId: null, authorName: null }),
    m('2', { authorId: null, authorName: null }),
  ]);

  assert.equal(plan.length, 2);
});

test('filters service and empty messages', () => {
  const plan = planSpeech([
    m('1', { type: 'service' }),
    m('2', { text: '   ' }),
    m('3'),
  ]);

  assert.deepEqual(plan.map(x => x.messageIds), [['3']]);
});

test('can disable author announcements and merging', () => {
  const plan = planSpeech(
    [m('1'), m('2')],
    { mergeAdjacent: false, announceAuthors: false },
  );

  assert.equal(plan.length, 2);
  assert.equal(plan[0].announceAuthor, false);
  assert.equal(plan[1].announceAuthor, false);
});
