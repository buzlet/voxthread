// src/runtime/userscript-main.mjs
import {
  extractTelegramBubbles,
  TelegramAuthorContext,
} from '../telegram/dom-adapter.mjs';
import {
  findTelegramMessageScroller,
  scrollTowardNewer,
  TelegramMessageObserver,
} from '../telegram/message-observer.mjs';
import { createPrivacySafeDiagnostics } from '../core/diagnostics.mjs';
import { NormalizedMessageCache } from '../core/message-cache.mjs';
import { planSpeech } from '../core/speech-planner.mjs';
import { PlaybackQueue } from '../core/playback-queue.mjs';
import {
  loadReaderPreferences,
  saveReaderPreferences,
} from '../core/preferences.mjs';
import { ReadCursorStore } from '../core/read-cursor.mjs';
import { WebSpeechBackend } from '../tts/web-speech-backend.mjs';

const VERSION =
  typeof __VOXTHREAD_VERSION__ === 'undefined'
    ? 'dev'
    : __VOXTHREAD_VERSION__;
const PANEL_ID = 'voxthread-reader';
const SELECTED_CLASS = 'voxthread-selected-message';
const VOICE_OVERRIDES_KEY = 'voxthread.voiceOverrides.v1';
const LANGUAGE_PREFERENCES_KEY = 'voxthread.languagePreferences.v1';
const READER_PREFERENCES_KEY = 'voxthread.readerPreferences.v1';
const READ_CURSOR_KEY = 'voxthread.readCursor.v1';

let selectionMode = false;
let selectedMessageId = null;
let selectedBubble = null;
let statusElement = null;
let pauseButton = null;
let controlsElement = null;
let settingsElement = null;
let collapseButton = null;
let voiceSettingsElement = null;
let lastBuiltSegments = [];
let messageObserver = null;
let latestQueuedTimestamp = null;
let liveFollow = false;
let prefetchPending = false;
let lastPrefetchIndex = -1;
let lastQueueStartMode = 'first-visible';
let lastExtractionMessages = 0;
let lastPlannedSegments = 0;
let lastObservedBatch = 0;
let lastObservedChanges = 0;

const telegramAuthorContext = new TelegramAuthorContext();
const messageCache = new NormalizedMessageCache({
  maxMessagesPerChat: 1200,
  maxChats: 12,
});
const queue = new PlaybackQueue(onQueueChange);

function loadJsonObject(key, fallback = {}) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || 'null');
    return value && typeof value === 'object' ? value : fallback;
  } catch {
    return fallback;
  }
}

const voiceOverrides = loadJsonObject(VOICE_OVERRIDES_KEY);
const languagePreferences = loadJsonObject(LANGUAGE_PREFERENCES_KEY, {
  manualOverrides: {},
  authorPreferences: {},
  chatPreferences: {},
});
languagePreferences.manualOverrides ||= {};
languagePreferences.authorPreferences ||= {};
languagePreferences.chatPreferences ||= {};

let readerPreferences = loadReaderPreferences(
  localStorage,
  READER_PREFERENCES_KEY,
);
const readCursorStore = new ReadCursorStore(localStorage, READ_CURSOR_KEY, {
  maxEntries: 100,
});

const ttsBackend = new WebSpeechBackend({
  speechSynthesis: window.speechSynthesis,
  Utterance: window.SpeechSynthesisUtterance,
  voiceOverrides,
  languagePreferences,
});
const player = ttsBackend.createPlayer({ queue });

function setVoiceOverride(authorKey, voiceId) {
  if (!voiceId) delete voiceOverrides[authorKey];
  else voiceOverrides[authorKey] = String(voiceId);
  localStorage.setItem(VOICE_OVERRIDES_KEY, JSON.stringify(voiceOverrides));
  renderVoiceSettings();
}

