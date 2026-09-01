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
  assert.equal(q.index, 2);
  assert.equal(q.current.text, 'four');
});

test('marks queue completed when after-cursor points at final message', () => {
  const q = new PlaybackQueue();
  q.load(segments, { afterMessageId: '4' });
  assert.equal(q.status, 'completed');
});

test('supports play pause resume and stop', () => {
  const q = new PlaybackQueue();
  q.load(segments);
  q.play(); assert.equal(q.status, 'playing');
  q.pause(); assert.equal(q.status, 'paused');
  q.resume(); assert.equal(q.status, 'playing');
  q.stop(); assert.equal(q.status, 'stopped');
});

test('advances automatically while playing and completes', () => {
  const q = new PlaybackQueue();
  q.load(segments); q.play(); q.advance(); q.advance(); q.advance();
  assert.equal(q.status, 'completed');
  assert.equal(q.index, 2);
});

test('supports previous next and indexed seek', () => {
  const q = new PlaybackQueue();
  q.load(segments);
  q.next(); q.previous();
  assert.equal(q.seekToMessage('4'), true);
  assert.equal(q.index, 2);
  assert.equal(q.seekToMessage('missing'), false);
});

test('returns source message IDs for a merged segment', () => {
  const q = new PlaybackQueue();
  q.load(segments);
  assert.deepEqual(q.messageIdsFor('3'), ['2', '3']);
  assert.deepEqual(q.messageIdsFor('missing'), []);
});

test('replaces a pending merged segment after an edit', () => {
  const q = new PlaybackQueue();
  q.load(segments);
  const replacement = [
    { messageIds: ['2'], text: 'two edited' },
    { messageIds: ['3'], text: 'three' },
  ];
  assert.equal(q.replacePendingForMessage('3', replacement), true);
  assert.equal(q.length, 4);
  assert.equal(q.seekToMessage('2'), true);
  assert.equal(q.current.text, 'two edited');
  assert.equal(q.seekToMessage('3'), true);
  assert.equal(q.current.text, 'three');
});

test('removes a pending segment after confirmed deletion', () => {
  const q = new PlaybackQueue();
  q.load(segments);
  assert.equal(q.replacePendingForMessage('4', []), true);
  assert.equal(q.length, 2);
  assert.equal(q.seekToMessage('4'), false);
});

test('does not rewrite the segment currently being spoken', () => {
  const q = new PlaybackQueue();
  q.load(segments, { startMessageId: '2' });
  q.play();
  assert.equal(q.replacePendingForMessage('3', [{ messageIds: ['3'], text: 'new' }]), false);
  assert.equal(q.current.text, 'two three');
});

test('does not reopen a completed queue when its final segment changes', () => {
  const q = new PlaybackQueue();
  q.load(segments);
  q.play();
  q.advance();
  q.advance();
  q.advance();

  assert.equal(q.status, 'completed');
  assert.equal(q.current.text, 'four');
  assert.equal(q.replacePendingForMessage('4', []), false);
  assert.equal(q.status, 'completed');
  assert.equal(q.length, 3);
  assert.equal(q.current.text, 'four');
});

test('emits immutable snapshots', () => {
  const seen = [];
  const q = new PlaybackQueue(snapshot => seen.push(snapshot));
  q.load(segments); q.play();
  assert.equal(Object.isFrozen(seen[0]), true);
});

test('append extends an active queue and resumes after completion point', () => {
  const q = new PlaybackQueue();
  q.load(segments.slice(0, 1)); q.play(); q.advance();
  q.append(segments.slice(1));
  assert.equal(q.status, 'ready');
  assert.equal(q.index, 1);
  assert.equal(q.current.text, 'two three');
});
