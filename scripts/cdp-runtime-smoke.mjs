// scripts/cdp-runtime-smoke.mjs
import fs from 'node:fs/promises';

const base = process.env.CDP_BASE || 'http://127.0.0.1:9223';
const shouldPlay = process.argv.includes('--play');

const pages = await fetch(`${base}/json/list`).then(response => response.json());
const page = pages
  .filter(item =>
    item.type === 'page'
    && /\/tests\/fixtures\/telegram-group-basic\.html(?:[?#].*)?$/.test(item.url)
  )
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

if (!await evaluate('Boolean(window.__voxThreadApp)')) {
  const bundle = await fs.readFile('dist/voxthread-dev.js', 'utf8');
  await evaluate(bundle);
  await new Promise(resolve => setTimeout(resolve, 150));
}

const build = await evaluate('window.__voxThreadApp.buildQueue()');

if (shouldPlay) {
  await evaluate('window.__voxThreadApp.player.play(); true');
  await new Promise(resolve => setTimeout(resolve, 500));
}

const state = await evaluate(`(() => ({
  panelPresent: Boolean(document.querySelector('#voxthread-reader')),
  version: window.__voxThreadApp?.version ?? null,
  build: ${JSON.stringify(build)},
  queue: window.__voxThreadApp?.queue?.snapshot ?? null,
  playerError: window.__voxThreadApp?.player?.lastError ?? null,
  voiceCount: speechSynthesis.getVoices().length,
}))()`);

console.log(JSON.stringify(state, null, 2));
ws.close();
