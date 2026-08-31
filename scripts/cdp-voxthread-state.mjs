// scripts/cdp-voxthread-state.mjs
const base = process.env.CDP_BASE || 'http://127.0.0.1:9222';
const pages = await fetch(`${base}/json/list`).then(r => r.json());
const page = pages.find(p =>
  p.type === 'page' && p.url.startsWith('https://web.telegram.org/k/')
);
if (!page) throw new Error('Telegram Web K page not found');

const ws = new WebSocket(page.webSocketDebuggerUrl);
let id = 0;
const pending = new Map();
ws.onmessage = ({ data }) => {
  const msg = JSON.parse(data);
  const p = pending.get(msg.id);
  if (!p) return;
  pending.delete(msg.id);
  msg.error ? p.reject(msg.error) : p.resolve(msg.result);
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
  const panel = document.getElementById('voxthread-diagnostics');
  const state = window.__voxThreadDiag || null;
  return {
    panelPresent: Boolean(panel),
    panelText: panel?.innerText || '',
    version: state?.version || null,
    scannedAt: state?.scannedAt || null,
    messageCount: state?.messages?.length || 0,
    mids: state?.messages?.map(message => message.mid) || [],
  };
})()`;

const result = await cdp('Runtime.evaluate', {
  expression,
  returnByValue: true,
  awaitPromise: true,
});

console.log(JSON.stringify(result.result?.value, null, 2));
ws.close();
