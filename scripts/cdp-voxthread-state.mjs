// scripts/cdp-voxthread-state.mjs
const base = process.env.CDP_BASE || 'http://127.0.0.1:9222';
const peerArg = process.argv.find(arg => arg.startsWith('--peer='));
const peerId = peerArg?.slice('--peer='.length) || null;
const shouldScan = process.argv.includes('--scan');
const speakArg = process.argv.find(arg => arg.startsWith('--speak='));
const speakCount = Number(speakArg?.slice('--speak='.length) || 0);
const shouldStop = process.argv.includes('--stop');
const touchArg = process.argv.find(arg => arg.startsWith('--touch-button='));
const touchLabel = touchArg?.slice('--touch-button='.length) || null;

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

async function evaluate(expression) {
  const result = await cdp('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  return result.result?.value;
}

if (peerId) {
  const target = await evaluate(`(() => {
    const rows = [...document.querySelectorAll('a[data-peer-id="${peerId}"]')];
    const el = rows.find(el => {
      const r = el.getBoundingClientRect();
      return el.offsetParent !== null && r.width > 0 && r.height > 0;
    });
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  })()`);

  if (!target) throw new Error(`Visible peer ${peerId} not found`);
  await cdp('Input.dispatchTouchEvent', {
    type: 'touchStart', touchPoints: [{ x: target.x, y: target.y }],
  });
  await cdp('Input.dispatchTouchEvent', {
    type: 'touchEnd', touchPoints: [],
  });
  await new Promise(resolve => setTimeout(resolve, 1200));
}

if (touchLabel) {
  const target = await evaluate(`(() => {
    const buttons = [...document.querySelectorAll('#voxthread-diagnostics button')];
    const el = buttons.find(button => button.textContent?.trim() === ${JSON.stringify(touchLabel)});
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  })()`);
  if (!target) throw new Error(`Button ${touchLabel} not found`);
  await cdp('Input.dispatchTouchEvent', {
    type: 'touchStart', touchPoints: [{ x: target.x, y: target.y }],
  });
  await cdp('Input.dispatchTouchEvent', {
    type: 'touchEnd', touchPoints: [],
  });
  await new Promise(resolve => setTimeout(resolve, 300));
}

if (shouldScan) {
  await evaluate(`(() => {
    const panel = document.getElementById('voxthread-diagnostics');
    const button = panel?.querySelector('button');
    if (!button) return false;
    button.click();
    return true;
  })()`);
}

if (shouldStop) {
  await evaluate(`window.__voxThread?.stopSpeech?.()`);
}

if (speakCount > 0) {
  await evaluate(`window.__voxThread?.speakSynthetic?.(${speakCount})`);
  await new Promise(resolve => setTimeout(resolve, 500));
}

const state = await evaluate(`(() => {
  const panel = document.getElementById('voxthread-diagnostics');
  const state = window.__voxThreadDiag || null;
  return {
    panelPresent: Boolean(panel),
    panelText: panel?.innerText || '',
    version: state?.version || null,
    scannedAt: state?.scannedAt || null,
    messageCount: state?.messages?.length || 0,
    mids: state?.messages?.map(message => message.mid) || [],
    voiceCount: state?.voices?.length || 0,
    voices: state?.voices?.slice(0, 40) || [],
    tts: state?.tts || null,
  };
})()`);

console.log(JSON.stringify(state, null, 2));
ws.close();
