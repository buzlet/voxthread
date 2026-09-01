// scripts/cdp-remove-fixture-bubble.mjs
const base = process.env.CDP_BASE || 'http://127.0.0.1:9223';
const fixtureArg = process.argv.find(arg => arg.startsWith('--fixture='));
const midArg = process.argv.find(arg => arg.startsWith('--mid='));
const fixture = fixtureArg?.slice('--fixture='.length) || 'telegram-group-basic.html';
const mid = midArg?.slice('--mid='.length);
if (!mid) throw new Error('--mid is required');

const pages = await fetch(`${base}/json/list`).then(response => response.json());
const page = pages
  .filter(item => {
    if (item.type !== 'page') return false;
    try { return new URL(item.url).pathname === `/tests/fixtures/${fixture}`; }
    catch { return false; }
  })
  .sort((a, b) => {
    const ar = Number(new URL(a.url).searchParams.get('rev')) || 0;
    const br = Number(new URL(b.url).searchParams.get('rev')) || 0;
    return br - ar;
  })[0];
if (!page) throw new Error('Fixture page not found');

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
await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });

const callId = ++id;
ws.send(JSON.stringify({
  id: callId,
  method: 'Runtime.evaluate',
  params: {
    expression: `(() => {
      const bubble = document.querySelector('.bubble[data-mid=${JSON.stringify(mid)}]');
      if (!bubble) return false;
      bubble.remove();
      return true;
    })()`,
    returnByValue: true,
  },
}));
const result = await new Promise((resolve, reject) => pending.set(callId, { resolve, reject }));
if (result.exceptionDetails) throw new Error(result.exceptionDetails.text || 'Runtime.evaluate failed');
if (result.result?.value !== true) throw new Error(`Bubble not found: ${mid}`);
console.log(JSON.stringify({ removed: mid }));
ws.close();
