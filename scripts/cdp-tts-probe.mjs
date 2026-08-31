// scripts/cdp-tts-probe.mjs
const base = process.env.CDP_BASE || 'http://127.0.0.1:9223';
const touchArg = process.argv.find(arg => arg.startsWith('--touch='));
const touchLabel = touchArg ? decodeURIComponent(touchArg.slice('--touch='.length)) : null;
const pages = await fetch(`${base}/json/list`).then(r => r.json());
const page = pages.find(p => p.type === 'page' && /\/tests\/browser\/tts-probe\.html(?:[?#].*)?$/.test(p.url));
if (!page) throw new Error('VoxThread TTS probe page not found');
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
await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
function cdp(method, params = {}) {
  const callId = ++id;
  ws.send(JSON.stringify({ id: callId, method, params }));
  return new Promise((resolve, reject) => pending.set(callId, { resolve, reject }));
}
async function evaluate(expression) {
  const result = await cdp('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  return result.result?.value;
}
if (touchLabel) {
  const target = await evaluate(`(() => {
    const button = [...document.querySelectorAll('button')].find(el => el.textContent.trim() === ${JSON.stringify(touchLabel)});
    if (!button) return null;
    const r = button.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  })()`);
  if (!target) throw new Error(`Button not found: ${touchLabel}`);
  await cdp('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: target.x, y: target.y }] });
  await cdp('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await new Promise(resolve => setTimeout(resolve, 300));
}
const state = await evaluate(`(() => ({
  title: document.title,
  status: document.querySelector('#status')?.textContent || '',
  voiceCount: speechSynthesis.getVoices().length,
  voices: speechSynthesis.getVoices().slice(0, 20).map(v => ({ lang:v.lang,name:v.name,localService:v.localService,default:v.default })),
  russianVoices: speechSynthesis.getVoices().filter(v => /^ru[-_]/i.test(v.lang)).map(v => ({ lang:v.lang,name:v.name,localService:v.localService,default:v.default })),
  tts: window.__voxTtsProbe?.state || null,
}))()`);
console.log(JSON.stringify(state, null, 2));
ws.close();
