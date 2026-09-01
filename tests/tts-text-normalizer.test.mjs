// tests/tts-text-normalizer.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeTelegramTextForSpeech,
  simplifyLinks,
} from '../src/core/tts-text-normalizer.mjs';

const entities = [
  { type: 'link', text: 'документация', href: 'https://example.com/very/long/path' },
  { type: 'mention', text: '@alice' },
  { type: 'hashtag', text: '#release' },
  { type: 'code', text: 'npm   test\n-- --watch' },
  { type: 'spoiler', text: 'секрет' },
  { type: 'quote', text: 'исходный текст' },
];

test('normalizes structured Telegram entities before speech segmentation', () => {
  const text = 'Смотри документация @alice #release npm   test\n-- --watch секрет исходный текст';
  assert.equal(
    normalizeTelegramTextForSpeech(text, { entities }),
    'Смотри example.com alice release npm test -- --watch секрет исходный текст',
  );
});

test('supports deterministic entity policies without leaking markup semantics', () => {
  const text = 'документация @alice #release npm   test\n-- --watch секрет исходный текст';
  assert.equal(
    normalizeTelegramTextForSpeech(text, {
      entities,
      linkMode: 'skip',
      mentionMode: 'verbatim',
      hashtagMode: 'verbatim',
      codeMode: 'skip',
      spoilerMode: 'skip',
      quoteMode: 'skip',
    }),
    '@alice #release',
  );
});

test('handles Telegram short links and trailing sentence punctuation', () => {
  assert.equal(
    simplifyLinks('join t.me/example, then https://www.example.org/a.', 'domain'),
    'join t.me, then example.org.',
  );
  assert.equal(
    simplifyLinks('join t.me/example, now', 'skip'),
    'join, now',
  );
});

test('falls back to mention and hashtag normalization when structured entities are absent', () => {
  assert.equal(
    normalizeTelegramTextForSpeech('Привет @alice, смотри #релиз'),
    'Привет alice, смотри релиз',
  );
});
