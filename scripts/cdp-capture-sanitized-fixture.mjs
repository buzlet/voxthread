// scripts/cdp-capture-sanitized-fixture.mjs
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
  const peerMap = new Map();
  let peerSeq = 0;
  const anonPeer = value => {
    if (!value) return value;
    if (!peerMap.has(value)) peerMap.set(value, 'peer-' + (++peerSeq));
    return peerMap.get(value);
  };

  const sanitize = (source, index) => {
    const clone = source.cloneNode(true);

    for (const el of [clone, ...clone.querySelectorAll('*')]) {
      for (const attr of [...el.attributes]) {
        const name = attr.name;
        if (name === 'data-peer-id') el.setAttribute(name, anonPeer(attr.value));
        else if (name === 'data-mid') el.setAttribute(name, 'message-' + (index + 1));
        else if (name === 'data-timestamp') el.setAttribute(name, '0');
        else if (/^(href|src|srcset)$/i.test(name)) el.removeAttribute(name);
      }

      if (el.tagName === 'IMG' && el.hasAttribute('alt')) {
        el.setAttribute('alt', 'EMOJI');
      }
    }

    const walker = document.createTreeWalker(clone, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    for (const node of nodes) {
      if (node.nodeValue.trim()) node.nodeValue = 'TEXT';
    }

    return clone.outerHTML;
  };

  const bubbles = [...document.querySelectorAll('.bubble[data-mid]')]
    .filter(el => {
      const r = el.getBoundingClientRect();
      return el.offsetParent !== null && r.width > 0 && r.height > 0;
    });

  return {
    schema: 1,
    capturedFrom: 'Telegram Web K',
    count: bubbles.length,
    bubbles: bubbles.map(sanitize),
  };
})()`;

const result = await cdp('Runtime.evaluate', {
  expression,
  returnByValue: true,
  awaitPromise: true,
});

console.log(JSON.stringify(result.result?.value, null, 2));
ws.close();
