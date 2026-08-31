// tests/browser-fixture.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { JSDOM } from 'jsdom';

import { extractTelegramBubbles } from '../src/telegram/dom-adapter.mjs';
import { planSpeech } from '../src/core/speech-planner.mjs';

test('sanitized Telegram group fixture survives adapter and planner', async () => {
  const html = await fs.readFile(
    new URL('./fixtures/telegram-group-basic.html', import.meta.url),
    'utf8',
  );

  const dom = new JSDOM(html);
  const bubbles = [
    ...dom.window.document.querySelectorAll('.bubble[data-mid]'),
  ];

  const messages = extractTelegramBubbles(bubbles);

  assert.equal(messages.length, 3);
  assert.equal(messages[0].authorId, '77');
  assert.equal(messages[1].authorId, '77');
  assert.equal(messages[1].authorName, 'Алиса');
  assert.equal(messages[2].authorId, '88');

  const plan = planSpeech(messages);

  assert.equal(plan.length, 2);
  assert.deepEqual(plan[0].messageIds, ['1001', '1002']);
  assert.equal(plan[0].authorName, 'Алиса');
  assert.equal(plan[1].authorName, 'Боб');
  assert.equal(plan[1].text, 'Ссылка example.com');
});