function setLanguagePreference(scope, key, language) {
  const targets = {
    manual: languagePreferences.manualOverrides,
    author: languagePreferences.authorPreferences,
    chat: languagePreferences.chatPreferences,
  };
  const target = targets[scope];
  if (!target) throw new TypeError('language preference scope must be manual, author or chat');
  const normalizedKey = String(key ?? '');
  if (!normalizedKey) throw new TypeError('language preference key is required');
  if (!language) delete target[normalizedKey];
  else target[normalizedKey] = String(language);
  localStorage.setItem(LANGUAGE_PREFERENCES_KEY, JSON.stringify(languagePreferences));
  renderVoiceSettings();
  return { ...target };
}

function renderVoiceSettings() {
  if (!voiceSettingsElement) return;
  voiceSettingsElement.replaceChildren();
  const voices = ttsBackend.listVoices();

  const summary = document.createElement('div');
  summary.style.cssText = 'padding:4px 1px;font-weight:600';
  summary.textContent = voices.length
    ? `Voices: ${voices.length}`
    : 'Voices: provider list unavailable; using fallback prosody';
  voiceSettingsElement.append(summary);

  if (!voices.length || !lastBuiltSegments.length) return;
  const authors = new Map();
  for (const segment of lastBuiltSegments) {
    if (!authors.has(segment.authorKey)) authors.set(segment.authorKey, segment);
  }

  for (const [authorKey, segment] of authors) {
    const row = document.createElement('label');
    row.style.cssText = 'display:flex;gap:6px;align-items:center;padding:3px 1px';
    const name = document.createElement('span');
    name.style.cssText = 'flex:1;min-width:70px;overflow:hidden;text-overflow:ellipsis';
    name.textContent = segment.authorName || (segment.outgoing ? 'You' : authorKey);
    const select = document.createElement('select');
    select.dataset.voiceAuthorKey = authorKey;
    select.style.cssText = 'max-width:155px';
    const automatic = document.createElement('option');
    automatic.value = '';
    automatic.textContent = 'Automatic';
    select.append(automatic);
    for (const voice of ttsBackend.listVoices(segment)) {
      const option = document.createElement('option');
      option.value = voice.id;
      option.textContent = `${voice.name} (${voice.lang || 'unknown'})`;
      select.append(option);
    }
    const override = voiceOverrides[authorKey] || '';
    select.value = override;
    if (override && !select.value) select.value = '';
    select.addEventListener('change', () => setVoiceOverride(authorKey, select.value));
    row.append(name, select);
    voiceSettingsElement.append(row);
  }
}

function speechPlanOptions() {
  return {
    mergeAdjacent: readerPreferences.mergeAdjacent,
    announceAuthors: readerPreferences.announceAuthors,
    contentPolicy: {
      linkMode: readerPreferences.linkMode,
      skipEmojiOnly: readerPreferences.skipEmojiOnly,
      announceMedia: readerPreferences.announceMedia,
    },
  };
}

function applyPanelState() {
  if (controlsElement) controlsElement.hidden = readerPreferences.panelCollapsed;
  if (settingsElement) settingsElement.hidden = readerPreferences.panelCollapsed;
  if (collapseButton) {
    collapseButton.textContent = readerPreferences.panelCollapsed ? '+' : '−';
    collapseButton.title = readerPreferences.panelCollapsed
      ? 'Expand VoxThread'
      : 'Collapse VoxThread';
  }
}

function updateReaderPreferences(patch) {
  readerPreferences = saveReaderPreferences(
    localStorage,
    READER_PREFERENCES_KEY,
    { ...readerPreferences, ...patch },
  );
  applyPanelState();
  renderStatus();
  return readerPreferences;
}

function isVisible(element) {
  if (!element) return false;
  const rect = element.getBoundingClientRect();
  return element.offsetParent !== null && rect.width > 0 && rect.height > 0;
}

function activeChatRoot() {
  return document.querySelector('.chat.tabs-tab.active') || document;
}

