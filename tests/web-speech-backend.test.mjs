// tests/web-speech-backend.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { WebSpeechBackend } from '../src/tts/web-speech-backend.mjs';
import { PlaybackQueue } from '../src/core/playback-queue.mjs';

class FakeUtterance {
  constructor(text) {
    this.text = text;
    this.onend = null;
    this.onerror = null;
    this.rate = 1;
    this.pitch = 1;
  }
}

function fakeSynth(voices = []) {
  const listeners = new Map();
  return {
    spoken: [],
    speaking: false,
    pending: false,
    paused: false,
    getVoices: () => voices,
    speak(utterance) {
      this.spoken.push(utterance);
      this.speaking = true;
    },
    cancel() {
      this.speaking = false;
    },
    pause() {
      this.paused = true;
    },
    resume() {
      this.paused = false;
    },
    addEventListener(type, listener) {
      listeners.set(type, listener);
    },
    removeEventListener(type, listener) {
      if (listeners.get(type) === listener) listeners.delete(type);
    },
    emit(type) {
      listeners.get(type)?.();
    },
  };
}

test('backend owns Web Speech objects and creates a playback provider', () => {
  const synth = fakeSynth([
    { voiceURI: 'en', name: 'English', lang: 'en-US', localService: true },
  ]);
  const backend = new WebSpeechBackend({
    speechSynthesis: synth,
    Utterance: FakeUtterance,
  });
  const queue = new PlaybackQueue();
  queue.load([{
    authorKey: 'alice',
    authorName: 'Alice',
    text: 'Hello from the backend boundary.',
    announceAuthor: false,
    messageIds: ['1'],
  }]);

  const player = backend.createPlayer({ queue });
  player.play();

  assert.equal(synth.spoken.length, 1);
  assert.equal(synth.spoken[0].voice?.voiceURI, 'en');
  assert.equal(backend.diagnostics(player).provider, 'web-speech');
});

test('backend exposes normalized language-compatible voices', () => {
  const backend = new WebSpeechBackend({
    speechSynthesis: fakeSynth([
      { voiceURI: 'en', name: 'English', lang: 'en-US' },
      { voiceURI: 'ru', name: 'Russian', lang: 'ru-RU' },
    ]),
    Utterance: FakeUtterance,
  });

  const voices = backend.listVoices({ text: 'Привет, мир' });
  assert.deepEqual(voices.map(voice => voice.id), ['ru']);
  assert.equal(voices[0].native.voiceURI, 'ru');
});

test('backend owns provider-specific voice change events', () => {
  const synth = fakeSynth();
  const backend = new WebSpeechBackend({
    speechSynthesis: synth,
    Utterance: FakeUtterance,
  });
  let calls = 0;
  const unsubscribe = backend.onVoicesChanged(() => calls += 1);

  synth.emit('voiceschanged');
  unsubscribe();
  synth.emit('voiceschanged');

  assert.equal(calls, 1);
});
