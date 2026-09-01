// scripts/cdp-media-session-probe.mjs
const base = process.env.CDP_BASE || 'http://127.0.0.1:9223';
const anchorArg = process.argv.find(arg => arg.startsWith('--anchor='));
const anchor = anchorArg?.slice('--anchor='.length) || 'none';
const inspectOnly = process.argv.includes('--inspect');
if (!['none', 'silent', 'audible'].includes(anchor)) {
  throw new Error('anchor must be none, silent or audible');
}

const pages = await fetch(`${base}/json/list`).then(response => response.json());
const page = pages
  .filter(item => {
    if (item.type !== 'page') return false;
    try { return new URL(item.url).pathname.includes('/tests/fixtures/telegram-group-'); }
    catch { return false; }
  })
  .sort((a, b) => {
    const ar = Number(new URL(a.url).searchParams.get('rev')) || 0;
    const br = Number(new URL(b.url).searchParams.get('rev')) || 0;
    return br - ar;
  })[0];
if (!page) throw new Error('VoxThread browser fixture page not found');

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

function cdp(method, params = {}) {
  const callId = ++id;
  ws.send(JSON.stringify({ id: callId, method, params }));
  return new Promise((resolve, reject) => pending.set(callId, { resolve, reject }));
}

async function evaluate(expression) {
  const result = await cdp('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (result.exceptionDetails) {
    const exception = result.exceptionDetails.exception?.description
      || result.exceptionDetails.text
      || 'Runtime.evaluate failed';
    throw new Error(exception);
  }
  return result.result?.value;
}

function wavDataUri({ audible }) {
  const sampleRate = 8000;
  const seconds = 4;
  const samples = sampleRate * seconds;
  const dataSize = samples * 2;
  const buffer = Buffer.alloc(44 + dataSize);
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVEfmt ', 8);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);
  for (let i = 0; i < samples; i += 1) {
    const sample = audible
      ? Math.round(Math.sin(2 * Math.PI * 440 * i / sampleRate) * 4096)
      : 0;
    buffer.writeInt16LE(sample, 44 + i * 2);
  }
  return `data:audio/wav;base64,${buffer.toString('base64')}`;
}

function inspectionExpression() {
  return `(() => {
    const audio = document.querySelector('#voxthread-media-anchor');
    return {
      mediaSessionAvailable: 'mediaSession' in navigator,
      playbackState: navigator.mediaSession?.playbackState ?? null,
      anchor: audio ? {
        mode: audio.dataset.voxthreadAnchor || null,
        paused: audio.paused,
        ended: audio.ended,
        currentTime: Number(audio.currentTime.toFixed(3)),
        duration: Number.isFinite(audio.duration) ? Number(audio.duration.toFixed(3)) : null,
        readyState: audio.readyState,
        volume: audio.volume,
      } : null,
      queue: window.__voxThreadApp?.queue?.snapshot ?? null,
      playerError: window.__voxThreadApp?.player?.lastError ?? null,
      speaking: Boolean(speechSynthesis.speaking),
    };
  })()`;
}

if (inspectOnly) {
  console.log(JSON.stringify(await evaluate(inspectionExpression()), null, 2));
  ws.close();
  process.exit(0);
}

const audioUri = anchor === 'none'
  ? ''
  : wavDataUri({ audible: anchor === 'audible' });

const configured = await evaluate(`(() => {
  const result = { available: 'mediaSession' in navigator, actions: [], failed: [] };
  if (!result.available) return result;

  for (const action of ['play', 'pause', 'stop', 'previoustrack', 'nexttrack']) {
    try {
      navigator.mediaSession.setActionHandler(action, () => {});
      result.actions.push(action);
    } catch (error) {
      result.failed.push({ action, error: String(error) });
    }
  }

  try {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: 'VoxThread', artist: 'Telegram Web reader', album: 'Media anchor experiment',
    });
  } catch (error) {
    result.failed.push({ action: 'metadata', error: String(error) });
  }

  const anchorMode = ${JSON.stringify(anchor)};
  if (anchorMode !== 'none') {
    const button = [...document.querySelectorAll('#voxthread-reader button')]
      .find(element => element.textContent.trim() === 'Play');
    if (!button) throw new Error('VoxThread Play button not found');
    button.addEventListener('click', () => {
      let audio = document.querySelector('#voxthread-media-anchor');
      if (!audio) {
        audio = document.createElement('audio');
        audio.id = 'voxthread-media-anchor';
        audio.dataset.voxthreadAnchor = anchorMode;
        audio.src = ${JSON.stringify(audioUri)};
        audio.loop = true;
        audio.preload = 'auto';
        audio.volume = 0.08;
        document.body.append(audio);
      }
      audio.play().catch(error => console.error('[VoxThread] media anchor', error));
    }, { once: true, capture: true });
  }

  return result;
})()`);

console.log(JSON.stringify(configured, null, 2));
ws.close();