function renderedBubbles() {
  return [...activeChatRoot().querySelectorAll('.bubble[data-mid]')].filter(isVisible);
}

function persistReadCursor(snapshot) {
  const segment = snapshot.current;
  if (!segment?.chatId || !segment.messageIds?.length) return;
  if (!['playing', 'paused', 'completed'].includes(snapshot.status)) return;
  const completed = snapshot.status === 'completed';
  const messageId = completed ? segment.messageIds.at(-1) : segment.messageIds[0];
  readCursorStore.set(segment.chatId, messageId, {
    position: completed ? 'after' : 'at',
  });
}

function maybePrefetchNewer(snapshot) {
  if (!liveFollow) return;
  if (snapshot.status !== 'playing' && snapshot.status !== 'completed') return;
  const remaining = snapshot.length - snapshot.index - 1;
  if (remaining > 2 || prefetchPending || lastPrefetchIndex === snapshot.index) return;
  const scroller = findTelegramMessageScroller(activeChatRoot());
  if (!scroller) return;
  lastPrefetchIndex = snapshot.index;
  prefetchPending = true;
  requestAnimationFrame(() => {
    scrollTowardNewer(scroller, { screens: 0.75 });
    setTimeout(() => { prefetchPending = false; }, 450);
  });
}

function onQueueChange(snapshot) {
  persistReadCursor(snapshot);
  renderStatus();
  maybePrefetchNewer(snapshot);
}

function messagesForQueue() {
  const visibleMessages = extractTelegramBubbles(renderedBubbles(), {
    authorContext: telegramAuthorContext,
  });
  messageCache.upsert(visibleMessages);
  const chatId = visibleMessages[0]?.chatId ?? queue.current?.chatId ?? null;
  return {
    visibleMessages,
    chatId,
    messages: chatId ? messageCache.getChat(chatId) : visibleMessages,
  };
}

function buildQueue() {
  const { visibleMessages, chatId, messages } = messagesForQueue();
  const segments = planSpeech(messages, speechPlanOptions());
  lastBuiltSegments = segments;
  lastExtractionMessages = visibleMessages.length;
  lastPlannedSegments = segments.length;
  renderVoiceSettings();

  const cursor = !selectedMessageId && chatId ? readCursorStore.get(chatId) : null;
  const loadOptions = {};
  if (selectedMessageId) {
    loadOptions.startMessageId = selectedMessageId;
    lastQueueStartMode = 'selected';
  } else if (cursor?.position === 'after') {
    loadOptions.afterMessageId = cursor.messageId;
    lastQueueStartMode = 'first-unread';
  } else if (cursor) {
    loadOptions.startMessageId = cursor.messageId;
    lastQueueStartMode = 'resume';
  } else {
    lastQueueStartMode = 'first-visible';
  }

  queue.load(segments, loadOptions);
  lastPrefetchIndex = -1;
  latestQueuedTimestamp = messages.reduce(
    (latest, message) => message.timestamp === null
      ? latest
      : Math.max(latest ?? message.timestamp, message.timestamp),
    null,
  );

  return {
    messages: messages.length,
    visibleMessages: visibleMessages.length,
    cachedMessages: chatId ? messageCache.countForChat(chatId) : 0,
    segments: segments.length,
    chatId,
    cursor,
    startMode: lastQueueStartMode,
  };
}

