// scripts/cdp-userscript-install.mjs
const base = process.env.CDP_BASE || 'http://127.0.0.1:9222';
const apply = process.argv.includes('--apply');

const pages = await fetch(`${base}/json/list`).then(r => r.json());
const page = pages.find(p =>
  p.type === 'page' &&
  p.url.startsWith('chrome-extension://iikmkjmpaadaobahmlepeloendndfphd/ask.html')
);
if (!page) throw new Error('Tampermonkey userscript prompt not found');

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
  const candidates = [...document.querySelectorAll('button, input, a')]
    .map(el => ({
      el,
      label: (el.innerText || el.value || el.textContent || '').trim(),
      rect: el.getBoundingClientRect(),
    }))
    .filter(item =>
      item.el.offsetParent !== null && item.rect.width > 0 && item.rect.height > 0
    );

  const labels = candidates.map(item => item.label).filter(Boolean);
  const action = candidates.find(item => /^(install|update|reinstall)$/i.test(item.label));
  if (${apply ? 'true' : 'false'} && action) action.el.click();

  return {
    title: document.title,
    labels: labels.slice(0, 40),
    action: action?.label || null,
    applied: ${apply ? 'Boolean(action)' : 'false'},
  };
})()`;

const result = await cdp('Runtime.evaluate', {
  expression,
  returnByValue: true,
  awaitPromise: true,
});

console.log(JSON.stringify(result.result?.value, null, 2));
ws.close();
