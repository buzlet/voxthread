// scripts/voxthread-dev-loader.user.js
// ==UserScript==
// @name         VoxThread Diagnostics
// @namespace    https://github.com/buzlet/voxthread
// @version      0.5.1
// @description  Load the current VoxThread development bundle from u24.
// @match        https://web.telegram.org/k/*
// @run-at       document-idle
// @grant        GM_xmlhttpRequest
// @connect      192.168.1.190
// ==/UserScript==

(() => {
  'use strict';

  const DEV_URL = 'http://192.168.1.190:8765/dist/voxthread-dev.js';
  document.documentElement.dataset.voxthreadLoader = '0.5.1';
  document.documentElement.dataset.voxthreadLoaderStatus = 'requesting';

  GM_xmlhttpRequest({
    method: 'GET',
    url: `${DEV_URL}?ts=${Date.now()}`,
    headers: {
      'Cache-Control': 'no-cache',
    },
    onload(response) {
      document.documentElement.dataset.voxthreadLoaderStatus = `http-${response.status}`;
      if (response.status < 200 || response.status >= 300) {
        console.error(`[VoxThread] dev bundle HTTP ${response.status}`);
        return;
      }

      try {
        (0, eval)(`${response.responseText}\n//# sourceURL=voxthread-dev.js`);
        document.documentElement.dataset.voxthreadLoaderStatus = 'executed';
      } catch (error) {
        console.error('[VoxThread] dev bundle failed', error);
      }
    },
    onerror(error) {
      document.documentElement.dataset.voxthreadLoaderStatus = 'request-error';
      console.error('[VoxThread] dev bundle request failed', error);
    },
  });
})();
