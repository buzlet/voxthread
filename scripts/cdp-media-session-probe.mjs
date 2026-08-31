// scripts/cdp-media-session-probe.mjs
const base = process.env.CDP_BASE || 'http://127.0.0.1:9223';
const anchorAudio = process.argv.includes('--anchor-audio');

const pages = await fetch(`${base}/json/list`).then(response => response.json());
const page = pages
  .filter(item => item.type === 'page')
  .sort((a, b) => Number(b.id) - Number(a.id))
  .find(item => item.url.includes('/tests/fixtures/telegram-group-'));

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

function silentWavDataUri() {
  const sampleRate = 8000;
  const samples = sampleRate;
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
  return `data:audio/wav;base64,${buffer.toString('base64')}`;
}

const silentUri = anchorAudio ? silentWavDataUri() : '';

const expression = `(() => {
  if (!('mediaSession' in navigator)) {
    return { available: false };
  }

  const actions = [];
  const failed = [];

  for (const action of ['play', 'pause', 'stop', 'previoustrack', 'nexttrack']) {
    try {
      navigator.mediaSession.setActionHandler(action, () => {});
      actions.push(action);
    } catch (error) {
      failed.push({ action, error: String(error) });
    }
  }

  if (${anchorAudio ? 'true' : 'false'}) {
    const button = [...document.querySelectorAll('#voxthread-reader button')]
      .find(element => element.textContent.trim() === 'Play');

    if (button) {
      button.addEventListener('click', () => {
        let audio = document.querySelector('#voxthread-media-anchor');
        if (!audio) {
          audio = document.createElement('audio');
          audio.id = 'voxthread-media-anchor';
          audio.src = ${JSON.stringify(silentUri)};
          audio.loop = true;
          audio.preload = 'auto';
          document.body.append(audio);
        }
        audio.play().catch(error => console.error('[VoxThread] anchor audio', error));
      }, { once: true, capture: true });
    }
  }

  try {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: 'VoxThread',
      artist: 'Telegram Web reader',
      album: 'Development probe',
    });
    navigator.mediaSession.playbackState = 'playing';
  } catch (error) {
    failed.push({ action: 'metadata', error: String(error) });
  }

  return {
    available: true,
    playbackState: navigator.mediaSession.playbackState,
    actions,
    failed,
  };
})()`;

const result = await cdp('Runtime.evaluate', {
  expression,
  returnByValue: true,
  awaitPromise: true,
});

if (anchorAudio) {
  const target = await cdp('Runtime.evaluate', {
    expression: `(() => {
      const button = [...document.querySelectorAll('#voxthread-reader button')]
        .find(element => element.textContent.trim() === 'Play');
      if (!button) return null;
      const rect = button.getBoundingClientRect();
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    })()`,
    returnByValue: true,
  });

  const point = target.result?.value;
  if (!point) throw new Error('VoxThread Play button not found');

  await cdp('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x: point.x, y: point.y }],
  });
  await cdp('Input.dispatchTouchEvent', {
    type: 'touchEnd',
    touchPoints: [],
  });
  await new Promise(resolve => setTimeout(resolve, 1000));
}

console.log(JSON.stringify(result.result?.value, null, 2));
ws.close();
