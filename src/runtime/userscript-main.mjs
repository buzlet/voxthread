// src/runtime/userscript-main.mjs
import { extractTelegramBubbles } from '../telegram/dom-adapter.mjs';
import {
  findTelegramMessageScroller,
  scrollTowardNewer,
  TelegramMessageObserver,
} from '../telegram/message-observer.mjs';
import { planSpeech } from '../core/speech-planner.mjs';
import { PlaybackQueue } from '../core/playback-queue.mjs';
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

let selectionMode = false;
let selectedMessageId = null;
let selectedBubble = null;
let statusElement = null;
let pauseButton = null;
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
  const segments = planSpeech(messages, {
    mergeAdjacent: true,
    announceAuthors: true,
  });

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

function handleNewMessages(messages) {
  const forward = messages.filter(message =>
    latestQueuedTimestamp === null
    || message.timestamp === null
    || message.timestamp >= latestQueuedTimestamp
  );

  if (!forward.length) return;

  const segments = planSpeech(forward, {
    mergeAdjacent: true,
    announceAuthors: true,
  });

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
  `;
  document.head.append(style);

  const panel = document.createElement('section');
  panel.id = PANEL_ID;
  panel.dataset.voxthreadVersion = VERSION;
  panel.style.cssText = [
    'position:fixed',
    'right:10px',
    'bottom:78px',
    'z-index:2147483647',
    'max-width:330px',
    'padding:9px',
    'border-radius:10px',
    'background:#15171ae8',
    'color:#fff',
    'font:12px sans-serif',
    'box-shadow:0 3px 14px #0008',
  ].join(';');

  statusElement = document.createElement('div');
  statusElement.style.cssText = 'padding:3px 5px 6px;line-height:1.35';

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

  panel.append(statusElement, pick, play, pauseButton, previous, next, stop);
  document.body.append(panel);
  renderStatus();
}

document.addEventListener('click', onDocumentClick, true);
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
  get selectedMessageId() {
    return selectedMessageId;
  },
};

createPanel();
