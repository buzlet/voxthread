// tests/text-chunks.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  segmentSpeechSentences,
  splitSpeechText,
} from '../src/tts/text-chunks.mjs';

class DeliberatelyBadSegmenter {
  constructor() {}
  segment() {
    return [
      { segment: 'т.' },
      { segment: 'е. мы идем. ' },
      { segment: 'Следующее предложение.' },
    ];
  }
}

class DomainBreakingSegmenter {
  constructor() {}
  segment() {
    return [
      { segment: 'Смотри example.' },
      { segment: 'com/path дальше.' },
    ];
  }
}

test('keeps short speech in one chunk', () => {
  assert.deepEqual(
    splitSpeechText('Короткое сообщение.'),
    ['Короткое сообщение.'],
  );
});

test('uses Segmenter baseline but repairs Telegram-style abbreviation boundaries', () => {
  assert.deepEqual(
    segmentSpeechSentences('ignored fixture text', {
      SegmenterCtor: DeliberatelyBadSegmenter,
      locale: 'ru',
    }),
    ['т. е. мы идем.', 'Следующее предложение.'],
  );
});

test('repairs false domain boundary after segmentation', () => {
  assert.deepEqual(
    segmentSpeechSentences('ignored fixture text', {
      SegmenterCtor: DomainBreakingSegmenter,
    }),
    ['Смотри example. com/path дальше.'],
  );
});

test('has deterministic fallback when Intl.Segmenter is unavailable', () => {
  assert.deepEqual(
    segmentSpeechSentences('Первое. Второе! ثالث؟ 終わり。', { SegmenterCtor: null }),
    ['Первое.', 'Второе!', 'ثالث؟', '終わり。'],
  );
});

test('splits long speech near sentence boundaries', () => {
  const text = [
    'Первое предложение достаточно длинное.',
    'Второе предложение тоже не совсем короткое.',
    'Третье предложение завершает тест.',
  ].join(' ');

  const chunks = splitSpeechText(text, { maxChars: 80 });

  assert.ok(chunks.length > 1);
  assert.ok(chunks.every(chunk => chunk.length <= 80));
  assert.equal(chunks.join(' '), text);
});

test('hard-wraps a single oversized sentence without losing text', () => {
  const words = Array.from({ length: 40 }, (_, i) => `слово${i + 1}`);
  const text = words.join(' ');

  const chunks = splitSpeechText(text, { maxChars: 90 });

  assert.ok(chunks.length > 2);
  assert.ok(chunks.every(chunk => chunk.length <= 90));
  assert.equal(chunks.join(' '), text);
});

test('empty speech produces no chunks', () => {
  assert.deepEqual(splitSpeechText('   '), []);
});
