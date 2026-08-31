// scripts/emulator-smoke.mjs
import { execFileSync, spawn } from 'node:child_process';

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function run(file, args = [], options = {}) {
  return execFileSync(file, args, {
    cwd: process.cwd(),
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    ...options,
  }).trim();
}

async function ensureHttpServer() {
  const url = 'http://127.0.0.1:8765/tests/browser/tts-probe.html';
  try {
    const response = await fetch(url);
    if (response.ok) return;
  } catch {}

  const server = spawn('python3', [
    '-m', 'http.server', '8765', '--bind', '0.0.0.0', '--directory', process.cwd(),
  ], { detached: true, stdio: 'ignore' });
  server.unref();

  for (let i = 0; i < 20; i += 1) {
    await sleep(150);
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {}
  }
  throw new Error('VoxThread HTTP fixture server did not start');
}

function probe(args = []) {
  return JSON.parse(run('node', ['scripts/cdp-tts-probe.mjs', ...args]));
}

await ensureHttpServer();
run('./scripts/voxemu', ['start']);
run('./scripts/voxemu', ['probe']);
await sleep(1200);
run('./scripts/voxemu', ['cdp']);

let state;
for (let i = 0; i < 60; i += 1) {
  try {
    state = probe();
    if (state.voiceCount > 0) break;
  } catch {}
  await sleep(500);
  if (i === 2) {
    try { probe(['--touch=Voices']); } catch {}
  }
}

if (!state || state.voiceCount < 1) throw new Error('Chrome Web Speech exposed no voices');
if (!state.russianVoices?.length) throw new Error('Chrome Web Speech exposed no Russian voice');

probe(['--touch=Speak%2020']);

let started = false;
for (let i = 0; i < 20; i += 1) {
  await sleep(500);
  state = probe();
  if ((state.tts?.started ?? 0) > 0) {
    started = true;
    break;
  }
}

probe(['--touch=Stop']);
if (!started) throw new Error('Web Speech queue did not start');

console.log(JSON.stringify({
  target: 'voxthread-api36',
  android: 16,
  chromeVoices: state.voiceCount,
  russianVoices: state.russianVoices.length,
  ttsStarted: state.tts.started,
  errors: state.tts.errors?.length ?? 0,
}, null, 2));
