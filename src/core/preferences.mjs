// src/core/preferences.mjs

export const DEFAULT_READER_PREFERENCES = Object.freeze({
  mergeAdjacent: true,
  announceAuthors: true,
  linkMode: 'domain',
  skipEmojiOnly: true,
  announceMedia: false,
  autoResumeOnVisible: true,
  panelCollapsed: false,
});

const LINK_MODES = new Set(['domain', 'skip', 'verbatim']);

function bool(value, fallback) {
  return typeof value === 'boolean' ? value : fallback;
}

export function normalizeReaderPreferences(value = {}) {
  return Object.freeze({
    mergeAdjacent: bool(value.mergeAdjacent, true),
    announceAuthors: bool(value.announceAuthors, true),
    linkMode: LINK_MODES.has(value.linkMode) ? value.linkMode : 'domain',
    skipEmojiOnly: bool(value.skipEmojiOnly, true),
    announceMedia: bool(value.announceMedia, false),
    autoResumeOnVisible: bool(value.autoResumeOnVisible, true),
    panelCollapsed: bool(value.panelCollapsed, false),
  });
}

export function loadReaderPreferences(storage, key) {
  try {
    const raw = storage?.getItem?.(key);
    if (!raw) return DEFAULT_READER_PREFERENCES;
    return normalizeReaderPreferences(JSON.parse(raw));
  } catch {
    return DEFAULT_READER_PREFERENCES;
  }
}

export function saveReaderPreferences(storage, key, value) {
  const normalized = normalizeReaderPreferences(value);
  storage?.setItem?.(key, JSON.stringify(normalized));
  return normalized;
}
