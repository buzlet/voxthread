// tests/diagnostics.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { createPrivacySafeDiagnostics } from '../src/core/diagnostics.mjs';

test('diagnostics report exposes useful runtime state but drops private identifiers/text', () => {
  const report = createPrivacySafeDiagnostics({
    version: '0.8.0',
    userAgent: 'Mozilla/5.0 Android Firefox/154.0',
    adapter: {
      activeChatRoot: true,
      visibleBubbles: 17,
      lastNormalizedMessages: 15,
      lastPlannedSegments: 9,
      lastObservedBatch: 2,
      observerActive: true,
      chatId: 'private-chat-42',
      text: 'SECRET MESSAGE TEXT',
    },
    queue: {
      status: 'playing',
      index: 3,
      length: 10,
      currentMessageCount: 2,
      currentMessageId: 'private-mid-99',
    },
    reader: {
      selectedStart: false,
      startMode: 'resume',
      storedChatCursors: 4,
      activeChatHasCursor: true,
      liveFollow: true,
      authorName: 'Private Person',
    },
    tts: {
      provider: 'web-speech',
      apiVersion: 2,
      capabilities: {
        apiVersion: 2,
        provider: 'web-speech',
        execution: 'browser',
        network: 'provider-dependent',
        background: 'runtime-dependent',
        voiceSelection: true,
        pauseResume: true,
        maxTextLength: 480,
      },
      speaking: true,
      error: 'interrupted',
      chunkIndex: 1,
      chunkCount: 3,
    },
    voices: { count: 20, overrides: 2 },
    readerPreferences: {
      mergeAdjacent: true,
      announceAuthors: false,
      secret: 'must-not-leak',
    },
    page: {
      hidden: false,
      visibilityState: 'visible',
      url: 'https://web.telegram.org/k/#private',
    },
    generatedAt: 1_780_000_000_000,
  });

  assert.deepEqual(report.runtime, {
    family: 'firefox',
    majorVersion: 154,
  });
  assert.equal(report.adapter.visibleBubbles, 17);
  assert.equal(report.tts.capabilities.apiVersion, 2);
  assert.equal(report.privacy.includesMessageText, false);
  assert.equal(Object.isFrozen(report), true);

  const json = JSON.stringify(report);
  for (const forbidden of [
    'SECRET MESSAGE TEXT',
    'private-chat-42',
    'private-mid-99',
    'Private Person',
    'must-not-leak',
    'web.telegram.org',
  ]) {
    assert.equal(json.includes(forbidden), false, forbidden);
  }
});

test('diagnostics reduces free-form TTS errors to a bounded code-like token', () => {
  const report = createPrivacySafeDiagnostics({
    tts: { error: 'interrupted because private message text appeared here' },
  });

  assert.equal(
    report.tts.errorCode,
    'interrupted_because_private_message_text_appeared_here',
  );
});
