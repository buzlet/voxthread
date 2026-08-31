// scripts/cdp-page-navigate.mjs
const base = process.env.CDP_BASE || 'http://127.0.0.1:9222';
const urlArg = process.argv.find(arg => arg.startsWith('--url='));
const matchArg = process.argv.find(arg => arg.startsWith('--match='));

const url = urlArg?.slice('--url='.length);
const match = matchArg?.slice('--match='.length) || 'web.telegram.org';

if (!url) throw new Error('Usage: node scripts/cdp-page-navigate.mjs --url=<url> [--match=<text>]');

const pages = await fetch(`${base}/json/list`).then(response => response.json());
const page = pages.find(item =>
  item.type === 'page' && item.url.includes(match)
);

if (!page) throw new Error(`CDP page matching ${match} not found`);

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

const result = await cdp('Page.navigate', { url });
console.log(JSON.stringify({
  target: page.url,
  navigateTo: url,
  frameId: result.frameId ?? null,
  errorText: result.errorText ?? null,
}, null, 2));

ws.close();
