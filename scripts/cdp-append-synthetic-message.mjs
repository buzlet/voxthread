// scripts/cdp-append-synthetic-message.mjs
const base = process.env.CDP_BASE || 'http://127.0.0.1:9223';
const fixtureArg = process.argv.find(arg => arg.startsWith('--fixture='));
const midArg = process.argv.find(arg => arg.startsWith('--mid='));

const fixture = fixtureArg?.slice('--fixture='.length) || 'telegram-group-basic.html';
const mid = midArg?.slice('--mid='.length) || '5001';

if (!/^[a-z0-9.-]+\.html$/i.test(fixture)) throw new Error('Invalid fixture');
if (!/^\d+$/.test(mid)) throw new Error('Invalid mid');

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
  const root = document.querySelector('.chat.tabs-tab.active');
  if (!root) return { appended: false, reason: 'chat-root-missing' };

  const group = document.createElement('div');
  group.className = 'bubbles-group';

  const bubble = document.createElement('div');
  bubble.className = 'bubble is-in is-group-first is-group-last';
  bubble.dataset.mid = ${JSON.stringify(mid)};
  bubble.dataset.peerId = '-2002';
  bubble.dataset.timestamp = '1780000999';

  const author = document.createElement('span');
  author.className = 'peer-title';
  author.dataset.peerId = '99';
  author.textContent = 'Тестовый автор';

  const message = document.createElement('div');
  message.className = 'message spoilers-container';

  const text = document.createElement('span');
  text.className = 'translatable-message';
  text.textContent = 'Новое синтетическое сообщение для проверки live follow.';

  message.append(text);
  bubble.append(author, message);
  group.append(bubble);
  root.append(group);

  return { appended: true, mid: bubble.dataset.mid };
})()`;

const result = await cdp('Runtime.evaluate', {
  expression,
  returnByValue: true,
});

console.log(JSON.stringify(result.result?.value, null, 2));
ws.close();
