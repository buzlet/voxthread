// scripts/cdp-dom-inspect.mjs
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

const summary = await evaluate(`(() => {
  const all = [...document.querySelectorAll('*')];
  const classCount = {};
  for (const el of all) {
    for (const c of el.classList || []) {
      classCount[c] = (classCount[c] || 0) + 1;
    }
  }
  return {
    title: document.title,
    url: location.href,
    bodyTextLength: document.body?.innerText?.length || 0,
    elementCount: all.length,
    topClasses: Object.entries(classCount)
      .sort((a,b) => b[1] - a[1])
      .slice(0, 40),
    dataAttrs: all
      .flatMap(el => [...el.attributes]
        .filter(a => a.name.startsWith('data-'))
        .map(a => [el.tagName, a.name, a.value]))
      .slice(0, 80),
  };
})()`);

console.log(JSON.stringify(summary, null, 2));
ws.close();
