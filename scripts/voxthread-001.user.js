// voxthread-001.user.js
// ==UserScript==
// @name         VoxThread Diagnostics
// @namespace    https://github.com/buzlet/voxthread
// @version      0.1.0
// @description  Verify VoxThread injection and inspect visible Telegram messages.
// @match        https://web.telegram.org/k/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(() => {
  'use strict';

  const VERSION = '0.1.0';
  const PANEL_ID = 'voxthread-diagnostics';

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
    const messages = [...document.querySelectorAll('.bubble[data-mid]')]
      .filter(isVisible)
      .map(extractMessage)
      .filter(message => message.text);

    window.__voxThreadDiag = {
      version: VERSION,
      scannedAt: new Date().toISOString(),
      messages,
    };

    return messages;
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
      'box-shadow:0 3px 14px #0008', 'max-width:240px'
    ].join(';');

    const title = document.createElement('div');
    title.textContent = `VoxThread ${VERSION}`;
    title.style.cssText = 'font-weight:700;margin-bottom:8px';

    const status = document.createElement('div');
    status.textContent = 'Injected. Press Scan.';
    status.style.cssText = 'margin-bottom:8px;opacity:.85';

    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = 'Scan visible messages';
    button.style.cssText = [
      'border:0', 'border-radius:7px', 'padding:7px 9px',
      'background:#2aabee', 'color:#fff', 'font-weight:600'
    ].join(';');

    button.addEventListener('click', () => {
      const messages = scanVisibleMessages();
      const mids = messages.slice(0, 4).map(message => message.mid).join(', ');
      status.textContent = `${messages.length} visible message(s)` +
        (mids ? ` · mid: ${mids}` : '');
      console.info('[VoxThread] scan', window.__voxThreadDiag);
    });

    panel.append(title, status, button);
    document.body.append(panel);
    console.info(`[VoxThread] injected v${VERSION}`);
  }

  createPanel();
})();
