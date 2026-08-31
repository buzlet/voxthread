// tests/runtime-userscript.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { JSDOM } from 'jsdom';

class FakeUtterance {
  constructor(text) {
    this.text = text;
    this.onend = null;
    this.onerror = null;
    this.rate = 1;
    this.pitch = 1;
  }
}

function buttonByText(document, text) {
  return [...document.querySelectorAll('button')]
    .find(button => button.textContent === text);
}

test('integrated userscript selects a message and starts real queue', async () => {
  const fixture = await fs.readFile(
    new URL('./fixtures/telegram-group-basic.html', import.meta.url),
    'utf8',
  );

  const dom = new JSDOM(fixture, {
    url: 'https://web.telegram.org/k/#test',
    pretendToBeVisual: true,
  });

  const { window } = dom;

  Object.defineProperty(window.HTMLElement.prototype, 'offsetParent', {
    configurable: true,
    get() {
      return this.parentElement;
    },
  });

  window.HTMLElement.prototype.getBoundingClientRect = function () {
    return {
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: 300,
      bottom: 80,
      width: 300,
      height: 80,
    };
  };

  const synth = {
    spoken: [],
    getVoices: () => [],
    speak(utterance) {
      this.spoken.push(utterance);
    },
    cancel() {},
    pause() {},
    resume() {},
  };

  window.speechSynthesis = synth;
  window.SpeechSynthesisUtterance = FakeUtterance;

  const previous = {
    window: globalThis.window,
    document: globalThis.document,
    localStorage: globalThis.localStorage,
    MutationObserver: globalThis.MutationObserver,
    requestAnimationFrame: globalThis.requestAnimationFrame,
  };

  globalThis.window = window;
  globalThis.document = window.document;
  globalThis.localStorage = window.localStorage;
  globalThis.MutationObserver = window.MutationObserver;
  globalThis.requestAnimationFrame = window.requestAnimationFrame.bind(window);

  try {
    await import(`../src/runtime/userscript-main.mjs?test=${Date.now()}`);

    const panel = window.document.getElementById('voxthread-reader');
    assert.ok(panel);

    buttonByText(window.document, 'Pick start').click();

    const firstBubble = window.document.querySelector(
      '.bubble[data-mid="1001"]',
    );

    firstBubble.dispatchEvent(new window.MouseEvent('click', {
      bubbles: true,
      cancelable: true,
    }));

    assert.equal(window.__voxThreadApp.selectedMessageId, '1001');

    buttonByText(window.document, 'Play').click();

    assert.equal(window.__voxThreadApp.queue.status, 'playing');
    assert.equal(synth.spoken.length, 1);
    assert.match(synth.spoken[0].text, /Алиса/);
    assert.match(synth.spoken[0].text, /Первое сообщение/);

    synth.spoken[0].onend();
    await new Promise(resolve => setTimeout(resolve, 275));

    assert.equal(synth.spoken.length, 2);
    assert.match(synth.spoken[1].text, /Боб/);
    assert.match(synth.spoken[1].text, /example\.com/);

    window.__voxThreadApp.player.stop();
  } finally {
    globalThis.window = previous.window;
    globalThis.document = previous.document;
    globalThis.localStorage = previous.localStorage;
    globalThis.MutationObserver = previous.MutationObserver;
    globalThis.requestAnimationFrame = previous.requestAnimationFrame;
    dom.window.close();
  }
});
