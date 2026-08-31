// scripts/cdp-runtime-smoke.mjs
import fs from 'node:fs/promises';

const base = process.env.CDP_BASE || 'http://127.0.0.1:9223';
const shouldPlay = process.argv.includes('--play');
const inspectOnly = process.argv.includes('--inspect');
const prefArgs = process.argv.filter(arg => arg.startsWith('--pref='));
const fixtureArg = process.argv.find(arg => arg.startsWith('--fixture='));
const fixture = fixtureArg?.slice('--fixture='.length) || 'telegram-group-basic.html';
if (!/^[a-z0-9.-]+\.html$/i.test(fixture)) throw new Error('Invalid fixture name');

function parsePreferenceValue(value) {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return value;
}

const preferencePatch = Object.fromEntries(
  prefArgs.map(arg => {
    const pair = arg.slice('--pref='.length);
    const index = pair.indexOf('=');
    if (index < 1) throw new Error(`Invalid preference argument: ${arg}`);
    return [
      pair.slice(0, index),
      parsePreferenceValue(pair.slice(index + 1)),
    ];
  }),
);

const pages = await fetch(`${base}/json/list`).then(response => response.json());
const page = pages
  .filter(item => {
    if (item.type !== 'page') return false;
    try {
      return new URL(item.url).pathname === `/tests/fixtures/${fixture}`;
    } catch {
      return false;
    }
  })
  .sort((a, b) => Number(b.id) - Number(a.id))[0];

if (!page) throw new Error('Telegram runtime fixture page not found');

const ws = new WebSocket(page.webSocketDebuggerUrl);
let id = 0;
const pending = new Map();

ws.onmessage = ({ data }) => {
  const message = JSON.parse(data);
  const request = pending.get(message.id);
  if (!request) return;
  pending.delete(message.id);
  message.error ? request.reject(message.error) : request.resolve(message.result);
};

await new Promise((resolve, reject) => {
  ws.onopen = resolve;
  ws.onerror = reject;
});

function cdp(method, params = {}) {
  const callId = ++id;
  ws.send(JSON.stringify({ id: callId, method, params }));
  return new Promise((resolve, reject) =>
    pending.set(callId, { resolve, reject })
  );
}

async function evaluate(expression) {
  const result = await cdp('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });

  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.text || 'Runtime.evaluate failed');
  }

  return result.result?.value;
}

if (inspectOnly && !await evaluate('Boolean(window.__voxThreadApp)')) {
  throw new Error('VoxThread runtime is not injected');
}

if (!inspectOnly && !await evaluate('Boolean(window.__voxThreadApp)')) {
  const bundle = await fs.readFile('dist/voxthread-dev.js', 'utf8');
  await evaluate(bundle);
  await new Promise(resolve => setTimeout(resolve, 150));
}

if (Object.keys(preferencePatch).length) {
  await evaluate(
    `window.__voxThreadApp.setReaderPreferences(${JSON.stringify(preferencePatch)})`,
  );
}

const build = inspectOnly
  ? null
  : await evaluate('window.__voxThreadApp.buildQueue()');

if (shouldPlay) {
  const playButton = await evaluate(`(() => {
    const button = [...document.querySelectorAll('#voxthread-reader button')]
      .find(element => element.textContent.trim() === 'Play');
    if (!button) return null;
    const rect = button.getBoundingClientRect();
    return {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    };
  })()`);

  if (!playButton) throw new Error('VoxThread Play button not found');

  await cdp('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x: playButton.x, y: playButton.y }],
  });
  await cdp('Input.dispatchTouchEvent', {
    type: 'touchEnd',
    touchPoints: [],
  });
  await new Promise(resolve => setTimeout(resolve, 700));
}

const state = await evaluate(`(() => ({
  panelPresent: Boolean(document.querySelector('#voxthread-reader')),
  version: window.__voxThreadApp?.version ?? null,
  build: ${JSON.stringify(build)},
  queue: window.__voxThreadApp?.queue?.snapshot ?? null,
  playerError: window.__voxThreadApp?.player?.lastError ?? null,
  preferences: window.__voxThreadApp?.getReaderPreferences?.() ?? null,
  controlsHidden: document.querySelector('#voxthread-reader > div:nth-child(2)')?.hidden ?? null,
  settingsHidden: document.querySelector('#voxthread-reader > details')?.hidden ?? null,
  voiceCount: speechSynthesis.getVoices().length,
  speaking: speechSynthesis.speaking,
  pending: speechSynthesis.pending,
}))()`);

console.log(JSON.stringify(state, null, 2));
ws.close();
