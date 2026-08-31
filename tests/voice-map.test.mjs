// tests/voice-map.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createVoiceResolver,
  prosodyForAuthor,
  selectVoice,
} from '../src/tts/voice-map.mjs';

const voices = [
  { name: 'RU A', voiceURI: 'ru-a', lang: 'ru-RU' },
  { name: 'RU B', voiceURI: 'ru-b', lang: 'ru-RU' },
  { name: 'EN A', voiceURI: 'en-a', lang: 'en-US' },
];

test('selectVoice is deterministic for the same author', () => {
  const first = selectVoice({
    authorKey: 'id:10',
    voices,
    languageHint: 'ru-RU',
  });
  const second = selectVoice({
    authorKey: 'id:10',
    voices,
    languageHint: 'ru',
  });

  assert.equal(first.voiceURI, second.voiceURI);
  assert.match(first.lang, /^ru/i);
});

test('selectVoice honors explicit override', () => {
  const voice = selectVoice({
    authorKey: 'id:10',
    voices,
    languageHint: 'ru',
    overrides: { 'id:10': 'en-a' },
  });

  assert.equal(voice.voiceURI, 'en-a');
});

test('selectVoice returns null when browser exposes no voices', () => {
  assert.equal(selectVoice({
    authorKey: 'id:10',
    voices: [],
  }), null);
});

test('prosody fallback is stable and bounded', () => {
  const a = prosodyForAuthor('id:10');
  const b = prosodyForAuthor('id:10');

  assert.deepEqual(a, b);
  assert.ok(a.rate >= 0.96 && a.rate <= 1.04);
  assert.ok(a.pitch >= 0.94 && a.pitch <= 1.06);
});

test('createVoiceResolver reads the current browser voice list', () => {
  let current = [];
  const resolve = createVoiceResolver({
    getVoices: () => current,
    languageForSegment: () => 'en-US',
  });

  assert.equal(resolve({ authorKey: 'id:1' }), null);

  current = voices;
  assert.equal(resolve({ authorKey: 'id:1' }).lang, 'en-US');
});

test('inferLanguageHint distinguishes common VoxThread languages', async () => {
  const { inferLanguageHint } = await import('../src/tts/voice-map.mjs');

  assert.equal(inferLanguageHint('Привет, как дела?'), 'ru-RU');
  assert.equal(inferLanguageHint('Привіт, як справи?'), 'uk-UA');
  assert.equal(inferLanguageHint('Hello there'), 'en-US');
  assert.equal(inferLanguageHint('123 😀'), null);
});
