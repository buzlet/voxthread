// tests/voice-map.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createVoiceResolver,
  inferLanguageHint,
  prosodyForAuthor,
  resolveLanguageHint,
  selectVoice,
} from '../src/tts/voice-map.mjs';

const voices = [
  { name: 'RU A', voiceURI: 'ru-a', lang: 'ru-RU' },
  { name: 'RU B', voiceURI: 'ru-b', lang: 'ru-RU' },
  { name: 'UK A', voiceURI: 'uk-a', lang: 'uk-UA' },
  { name: 'EN A', voiceURI: 'en-a', lang: 'en-US' },
];

test('selectVoice is deterministic for the same author', () => {
  const first = selectVoice({ authorKey: 'id:10', voices, languageHint: 'ru-RU' });
  const second = selectVoice({ authorKey: 'id:10', voices, languageHint: 'ru' });
  assert.equal(first.voiceURI, second.voiceURI);
  assert.match(first.lang, /^ru/i);
});

test('selectVoice honors explicit voice override', () => {
  const voice = selectVoice({
    authorKey: 'id:10', voices, languageHint: 'ru', overrides: { 'id:10': 'en-a' },
  });
  assert.equal(voice.voiceURI, 'en-a');
});

test('selectVoice returns null when browser exposes no voices', () => {
  assert.equal(selectVoice({ authorKey: 'id:10', voices: [] }), null);
});

test('prosody fallback is stable and bounded', () => {
  const a = prosodyForAuthor('id:10');
  assert.deepEqual(a, prosodyForAuthor('id:10'));
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

test('language inference uses script proportions and ignores technical noise', () => {
  assert.equal(inferLanguageHint('Привет, как дела?'), 'ru-RU');
  assert.equal(inferLanguageHint('Привіт, як справи?'), 'uk-UA');
  assert.equal(inferLanguageHint('Hello there, how are you?'), 'en-US');
  assert.equal(inferLanguageHint('Привет OpenAI'), 'ru-RU');
  assert.equal(inferLanguageHint('Привет https://example.com/OpenAI'), 'ru-RU');
  assert.equal(inferLanguageHint('OK'), null);
  assert.equal(inferLanguageHint('123 😀'), null);
});

test('mixed text does not switch language without sufficient dominance', () => {
  assert.equal(inferLanguageHint('Привет hello world'), null);
  assert.equal(
    inferLanguageHint('Привет hello world', { preferredLanguage: 'uk-UA' }),
    'uk-UA',
  );
});

test('segment language preference precedence is manual author then author then chat', () => {
  const segment = { authorKey: 'id:7', chatId: '-20', text: 'Hello there' };
  const preferences = {
    manualOverrides: { 'id:7': 'uk-UA' },
    authorPreferences: { 'id:7': 'ru-RU' },
    chatPreferences: { '-20': 'en-US' },
  };
  assert.equal(resolveLanguageHint(segment, preferences), 'uk-UA');

  delete preferences.manualOverrides['id:7'];
  assert.equal(resolveLanguageHint(segment, preferences), 'en-US');

  segment.text = 'OK';
  assert.equal(resolveLanguageHint(segment, preferences), 'ru-RU');
});

test('chat preference resolves ambiguous Cyrillic without overriding clear language', () => {
  const preferences = { chatPreferences: { '-20': 'uk-UA' } };
  assert.equal(resolveLanguageHint({
    authorKey: 'id:1', chatId: '-20', text: 'Добрий день, друзі',
  }, preferences), 'uk-UA');
  assert.equal(resolveLanguageHint({
    authorKey: 'id:1', chatId: '-20', text: 'Hello everyone, this is English text',
  }, preferences), 'en-US');
});
