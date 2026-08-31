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

test('long segment is chunked without advancing the queue early', () => {
  const queue = new PlaybackQueue();
  const longText = [
    'Первое длинное предложение предназначено для проверки.',
    'Второе длинное предложение остается в том же сообщении.',
    'Третье длинное предложение завершает этот фрагмент.',
  ].join(' ');

  queue.load([
    { ...segments[0], text: longText },
    segments[1],
  ]);

  const synth = makeSynth();
  const player = new WebSpeechPlayer({
    queue,
    speechSynthesis: synth,
    Utterance: FakeUtterance,
    maxUtteranceChars: 80,
  });

  player.play();

  assert.ok(player.chunkCount > 1);
  assert.equal(queue.index, 0);
  assert.ok(synth.spoken[0].text.length <= 80);

  while (queue.index === 0) {
    synth.spoken.at(-1).onend();
  }

  assert.equal(queue.index, 1);
  assert.equal(synth.spoken.at(-1).text, 'Боб. Пока');
});

test('speech error retries the same chunk instead of restarting the segment', () => {
  const queue = new PlaybackQueue();
  const longText = [
    'Первое длинное предложение предназначено для проверки.',
    'Второе длинное предложение остается в том же сообщении.',
    'Третье длинное предложение завершает этот фрагмент.',
  ].join(' ');

  queue.load([{ ...segments[0], text: longText }]);

  const synth = makeSynth();
  const player = new WebSpeechPlayer({
    queue,
    speechSynthesis: synth,
    Utterance: FakeUtterance,
    maxUtteranceChars: 80,
  });

  player.play();
  synth.spoken[0].onend();

  const failedText = synth.spoken.at(-1).text;
  const failedChunk = player.chunkIndex;

  synth.spoken.at(-1).onerror({ error: 'interrupted' });

  assert.equal(queue.status, 'paused');
  assert.equal(player.chunkIndex, failedChunk);

  player.resume();

  assert.equal(queue.status, 'playing');
  assert.equal(player.chunkIndex, failedChunk);
  assert.equal(synth.spoken.at(-1).text, failedText);
});

test('honors pauseAfterMs between queue segments', async () => {
  const queue = new PlaybackQueue();
  queue.load([
    { ...segments[0], pauseAfterMs: 30 },
    segments[1],
  ]);

  const synth = makeSynth();
  const player = new WebSpeechPlayer({
    queue,
    speechSynthesis: synth,
    Utterance: FakeUtterance,
  });

  player.play();
  synth.spoken[0].onend();

  assert.equal(queue.index, 0);
  assert.equal(synth.spoken.length, 1);

  await new Promise(resolve => setTimeout(resolve, 45));

  assert.equal(queue.index, 1);
  assert.equal(synth.spoken.length, 2);
});

test('pause during inter-segment delay waits until resume', async () => {
  const queue = new PlaybackQueue();
  queue.load([
    { ...segments[0], pauseAfterMs: 35 },
    segments[1],
  ]);

  const synth = makeSynth();
  const player = new WebSpeechPlayer({
    queue,
    speechSynthesis: synth,
    Utterance: FakeUtterance,
  });

  player.play();
  synth.spoken[0].onend();
  player.pause();

  await new Promise(resolve => setTimeout(resolve, 50));

  assert.equal(queue.status, 'paused');
  assert.equal(queue.index, 0);
  assert.equal(synth.spoken.length, 1);

  player.resume();

  assert.equal(queue.status, 'playing');
  assert.equal(queue.index, 1);
  assert.equal(synth.spoken.length, 2);
});

test('next while paused starts selected segment on resume', () => {
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
  player.next();

  assert.equal(queue.status, 'paused');
  assert.equal(queue.index, 1);

  player.resume();

  assert.equal(queue.status, 'playing');
  assert.equal(synth.spoken.at(-1).text, 'Боб. Пока');
});
