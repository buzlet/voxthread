// tests/message-order.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  compareMessageOrder,
  isMessageAfter,
  laterMessage,
} from '../src/core/message-order.mjs';

test('old virtualized numeric MID without timestamp stays behind watermark', () => {
  assert.equal(
    isMessageAfter(
      { id: '900', timestamp: null },
      { id: '1000', timestamp: null },
    ),
    false,
  );
});

test('new numeric MID without timestamp advances live-follow', () => {
  assert.equal(
    isMessageAfter(
      { id: '1001', timestamp: null },
      { id: '1000', timestamp: null },
    ),
    true,
  );
});

test('timestamp dominates MID when both timestamps exist', () => {
  assert.equal(
    compareMessageOrder(
      { id: '5000', timestamp: 100 },
      { id: '1000', timestamp: 200 },
    ),
    -1,
  );
});

test('same timestamp falls back to numeric MID', () => {
  assert.equal(
    compareMessageOrder(
      { id: '1001', timestamp: 200 },
      { id: '1000', timestamp: 200 },
    ),
    1,
  );
});

test('unknown ordering preserves observer new-message signal by default', () => {
  assert.equal(
    isMessageAfter(
      { id: 'opaque-new', timestamp: null },
      { id: 'opaque-old', timestamp: null },
    ),
    true,
  );
});

test('laterMessage tracks newest comparable message', () => {
  assert.deepEqual(
    laterMessage(
      { id: '10', timestamp: null },
      { id: '11', timestamp: null },
    ),
    { id: '11', timestamp: null },
  );
});