function diagnosticsSnapshot() {
  const tts = ttsBackend.diagnostics(player);
  const currentChatId = queue.current?.chatId ?? null;
  return createPrivacySafeDiagnostics({
    version: VERSION,
    userAgent: navigator.userAgent,
    adapter: {
      activeChatRoot: activeChatRoot() !== document,
      visibleBubbles: renderedBubbles().length,
      lastNormalizedMessages: lastExtractionMessages,
      lastPlannedSegments,
      lastObservedBatch,
      observerActive: Boolean(messageObserver && liveFollow),
    },
    queue: {
      status: queue.status,
      index: queue.index,
      length: queue.length,
      currentMessageCount: queue.current?.messageIds?.length ?? 0,
    },
    reader: {
      selectedStart: Boolean(selectedMessageId),
      startMode: lastQueueStartMode,
      storedChatCursors: readCursorStore.count,
      activeChatHasCursor: Boolean(currentChatId && readCursorStore.get(currentChatId)),
      liveFollow,
      cachedChats: messageCache.chatCount,
      cachedMessages: messageCache.messageCount,
      observedChanges: lastObservedChanges,
    },
    tts,
    voices: {
      count: tts.voiceCount,
      overrides: Object.keys(voiceOverrides).length,
      fallbackProsody: tts.fallbackProsody,
    },
    readerPreferences,
    page: {
      hidden: Boolean(document.hidden),
      visibilityState: document.visibilityState,
    },
  });
}

function diagnosticsJson() {
  return `${JSON.stringify(diagnosticsSnapshot(), null, 2)}\n`;
}

function renderStatus() {
  if (!statusElement) return;
  const currentIds = queue.current?.messageIds ?? [];
  statusElement.textContent = [
    `VoxThread ${VERSION}`,
    selectionMode ? 'tap message' : `state: ${queue.status}`,
    `segment: ${queue.index + 1}/${queue.length}`,
    `start: ${lastQueueStartMode}`,
    currentIds.length ? `mid: ${currentIds[0]}` : '',
    player.lastError ? `tts error: ${player.lastError}` : '',
  ].filter(Boolean).join(' · ');
  if (pauseButton) pauseButton.textContent = queue.status === 'paused' ? 'Resume' : 'Pause';
}

function clearSelectedBubble() {
  selectedBubble?.classList?.remove(SELECTED_CLASS);
  selectedBubble = null;
}

function selectBubble(bubble) {
  clearSelectedBubble();
  selectedBubble = bubble;
  selectedBubble.classList.add(SELECTED_CLASS);
  selectedMessageId = bubble.dataset.mid || null;
  selectionMode = false;
  renderStatus();
}

function onDocumentClick(event) {
  if (!selectionMode) return;
  const bubble = event.target.closest?.('.bubble[data-mid]');
  if (!bubble || !isVisible(bubble)) return;
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation?.();
  selectBubble(bubble);
}

function makeButton(label, handler) {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = label;
  button.addEventListener('click', handler);
  button.style.cssText = [
    'border:0', 'border-radius:7px', 'padding:7px 9px', 'margin:3px',
    'background:#2aabee', 'color:#fff', 'font-weight:600',
  ].join(';');
  return button;
}

function makeCheckbox(label, key) {
  const row = document.createElement('label');
  row.style.cssText = 'display:flex;gap:7px;align-items:center;padding:3px 1px';
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.checked = Boolean(readerPreferences[key]);
  input.addEventListener('change', () => updateReaderPreferences({ [key]: input.checked }));
  row.append(input, document.createTextNode(label));
  return row;
}

function makeLinkModeSelect() {
  const row = document.createElement('label');
  row.style.cssText = 'display:flex;gap:7px;align-items:center;padding:3px 1px';
  const select = document.createElement('select');
  select.style.cssText = 'margin-left:auto;max-width:120px';
  for (const [value, label] of [
    ['domain', 'Domain'], ['skip', 'Skip'], ['verbatim', 'Full URL'],
  ]) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = label;
    option.selected = readerPreferences.linkMode === value;
    select.append(option);
  }
  select.addEventListener('change', () => updateReaderPreferences({ linkMode: select.value }));
  row.append(document.createTextNode('Links'), select);
  return row;
}

