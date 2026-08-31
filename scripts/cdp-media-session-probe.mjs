// scripts/cdp-media-session-probe.mjs
const base = process.env.CDP_BASE || 'http://127.0.0.1:9223';

const pages = await fetch(`${base}/json/list`).then(response => response.json());
const page = pages
  .filter(item => item.type === 'page')
  .sort((a, b) => Number(b.id) - Number(a.id))
  .find(item => item.url.includes('/tests/fixtures/telegram-group-'));

if (!page) throw new Error('VoxThread browser fixture page not found');

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

const expression = `(() => {
  if (!('mediaSession' in navigator)) {
    return { available: false };
  }

  const actions = [];
  const failed = [];

  for (const action of ['play', 'pause', 'stop', 'previoustrack', 'nexttrack']) {
    try {
      navigator.mediaSession.setActionHandler(action, () => {});
      actions.push(action);
    } catch (error) {
      failed.push({ action, error: String(error) });
    }
  }

  try {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: 'VoxThread',
      artist: 'Telegram Web reader',
      album: 'Development probe',
    });
    navigator.mediaSession.playbackState = 'playing';
  } catch (error) {
    failed.push({ action: 'metadata', error: String(error) });
  }

  return {
    available: true,
    playbackState: navigator.mediaSession.playbackState,
    actions,
    failed,
  };
})()`;

const result = await cdp('Runtime.evaluate', {
  expression,
  returnByValue: true,
  awaitPromise: true,
});

console.log(JSON.stringify(result.result?.value, null, 2));
ws.close();
