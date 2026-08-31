// scripts/cdp-open-peer.mjs
const base = process.env.CDP_BASE || 'http://127.0.0.1:9222';
const peerId = process.argv[2] || '777000';

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
  if (!msg.id) return;
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

async function evaluate(expression) {
  const result = await cdp('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  return result.result?.value;
}

const opened = await evaluate(`(() => {
  const rows = [...document.querySelectorAll('a[data-peer-id="${peerId}"]')];
  const el = rows.find(el => {
    const r = el.getBoundingClientRect();
    return el.offsetParent !== null && r.width > 0 && r.height > 0;
  });
  if (!el) return false;
  el.click();
  return true;
})()`);

if (!opened) throw new Error(`Peer ${peerId} not found`);
await new Promise(resolve => setTimeout(resolve, 1500));

const summary = await evaluate(`(() => {
  const all = [...document.querySelectorAll('*')];
  const interesting = all.filter(el =>
    /message|bubble|chat|peer/i.test(el.className || '') ||
    [...el.attributes].some(a => /mid|message|peer|from/i.test(a.name))
  );

  return {
    title: document.title,
    bodyTextLength: document.body?.innerText?.length || 0,
    candidates: interesting.slice(-80).map(el => ({
      tag: el.tagName,
      cls: typeof el.className === 'string' ? el.className.slice(0, 180) : '',
      attrs: Object.fromEntries([...el.attributes]
        .filter(a => /^(data-|id$)/.test(a.name))
        .map(a => [a.name, a.value])),
      text: (el.innerText || '').trim().replace(/\s+/g, ' ').slice(0, 180),
    })),
  };
})()`);

console.log(JSON.stringify(summary, null, 2));
ws.close();
