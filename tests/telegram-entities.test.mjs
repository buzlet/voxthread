// tests/telegram-entities.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { extractTelegramBubble } from '../src/telegram/dom-adapter.mjs';

function classList(...names) {
  const values = new Set(names);
  return { contains: name => values.has(name) };
}

function entity({ tagName = 'SPAN', text, href = null, classes = [], language = null, inPre = false }) {
  return {
    tagName,
    innerText: text,
    href,
    dataset: language ? { language } : {},
    classList: classList(...classes),
    getAttribute(name) {
      return name === 'href' ? href : null;
    },
    closest(selector) {
      return selector === 'pre' && inPre ? {} : null;
    },
  };
}

test('extracts structured Telegram speech entities from message DOM', () => {
  const nodes = [
    entity({ tagName: 'A', text: 'docs', href: 'https://example.com/a' }),
    entity({ tagName: 'A', text: '@alice', href: 'https://t.me/alice' }),
    entity({ tagName: 'A', text: '#release', href: 'https://t.me/example?hashtag=release' }),
    entity({ tagName: 'PRE', text: 'const x = 1', language: 'js' }),
    entity({ tagName: 'CODE', text: 'const x = 1', inPre: true }),
    entity({ text: 'secret', classes: ['spoiler'] }),
    entity({ tagName: 'BLOCKQUOTE', text: 'quoted' }),
  ];
  const textElement = {
    innerText: 'docs @alice #release const x = 1 secret quoted',
    querySelectorAll() {
      return nodes;
    },
  };
  const bubble = {
    dataset: { mid: '100', peerId: '-20' },
    classList: classList('bubble', 'is-in'),
    querySelector(selector) {
      if (selector === '.translatable-message') return textElement;
      if (selector === '.peer-title[data-peer-id]') {
        return { dataset: { peerId: '77' }, innerText: 'Author' };
      }
      return null;
    },
  };

  const message = extractTelegramBubble(bubble);
  assert.deepEqual(message.entities, [
    { type: 'link', text: 'docs', href: 'https://example.com/a', language: null, occurrence: null },
    { type: 'mention', text: '@alice', href: null, language: null, occurrence: null },
    { type: 'hashtag', text: '#release', href: null, language: null, occurrence: null },
    { type: 'pre', text: 'const x = 1', href: null, language: 'js', occurrence: null },
    { type: 'spoiler', text: 'secret', href: null, language: null, occurrence: null },
    { type: 'quote', text: 'quoted', href: null, language: null, occurrence: null },
  ]);
});

test('records the exact occurrence of repeated structured entity text', () => {
  const dom = new JSDOM(`<!doctype html>
    <div class="bubble is-in" data-mid="101" data-peer-id="-20">
      <span class="peer-title" data-peer-id="77">Author</span>
      <span class="translatable-message">ls обычный текст, потом <code>ls</code></span>
    </div>`);

  try {
    const bubble = dom.window.document.querySelector('.bubble[data-mid]');
    const message = extractTelegramBubble(bubble);
    const code = message.entities.find(item => item.type === 'code');

    assert.deepEqual(code, {
      type: 'code',
      text: 'ls',
      href: null,
      language: null,
      occurrence: 1,
    });
  } finally {
    dom.window.close();
  }
});
