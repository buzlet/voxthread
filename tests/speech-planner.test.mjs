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

test('does not invent a period after terminal quote bracket emoji or locale punctuation', () => {
  const cases = [
    ['Он сказал «готово»', 'Продолжаем', 'Он сказал «готово» Продолжаем'],
    ['Ready)', 'Next', 'Ready) Next'],
    ['Готово 👍', 'Дальше', 'Готово 👍 Дальше'],
    ['終わり。', '次', '終わり。 次'],
    ['هل انتهينا؟', 'نعم', 'هل انتهينا؟ نعم'],
  ];

  for (const [left, right, expected] of cases) {
    const [segment] = planSpeech([
      m('10', { text: left }),
      m('11', { text: right }),
    ]);
    assert.equal(segment.text, expected);
  }
});

test('keeps existing sentence punctuation before closing quote', () => {
  const [segment] = planSpeech([
    m('12', { text: 'Он спросил: «Готов?»' }),
    m('13', { text: 'Да' }),
  ]);

  assert.equal(segment.text, 'Он спросил: «Готов?» Да');
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
