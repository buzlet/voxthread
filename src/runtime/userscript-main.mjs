// src/runtime/userscript-main.mjs
import { extractTelegramBubbles } from '../telegram/dom-adapter.mjs';
import {
  findTelegramMessageScroller,
  scrollTowardNewer,
  TelegramMessageObserver,
} from '../telegram/message-observer.mjs';
import { planSpeech } from '../core/speech-planner.mjs';
import { PlaybackQueue } from '../core/playback-queue.mjs';
import {
  loadReaderPreferences,
  saveReaderPreferences,
} from '../core/preferences.mjs';
import { WebSpeechPlayer } from '../tts/web-speech-player.mjs';
import {
  createVoiceResolver,
  inferLanguageHint,
  prosodyForAuthor,
} from '../tts/voice-map.mjs';

const VERSION =
  typeof __VOXTHREAD_VERSION__ === 'undefined'
    ? 'dev'
    : __VOXTHREAD_VERSION__;
const PANEL_ID = 'voxthread-reader';
const SELECTED_CLASS = 'voxthread-selected-message';
const VOICE_OVERRIDES_KEY = 'voxthread.voiceOverrides.v1';
const READER_PREFERENCES_KEY = 'voxthread.readerPreferences.v1';

let selectionMode = false;
let selectedMessageId = null;
let selectedBubble = null;
let statusElement = null;
let pauseButton = null;
let controlsElement = null;
let settingsElement = null;
let collapseButton = null;
let messageObserver = null;
let latestQueuedTimestamp = null;
let liveFollow = false;
let prefetchPending = false;
let lastPrefetchIndex = -1;

const queue = new PlaybackQueue(onQueueChange);

function loadVoiceOverrides() {
  try {
    return JSON.parse(localStorage.getItem(VOICE_OVERRIDES_KEY) || '{}');
  } catch {
    return {};
  }
}

const voiceOverrides = loadVoiceOverrides();
let readerPreferences = loadReaderPreferences(
  localStorage,
  READER_PREFERENCES_KEY,
);

const voiceResolver = createVoiceResolver({
  getVoices: () => window.speechSynthesis.getVoices(),
  overrides: voiceOverrides,
  languageForSegment: segment => inferLanguageHint(segment.text),
});

const player = new WebSpeechPlayer({
  queue,
  speechSynthesis: window.speechSynthesis,
  Utterance: window.SpeechSynthesisUtterance,
  voiceResolver,
  prosodyResolver: segment => prosodyForAuthor(segment.authorKey),
});

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
  return [
    ...activeChatRoot().querySelectorAll('.bubble[data-mid]'),
  ].filter(isVisible);
}

function maybePrefetchNewer(snapshot) {
  if (!liveFollow) return;
  if (snapshot.status !== 'playing' && snapshot.status !== 'completed') return;

  const remaining = snapshot.length - snapshot.index - 1;
  if (remaining > 2) return;
  if (prefetchPending) return;
  if (lastPrefetchIndex === snapshot.index) return;

  const scroller = findTelegramMessageScroller(activeChatRoot());
  if (!scroller) return;

  lastPrefetchIndex = snapshot.index;
  prefetchPending = true;

  requestAnimationFrame(() => {
    scrollTowardNewer(scroller, { screens: 0.75 });

    setTimeout(() => {
      prefetchPending = false;
    }, 450);
  });
}

function onQueueChange(snapshot) {
  renderStatus();
  maybePrefetchNewer(snapshot);
}

function buildQueue() {
  const messages = extractTelegramBubbles(renderedBubbles());
  const segments = planSpeech(messages, speechPlanOptions());

  queue.load(segments, {
    startMessageId: selectedMessageId,
  });
  lastPrefetchIndex = -1;

  latestQueuedTimestamp = messages.reduce(
    (latest, message) =>
      message.timestamp === null
        ? latest
        : Math.max(latest ?? message.timestamp, message.timestamp),
    null,
  );

  return {
    messages: messages.length,
    segments: segments.length,
  };
}

function renderStatus() {
  if (!statusElement) return;

  const currentIds = queue.current?.messageIds ?? [];
  statusElement.textContent = [
    `VoxThread ${VERSION}`,
    selectionMode ? 'tap message' : `state: ${queue.status}`,
    `segment: ${queue.index + 1}/${queue.length}`,
    selectedMessageId ? `start: ${selectedMessageId}` : 'start: first visible',
    currentIds.length ? `mid: ${currentIds[0]}` : '',
    player.lastError ? `tts error: ${player.lastError}` : '',
  ].filter(Boolean).join(' · ');

  if (pauseButton) {
    pauseButton.textContent = queue.status === 'paused' ? 'Resume' : 'Pause';
  }
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
    'border:0',
    'border-radius:7px',
    'padding:7px 9px',
    'margin:3px',
    'background:#2aabee',
    'color:#fff',
    'font-weight:600',
  ].join(';');
  return button;
}

function makeCheckbox(label, key) {
  const row = document.createElement('label');
  row.style.cssText = 'display:flex;gap:7px;align-items:center;padding:3px 1px';
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.checked = Boolean(readerPreferences[key]);
  input.addEventListener('change', () => {
    updateReaderPreferences({ [key]: input.checked });
  });
  row.append(input, document.createTextNode(label));
  return row;
}

