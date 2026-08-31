// tests/preferences.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_READER_PREFERENCES,
  loadReaderPreferences,
  normalizeReaderPreferences,
  saveReaderPreferences,
} from '../src/core/preferences.mjs';

test('reader preferences use safe defaults', () => {
  assert.deepEqual(
    normalizeReaderPreferences({}),
    DEFAULT_READER_PREFERENCES,
  );
});

test('reader preferences validate link mode and booleans', () => {
  const value = normalizeReaderPreferences({
    mergeAdjacent: false,
    announceAuthors: false,
    linkMode: 'skip',
    skipEmojiOnly: false,
    announceMedia: true,
    autoResumeOnVisible: false,
    panelCollapsed: true,
  });

  assert.equal(value.linkMode, 'skip');
  assert.equal(value.panelCollapsed, true);
  assert.equal(value.announceMedia, true);

  assert.equal(
    normalizeReaderPreferences({ linkMode: 'nonsense' }).linkMode,
    'domain',
  );
});

test('preferences persist through storage boundary', () => {
  const values = new Map();
  const storage = {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };

  saveReaderPreferences(storage, 'prefs', {
    announceAuthors: false,
    linkMode: 'verbatim',
  });

  const loaded = loadReaderPreferences(storage, 'prefs');

  assert.equal(loaded.announceAuthors, false);
  assert.equal(loaded.linkMode, 'verbatim');
  assert.equal(loaded.mergeAdjacent, true);
});
