// src/core/diagnostics.mjs

const PREFERENCE_KEYS = [
  'mergeAdjacent',
  'announceAuthors',
  'linkMode',
  'skipEmojiOnly',
  'announceMedia',
  'autoResumeOnVisible',
  'panelCollapsed',
];

const KNOWN_TTS_ERROR_CODES = new Set([
  'interrupted',
  'canceled',
  'not-allowed',
  'audio-busy',
  'network',
  'synthesis-failed',
  'language-unavailable',
  'voice-unavailable',
  'text-too-long',
  'invalid-argument',
]);

function count(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? Math.floor(number) : 0;
}

function index(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.trunc(number) : -1;
}

function browserRuntime(userAgent = '') {
  const ua = String(userAgent);
  for (const [family, pattern] of [
    ['firefox', /Firefox\/(\d+)/i],
    ['edge', /EdgA?\/(\d+)/i],
    ['chrome', /Chrome\/(\d+)/i],
  ]) {
    const match = ua.match(pattern);
    if (match) {
      return Object.freeze({ family, majorVersion: Number(match[1]) || null });
    }
  }
  return Object.freeze({ family: 'unknown', majorVersion: null });
}

function safeErrorCode(value) {
  if (!value) return null;
  const normalized = String(value).trim().toLowerCase();
  return KNOWN_TTS_ERROR_CODES.has(normalized)
    ? normalized
    : 'provider-error';
}

function capabilities(value = {}) {
  return Object.freeze({
    apiVersion: Number(value.apiVersion) || null,
    provider: String(value.provider || 'unknown'),
    execution: String(value.execution || 'unknown'),
    network: String(value.network || 'unknown'),
    background: String(value.background || 'unknown'),
    voiceSelection: Boolean(value.voiceSelection),
    pauseResume: Boolean(value.pauseResume),
    streaming: Boolean(value.streaming),
    wordBoundary: Boolean(value.wordBoundary),
    maxTextLength: Number.isFinite(Number(value.maxTextLength))
      ? Number(value.maxTextLength)
      : null,
  });
}

function preferences(value = {}) {
  const result = {};
  for (const key of PREFERENCE_KEYS) {
    if (key in value) result[key] = value[key];
  }
  return Object.freeze(result);
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const item of Object.values(value)) deepFreeze(item);
  return Object.freeze(value);
}

/**
 * Build a shareable diagnostics report from an explicit whitelist.
 * Message text, author/chat/message identifiers and page URLs are deliberately
 * impossible to include through this API even if the caller passes them.
 */
export function createPrivacySafeDiagnostics({
  version = 'dev',
  userAgent = '',
  adapter = {},
  queue = {},
  reader = {},
  tts = {},
  voices = {},
  readerPreferences = {},
  page = {},
  generatedAt = Date.now(),
} = {}) {
  const report = {
    schemaVersion: 1,
    generatedAt: new Date(Number(generatedAt) || 0).toISOString(),
    version: String(version),
    runtime: browserRuntime(userAgent),
    adapter: {
      activeChatRoot: Boolean(adapter.activeChatRoot),
      visibleBubbles: count(adapter.visibleBubbles),
      lastNormalizedMessages: count(adapter.lastNormalizedMessages),
      lastPlannedSegments: count(adapter.lastPlannedSegments),
      lastObservedBatch: count(adapter.lastObservedBatch),
      observerActive: Boolean(adapter.observerActive),
    },
    queue: {
      status: String(queue.status || 'unknown'),
      index: index(queue.index),
      length: count(queue.length),
      currentMessageCount: count(queue.currentMessageCount),
    },
    reader: {
      selectedStart: Boolean(reader.selectedStart),
      startMode: String(reader.startMode || 'unknown'),
      storedChatCursors: count(reader.storedChatCursors),
      activeChatHasCursor: Boolean(reader.activeChatHasCursor),
      liveFollow: Boolean(reader.liveFollow),
    },
    tts: {
      provider: String(tts.provider || 'unknown'),
      apiVersion: Number(tts.apiVersion) || null,
      capabilities: capabilities(tts.capabilities),
      speaking: Boolean(tts.speaking),
      pending: Boolean(tts.pending),
      paused: Boolean(tts.paused),
      errorCode: safeErrorCode(tts.error),
      chunkIndex: count(tts.chunkIndex),
      chunkCount: count(tts.chunkCount),
    },
    voices: {
      count: count(voices.count),
      overrides: count(voices.overrides),
      fallbackProsody: Boolean(voices.fallbackProsody),
    },
    preferences: preferences(readerPreferences),
    page: {
      hidden: Boolean(page.hidden),
      visibilityState: String(page.visibilityState || 'unknown'),
    },
    privacy: {
      includesMessageText: false,
      includesChatIdentifiers: false,
      includesMessageIdentifiers: false,
      includesAuthorIdentifiers: false,
      includesPageUrl: false,
    },
  };

  return deepFreeze(report);
}
