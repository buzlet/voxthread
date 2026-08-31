// tests/text-chunks.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { splitSpeechText } from '../src/tts/text-chunks.mjs';

test('keeps short speech in one chunk', () => {
  assert.deepEqual(
    splitSpeechText('Короткое сообщение.'),
    ['Короткое сообщение.'],
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
