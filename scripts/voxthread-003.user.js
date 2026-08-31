// voxthread-003.user.js
// ==UserScript==
// @name         VoxThread Diagnostics
// @namespace    https://github.com/buzlet/voxthread
// @version      0.3.0
// @description  Inspect Telegram messages and speak real visible Telegram text.
// @match        https://web.telegram.org/k/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(() => {
  'use strict';

  const VERSION = '0.3.0';
  const PANEL_ID = 'voxthread-diagnostics';
  const state = window.__voxThreadDiag = {
    version: VERSION,
    scannedAt: null,
    messages: [],
    voices: [],
    tts: { queued: 0, started: 0, ended: 0, errors: [] },
  };

  function isVisible(element) {
    if (!element) return false;
    const rect = element.getBoundingClientRect();
    return element.offsetParent !== null && rect.width > 0 && rect.height > 0;
  }

  function extractMessage(bubble) {
    const textElement = bubble.querySelector('.translatable-message, .message');
    return {
      mid: bubble.dataset.mid || null,
      peerId: bubble.dataset.peerId || null,
      timestamp: Number(bubble.dataset.timestamp || 0) || null,
      text: textElement?.innerText?.trim() || '',
    };
  }

  function scanVisibleMessages() {
    state.messages = [...document.querySelectorAll('.bubble[data-mid]')]
      .filter(isVisible)
      .map(extractMessage)
      .filter(message => message.text);
    state.scannedAt = new Date().toISOString();
    return state.messages;
  }

  function refreshVoices() {
    state.voices = speechSynthesis.getVoices().map(voice => ({
      name: voice.name,
      lang: voice.lang,
      voiceURI: voice.voiceURI,
      localService: voice.localService,
      default: voice.default,
    }));
    return state.voices;
  }

  function getVoicePool() {
    const voices = speechSynthesis.getVoices();
    const preferred = voices.filter(voice => /^(ru|en)(-|_)/i.test(voice.lang));
    return preferred.length ? preferred : voices;
  }

  function stopSpeech() {
    speechSynthesis.cancel();
  }

  function speakLatestTelegram() {
    stopSpeech();
    const messages = scanVisibleMessages();
    const message = messages.at(-1);
    if (!message) {
      state.tts = { queued: 0, started: 0, ended: 0, errors: ['no-visible-message'] };
      renderStatus();
      return state.tts;
    }

    state.tts = { queued: 1, started: 0, ended: 0, errors: [] };
    state.lastSpoken = { mid: message.mid, peerId: message.peerId };
    const utterance = new SpeechSynthesisUtterance(message.text);
    utterance.lang = /[А-Яа-яЁёІіЇїЄєҐґ]/.test(message.text) ? 'ru-RU' : 'en-US';
    utterance.onstart = () => { state.tts.started += 1; renderStatus(); };
    utterance.onend = () => { state.tts.ended += 1; renderStatus(); };
    utterance.onerror = event => {
      state.tts.errors.push(String(event.error || 'unknown'));
      renderStatus();
    };
    speechSynthesis.speak(utterance);
    renderStatus();
    return state.tts;
  }

  function speakSynthetic(count = 20) {
    stopSpeech();
    refreshVoices();
    state.tts = { queued: count, started: 0, ended: 0, errors: [] };

    const pool = getVoicePool();
    for (let index = 1; index <= count; index += 1) {
      const voice = pool.length ? pool[(index - 1) % Math.min(pool.length, 3)] : null;
      const ru = voice?.lang?.toLowerCase().startsWith('ru');
      const text = ru
        ? `Тест VoxThread. Сообщение номер ${index}.`
        : `VoxThread test. Message number ${index}.`;
      const utterance = new SpeechSynthesisUtterance(text);
      if (voice) {
        utterance.voice = voice;
        utterance.lang = voice.lang;
      }
      utterance.onstart = () => { state.tts.started += 1; renderStatus(); };
      utterance.onend = () => { state.tts.ended += 1; renderStatus(); };
      utterance.onerror = event => {
        state.tts.errors.push(String(event.error || 'unknown'));
        renderStatus();
      };
      speechSynthesis.speak(utterance);
    }
    renderStatus();
    return state.tts;
  }

  let statusElement;
  function renderStatus() {
    if (!statusElement) return;
    statusElement.textContent = [
      `${state.messages.length} msg`,
      `${state.voices.length} voice`,
      `TTS ${state.tts.ended}/${state.tts.queued}`,
      state.tts.errors.length ? `${state.tts.errors.length} error` : 'ok',
    ].join(' · ');
  }

  function makeButton(label, handler) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    button.style.cssText = [
      'border:0', 'border-radius:7px', 'padding:7px 9px',
      'background:#2aabee', 'color:#fff', 'font-weight:600',
      'margin:3px'
    ].join(';');
    button.addEventListener('click', handler);
    return button;
  }

  function createPanel() {
    document.getElementById(PANEL_ID)?.remove();
    const panel = document.createElement('section');
    panel.id = PANEL_ID;
    panel.dataset.voxthreadVersion = VERSION;
    panel.style.cssText = [
      'position:fixed', 'right:12px', 'top:84px', 'z-index:2147483647',
      'background:#15171a', 'color:#fff', 'padding:10px 12px',
      'border:1px solid #555', 'border-radius:10px', 'font:13px sans-serif',
      'box-shadow:0 3px 14px #0008', 'max-width:270px'
    ].join(';');

    const title = document.createElement('div');
    title.textContent = `VoxThread ${VERSION}`;
    title.style.cssText = 'font-weight:700;margin-bottom:6px';

    statusElement = document.createElement('div');
    statusElement.style.cssText = 'margin-bottom:6px;opacity:.85';

    panel.append(
      title,
      statusElement,
      makeButton('Scan', () => { scanVisibleMessages(); renderStatus(); }),
      makeButton('Voices', () => { refreshVoices(); renderStatus(); }),
      makeButton('Speak Telegram', speakLatestTelegram),
      makeButton('Speak 20', () => speakSynthetic(20)),
      makeButton('Stop', stopSpeech),
    );
    document.body.append(panel);
    refreshVoices();
    renderStatus();
    console.info(`[VoxThread] injected v${VERSION}`);
  }

  window.__voxThread = {
    scanVisibleMessages,
    refreshVoices,
    speakLatestTelegram,
    speakSynthetic,
    stopSpeech,
  };

  speechSynthesis.addEventListener?.('voiceschanged', () => {
    refreshVoices();
    renderStatus();
  });

  createPanel();
})();
