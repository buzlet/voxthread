// tests/content-policy.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isEmojiOnly,
  prepareMessageForSpeech,
  simplifyLinks,
} from '../src/core/content-policy.mjs';

test('simplifies long URLs to their domain', () => {
  assert.equal(
    simplifyLinks('Смотри https://example.com/path?q=1 пожалуйста'),
    'Смотри example.com пожалуйста',
  );
});

test('can omit URLs completely', () => {
  assert.equal(
    simplifyLinks('Смотри https://example.com/path пожалуйста', 'skip'),
    'Смотри пожалуйста',
  );
});

test('detects emoji-only messages', () => {
  assert.equal(isEmojiOnly('😀 👍'), true);
  assert.equal(isEmojiOnly('Спасибо 👍'), false);
});

test('skips service and emoji-only messages by default', () => {
  assert.equal(prepareMessageForSpeech({
    type: 'service',
    text: 'joined',
  }), null);

  assert.equal(prepareMessageForSpeech({
    type: 'text',
    text: '😀😀',
  }), null);
});

test('can announce media-only messages by policy', () => {
  const result = prepareMessageForSpeech({
    type: 'media',
    text: '',
    media: { kind: 'photo' },
  }, {
    announceMedia: true,
    mediaLabels: { photo: 'Фото' },
  });

  assert.equal(result.text, 'Фото');
});

test('does not add reply or forward boilerplate by default', () => {
  const result = prepareMessageForSpeech({
    type: 'text',
    text: 'Ответ',
    replyToId: '10',
    forwardedFrom: 'Someone',
  });

  assert.equal(result.text, 'Ответ');
});