function makeLinkModeSelect() {
  const row = document.createElement('label');
  row.style.cssText = 'display:flex;gap:7px;align-items:center;padding:3px 1px';
  const select = document.createElement('select');
  select.style.cssText = 'margin-left:auto;max-width:120px';
  for (const [value, label] of [
    ['domain', 'Domain'],
    ['skip', 'Skip'],
    ['verbatim', 'Full URL'],
  ]) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = label;
    option.selected = readerPreferences.linkMode === value;
    select.append(option);
  }
  select.addEventListener('change', () => {
    updateReaderPreferences({ linkMode: select.value });
  });
  row.append(document.createTextNode('Links'), select);
  return row;
}

function handleNewMessages(messages) {
  const forward = messages.filter(message =>
    latestQueuedTimestamp === null
    || message.timestamp === null
    || message.timestamp >= latestQueuedTimestamp
  );

  if (!forward.length) return;

  const segments = planSpeech(forward, speechPlanOptions());

  if (!segments.length) return;

  const wasCompleted = queue.status === 'completed';
  queue.append(segments);

  for (const message of forward) {
    if (message.timestamp !== null) {
      latestQueuedTimestamp = Math.max(
        latestQueuedTimestamp ?? message.timestamp,
        message.timestamp,
      );
    }
  }

  if (liveFollow && wasCompleted) player.play();
}

function startMessageObserver() {
  messageObserver?.stop();

  messageObserver = new TelegramMessageObserver({
    root: activeChatRoot(),
    onMessages: handleNewMessages,
  });

  messageObserver.start({ emitInitial: false });
}

function playFromSelection() {
  const result = buildQueue();
  if (!result.segments) {
    renderStatus();
    return;
  }

  liveFollow = true;
  startMessageObserver();
  player.play();
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
    .${SELECTED_CLASS} {
      outline: 3px solid #2aabee !important;
      outline-offset: 2px !important;
    }
    #${PANEL_ID} button,
    #${PANEL_ID} select,
    #${PANEL_ID} input { font: inherit; }
    #${PANEL_ID} summary {
      cursor: pointer;
      user-select: none;
      padding: 4px 2px;
      font-weight: 600;
    }
  `;
  document.head.append(style);

  const panel = document.createElement('section');
  panel.id = PANEL_ID;
  panel.dataset.voxthreadVersion = VERSION;
  panel.style.cssText = [
    'position:fixed',
    'right:8px',
    'bottom:72px',
    'z-index:2147483647',
    'width:min(330px,calc(100vw - 16px))',
    'padding:8px',
    'border-radius:10px',
    'background:#15171af0',
    'color:#fff',
    'font:12px sans-serif',
    'box-shadow:0 3px 14px #0008',
  ].join(';');

  const header = document.createElement('div');
  header.style.cssText = 'display:flex;align-items:flex-start;gap:5px';

  statusElement = document.createElement('div');
  statusElement.style.cssText = [
    'flex:1',
    'min-width:0',
    'padding:3px 4px 6px',
    'line-height:1.35',
    'overflow-wrap:anywhere',
  ].join(';');

  collapseButton = makeButton('−', () => {
    updateReaderPreferences({
      panelCollapsed: !readerPreferences.panelCollapsed,
    });
  });
  collapseButton.style.cssText += ';padding:4px 8px;margin:0';
  header.append(statusElement, collapseButton);

  controlsElement = document.createElement('div');

  const pick = makeButton('Pick start', () => {
    selectionMode = true;
    renderStatus();
  });
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
  settingsElement.style.cssText = [
    'margin:4px 3px 0',
    'padding:3px 5px',
    'border-top:1px solid #ffffff24',
  ].join(';');

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

  settingsElement.append(summary, settingsBody);
  panel.append(header, controlsElement, settingsElement);
  document.body.append(panel);
  applyPanelState();
  renderStatus();
}

document.addEventListener('click', onDocumentClick, true);
document.addEventListener('visibilitychange', () => {
  if (
    readerPreferences.autoResumeOnVisible
    && !document.hidden
    && player.lastError
    && queue.status === 'paused'
  ) {
    player.resume();
  }
});
window.addEventListener('pagehide', () => {
  liveFollow = false;
  messageObserver?.stop();
  player.stop();
}, { once: true });

window.__voxThreadApp = {
  version: VERSION,
  queue,
  player,
  buildQueue,
  setVoiceOverride(authorKey, voiceURI) {
    if (!voiceURI) delete voiceOverrides[authorKey];
    else voiceOverrides[authorKey] = String(voiceURI);
    localStorage.setItem(
      VOICE_OVERRIDES_KEY,
      JSON.stringify(voiceOverrides),
    );
  },
  getVoiceOverrides() {
    return { ...voiceOverrides };
  },
  setReaderPreferences(patch) {
    return updateReaderPreferences(patch);
  },
  getReaderPreferences() {
    return { ...readerPreferences };
  },
  get selectedMessageId() {
    return selectedMessageId;
  },
};

createPanel();
