// tests/web-speech-player.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { PlaybackQueue } from '../src/core/playback-queue.mjs';
import { WebSpeechPlayer } from '../src/tts/web-speech-player.mjs';

class FakeUtterance {
  constructor(text) {
    this.text = text;
    this.onend = null;
    this.onerror = null;
  }
}

function makeSynth() {
  return {
    spoken: [],
    paused: false,
    cancelled: 0,
    speak(utterance) {
      this.spoken.push(utterance);
    },
    cancel() {
      this.cancelled += 1;
    },
    pause() {
      this.paused = true;
    },
    resume() {
      this.paused = false;
    },
  };
}

const segments = [
  {
    messageIds: ['1'],
    text: 'Привет',
    authorName: 'Алиса',
    announceAuthor: true,
  },
  {
    messageIds: ['2'],
    text: 'Пока',
    authorName: 'Боб',
    announceAuthor: true,
  },
];

test('speaks current segment and advances on end', () => {
  const queue = new PlaybackQueue();
  queue.load(segments);
  const synth = makeSynth();
  const player = new WebSpeechPlayer({
    queue,
    speechSynthesis: synth,
    Utterance: FakeUtterance,
  });

  player.play();

  assert.equal(synth.spoken[0].text, 'Алиса. Привет');
  synth.spoken[0].onend();

  assert.equal(queue.index, 1);
  assert.equal(synth.spoken[1].text, 'Боб. Пока');

  synth.spoken[1].onend();
  assert.equal(queue.status, 'completed');
});

test('pause resume and stop delegate to browser and queue', () => {
  const queue = new PlaybackQueue();
  queue.load(segments);
  const synth = makeSynth();
  const player = new WebSpeechPlayer({
    queue,
    speechSynthesis: synth,
    Utterance: FakeUtterance,
  });

  player.play();
  player.pause();
  assert.equal(queue.status, 'paused');
  assert.equal(synth.paused, true);

  player.resume();
  assert.equal(queue.status, 'playing');
  assert.equal(synth.paused, false);

  player.stop();
  assert.equal(queue.status, 'stopped');
  assert.ok(synth.cancelled >= 2);
});

test('next while playing cancels and speaks next segment', () => {
  const queue = new PlaybackQueue();
  queue.load(segments);
  const synth = makeSynth();
  const player = new WebSpeechPlayer({
    queue,
    speechSynthesis: synth,
    Utterance: FakeUtterance,
  });

  player.play();
  const stale = synth.spoken[0];
  player.next();

  assert.equal(queue.index, 1);
  assert.equal(synth.spoken.at(-1).text, 'Боб. Пока');

  stale.onend();
  assert.equal(queue.index, 1);
});


test('speech error pauses without skipping current segment and resume retries it', () => {
  const queue = new PlaybackQueue();
  queue.load(segments);
  const synth = makeSynth();
  const player = new WebSpeechPlayer({
    queue,
    speechSynthesis: synth,
    Utterance: FakeUtterance,
  });

  player.play();
  const failed = synth.spoken[0];
  failed.onerror({ error: 'synthesis-failed' });

  assert.equal(queue.status, 'paused');
  assert.equal(queue.index, 0);
  assert.equal(player.lastError, 'synthesis-failed');
  assert.equal(synth.spoken.length, 1);

  player.resume();

  assert.equal(queue.status, 'playing');
  assert.equal(queue.index, 0);
  assert.equal(synth.spoken.length, 2);
  assert.equal(synth.spoken[1].text, 'Алиса. Привет');

  synth.spoken[1].onend();
  assert.equal(queue.index, 1);
  assert.equal(player.lastError, null);
});

test('ordinary pause and resume does not restart the current utterance', () => {
  const queue = new PlaybackQueue();
  queue.load(segments);
  const synth = makeSynth();
  const player = new WebSpeechPlayer({
    queue,
    speechSynthesis: synth,
    Utterance: FakeUtterance,
  });

  player.play();
  player.pause();
  player.resume();

  assert.equal(synth.spoken.length, 1);
  assert.equal(synth.paused, false);
});