function handleNewMessages(messages) {
  lastObservedBatch = messages.length;
  messageCache.upsert(messages);
  const forward = messages.filter(message =>
    latestQueuedTimestamp === null
    || message.timestamp === null
    || message.timestamp >= latestQueuedTimestamp
  );
  if (!forward.length) return;

  const segments = planSpeech(forward, speechPlanOptions());
  if (!segments.length) return;
  lastBuiltSegments.push(...segments);
  renderVoiceSettings();
  const wasCompleted = queue.status === 'completed';
  queue.append(segments);

  for (const message of forward) {
    if (message.timestamp !== null) {
      latestQueuedTimestamp = Math.max(latestQueuedTimestamp ?? message.timestamp, message.timestamp);
    }
  }
  if (liveFollow && wasCompleted) player.play();
}

function reconcilePendingMessage(chatId, messageId, groupMessageIds) {
  if (!groupMessageIds.length) return false;
  const cached = new Map(messageCache.getChat(chatId).map(message => [message.id, message]));
  const source = groupMessageIds.map(id => cached.get(String(id))).filter(Boolean);
  const replacement = planSpeech(source, speechPlanOptions());
  const replaced = queue.replacePendingForMessage(messageId, replacement);
  if (replaced) {
    lastPlannedSegments = queue.length;
    renderVoiceSettings();
  }
  return replaced;
}

function handleMessageChanges(changes) {
  lastObservedChanges = changes.length;
  for (const change of changes) {
    if (change.type === 'updated') {
      const message = change.message;
      const groupIds = queue.messageIdsFor(message.id);
      messageCache.upsert([message]);
      reconcilePendingMessage(message.chatId, message.id, groupIds);
    } else if (change.type === 'deleted') {
      const groupIds = queue.messageIdsFor(change.messageId);
      messageCache.remove(change.chatId, change.messageId);
      reconcilePendingMessage(change.chatId, change.messageId, groupIds);
    }
  }
}

function startMessageObserver() {
  messageObserver?.stop();
  messageObserver = new TelegramMessageObserver({
    root: activeChatRoot(),
    authorContext: telegramAuthorContext,
    onMessages: handleNewMessages,
    onChanges: handleMessageChanges,
  });
  messageObserver.start({ emitInitial: false });
}

function playFromSelection() {
  const result = buildQueue();
  if (!result.segments) { renderStatus(); return; }
  liveFollow = true;
  startMessageObserver();
  if (queue.status !== 'completed') player.play();
  else renderStatus();
}

function togglePause() {
  if (queue.status === 'paused') player.resume();
  else player.pause();
  renderStatus();
}

