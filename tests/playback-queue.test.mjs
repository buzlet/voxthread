// tests/playback-queue.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { PlaybackQueue } from '../src/core/playback-queue.mjs';

const segments = [
  { messageIds: ['1'], text: 'one' },
  { messageIds: ['2', '3'], text: 'two three' },
  { messageIds: ['4'], text: 'four' },
];

test('loads and starts from requested message', () => {
  const q = new PlaybackQueue();
  q.load(segments, { startMessageId: '3' });

  assert.equal(q.status, 'ready');
  assert.equal(q.index, 1);
  assert.equal(q.current.text, 'two three');
});

test('loads after a completed read cursor', () => {
  const q = new PlaybackQueue();
  q.load(segments, { afterMessageId: '3' });

  assert.equal(q.status, 'ready');
  assert.equal(q.index, 2);
  assert.equal(q.current.text, 'four');
});

test('marks the queue completed when an after-cursor points at its final message', () => {
  const q = new PlaybackQueue();
  q.load(segments, { afterMessageId: '4' });

  assert.equal(q.status, 'completed');
  assert.equal(q.index, 2);
});

test('supports play pause resume and stop', () => {
  const q = new PlaybackQueue();
  q.load(segments);

  q.play();
  assert.equal(q.status, 'playing');

  q.pause();
  assert.equal(q.status, 'paused');

  q.resume();
  assert.equal(q.status, 'playing');

  q.stop();
  assert.equal(q.status, 'stopped');
  assert.equal(q.index, 0);
});

test('advances automatically while playing and completes', () => {
  const q = new PlaybackQueue();
  q.load(segments);
  q.play();

  q.advance();
  assert.equal(q.index, 1);
  assert.equal(q.status, 'playing');

  q.advance();
  assert.equal(q.index, 2);

  q.advance();
  assert.equal(q.status, 'completed');
  assert.equal(q.index, 2);
});

test('supports previous next and seek', () => {
  const q = new PlaybackQueue();
  q.load(segments);

  q.next();
  assert.equal(q.index, 1);

  q.previous();
  assert.equal(q.index, 0);

  assert.equal(q.seekToMessage('4'), true);
  assert.equal(q.index, 2);

  assert.equal(q.seekToMessage('missing'), false);
  assert.equal(q.index, 2);
});

test('emits immutable snapshots', () => {
  const seen = [];
  const q = new PlaybackQueue(snapshot => seen.push(snapshot));

  q.load(segments);
  q.play();

  assert.equal(seen.length, 2);
  assert.equal(Object.isFrozen(seen[0]), true);
  assert.equal(seen[1].status, 'playing');
});

test('append extends an active queue and resumes after completion point', () => {
  const q = new PlaybackQueue();
  q.load(segments.slice(0, 1));
  q.play();
  q.advance();

  assert.equal(q.status, 'completed');

  q.append(segments.slice(1));

  assert.equal(q.status, 'ready');
  assert.equal(q.index, 1);
  assert.equal(q.length, 3);
  assert.equal(q.current.text, 'two three');
});
