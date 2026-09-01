// scripts/cdp-tts-probe.mjs
const base = process.env.CDP_BASE || 'http://127.0.0.1:9223';
const touchArg = process.argv.find(arg => arg.startsWith('--touch='));
const touchLabel = touchArg
  ? decodeURIComponent(touchArg.slice('--touch='.length))
  : null;

function probeRevision(page) {
  try {
    const url = new URL(page.url);
    if (url.pathname !== '/tests/browser/tts-probe.html') return -1;
    const revision = Number(url.searchParams.get('rev'));
    return Number.isFinite(revision) ? revision : 0;
  } catch {
    return -1;
  }
}

const pages = await fetch(`${base}/json/list`).then(response => response.json());
const page = pages
  .filter(page => page.type === 'page' && probeRevision(page) >= 0)
  .sort((left, right) => probeRevision(right) - probeRevision(left))[0];

if (!page) throw new Error('VoxThread TTS probe page not found');

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

async function evaluate(expression) {
  const result = await cdp('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });

  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.text || 'Runtime.evaluate failed');
  }

  return result.result?.value;
}

async function waitForTouchTarget(label) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const target = await evaluate(`(() => {
      const button = [...document.querySelectorAll('button')]
        .find(element => element.textContent.trim() === ${JSON.stringify(label)});
      if (!button) return null;
      const rect = button.getBoundingClientRect();
      if (!rect.width || !rect.height) return null;
      return {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      };
    })()`);

    if (target) return target;
    await new Promise(resolve => setTimeout(resolve, 150));
  }

  throw new Error(`Button not ready: ${label}`);
}

if (touchLabel) {
  const target = await waitForTouchTarget(touchLabel);
  await cdp('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x: target.x, y: target.y }],
  });
  await cdp('Input.dispatchTouchEvent', {
    type: 'touchEnd',
    touchPoints: [],
  });
  await new Promise(resolve => setTimeout(resolve, 300));
}

const state = await evaluate(`(() => ({
  title: document.title,
  status: document.querySelector('#status')?.textContent || '',
  voiceCount: speechSynthesis.getVoices().length,
  voices: speechSynthesis.getVoices().slice(0, 20).map(voice => ({
    lang: voice.lang,
    name: voice.name,
    localService: voice.localService,
    default: voice.default,
  })),
  russianVoices: speechSynthesis.getVoices()
    .filter(voice => /^ru[-_]/i.test(voice.lang))
    .map(voice => ({
      lang: voice.lang,
      name: voice.name,
      localService: voice.localService,
      default: voice.default,
    })),
  tts: window.__voxTtsProbe?.state || null,
}))()`);

console.log(JSON.stringify(state, null, 2));
ws.close();