function createPanel() {
  document.getElementById(PANEL_ID)?.remove();
  const style = document.createElement('style');
  style.textContent = `
    .${SELECTED_CLASS} { outline: 3px solid #2aabee !important; outline-offset: 2px !important; }
    #${PANEL_ID} button, #${PANEL_ID} select, #${PANEL_ID} input { font: inherit; }
    #${PANEL_ID} summary { cursor: pointer; user-select: none; padding: 4px 2px; font-weight: 600; }
  `;
  document.head.append(style);

  const panel = document.createElement('section');
  panel.id = PANEL_ID;
  panel.dataset.voxthreadVersion = VERSION;
  panel.style.cssText = [
    'position:fixed', 'right:8px', 'bottom:72px', 'z-index:2147483647',
    'width:min(330px,calc(100vw - 16px))', 'padding:8px', 'border-radius:10px',
    'background:#15171af0', 'color:#fff', 'font:12px sans-serif', 'box-shadow:0 3px 14px #0008',
  ].join(';');

  const header = document.createElement('div');
  header.style.cssText = 'display:flex;align-items:flex-start;gap:5px';
  statusElement = document.createElement('div');
  statusElement.style.cssText = 'flex:1;min-width:0;padding:3px 4px 6px;line-height:1.35;overflow-wrap:anywhere';
  collapseButton = makeButton('−', () => updateReaderPreferences({
    panelCollapsed: !readerPreferences.panelCollapsed,
  }));
  collapseButton.style.cssText += ';padding:4px 8px;margin:0';
  header.append(statusElement, collapseButton);

  controlsElement = document.createElement('div');
  const pick = makeButton('Pick start', () => { selectionMode = true; renderStatus(); });
  const play = makeButton('Play', playFromSelection);
  pauseButton = makeButton('Pause', togglePause);
  const previous = makeButton('Prev', () => player.previous());
  const next = makeButton('Next', () => player.next());
  const stop = makeButton('Stop', () => {
    liveFollow = false;
    messageObserver?.stop();
    player.stop();
  });
  controlsElement.append(pick, play, pauseButton, previous, next, stop);

  settingsElement = document.createElement('details');
  settingsElement.style.cssText = 'margin:4px 3px 0;padding:3px 5px;border-top:1px solid #ffffff24';
  const summary = document.createElement('summary');
  summary.textContent = 'Settings';
  const settingsBody = document.createElement('div');
  settingsBody.style.cssText = 'padding:3px 1px 1px';
  settingsBody.append(
    makeCheckbox('Announce authors', 'announceAuthors'),
    makeCheckbox('Merge same author', 'mergeAdjacent'),
    makeCheckbox('Skip emoji-only', 'skipEmojiOnly'),
    makeCheckbox('Speak media labels', 'announceMedia'),
    makeCheckbox('Resume after wake', 'autoResumeOnVisible'),
    makeLinkModeSelect(),
  );

  voiceSettingsElement = document.createElement('div');
  voiceSettingsElement.id = 'voxthread-voice-settings';
  voiceSettingsElement.style.cssText = 'margin-top:5px;padding-top:4px;border-top:1px solid #ffffff18';
  settingsBody.append(voiceSettingsElement);

  const diagnosticsButton = makeButton('Copy diagnostics JSON', async () => {
    const payload = diagnosticsJson();
    const oldLabel = diagnosticsButton.textContent;
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard API unavailable');
      await navigator.clipboard.writeText(payload);
      diagnosticsButton.textContent = 'Copied';
    } catch {
      console.info('[VoxThread diagnostics]', payload);
      diagnosticsButton.textContent = 'Logged';
    }
    setTimeout(() => { diagnosticsButton.textContent = oldLabel; }, 1200);
  });
  settingsBody.append(diagnosticsButton);
  settingsElement.append(summary, settingsBody);
  panel.append(header, controlsElement, settingsElement);
  document.body.append(panel);
  applyPanelState();
  renderVoiceSettings();
  renderStatus();
}

ttsBackend.onVoicesChanged(renderVoiceSettings);
document.addEventListener('click', onDocumentClick, true);
document.addEventListener('visibilitychange', () => {
  if (
    readerPreferences.autoResumeOnVisible
    && !document.hidden
    && player.lastError
    && queue.status === 'paused'
  ) player.resume();
});
window.addEventListener('pagehide', () => {
  liveFollow = false;
  messageObserver?.stop();
  messageCache.clear();
  player.stop();
}, { once: true });

window.__voxThreadApp = {
  version: VERSION,
  queue,
  player,
  ttsBackend,
  buildQueue,
  setVoiceOverride,
  setLanguagePreference,
  getVoiceOverrides() { return { ...voiceOverrides }; },
  getLanguagePreferences() {
    return JSON.parse(JSON.stringify(languagePreferences));
  },
  setReaderPreferences(patch) { return updateReaderPreferences(patch); },
  getReaderPreferences() { return { ...readerPreferences }; },
  getReadCursor(chatId) { return readCursorStore.get(chatId); },
  clearReadCursor(chatId) { return readCursorStore.clear(chatId); },
  getMessageCacheStats() {
    return { chats: messageCache.chatCount, messages: messageCache.messageCount };
  },
  getDiagnostics: diagnosticsSnapshot,
  getDiagnosticsJson: diagnosticsJson,
  get selectedMessageId() { return selectedMessageId; },
};

createPanel();
