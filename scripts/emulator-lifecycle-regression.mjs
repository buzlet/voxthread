// scripts/emulator-lifecycle-regression.mjs
import { execFileSync, spawn } from 'node:child_process';

const FIXTURE = 'telegram-group-long.html';
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function run(file, args = [], options = {}) {
  return execFileSync(file, args, {
    cwd: process.cwd(),
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    ...options,
  }).trim();
}

function probe(args = []) {
  return JSON.parse(run('node', [
    'scripts/cdp-runtime-smoke.mjs',
    `--fixture=${FIXTURE}`,
    ...args,
  ]));
}
async function ensureHttpServer() {
  const url = `http://127.0.0.1:8765/tests/fixtures/${FIXTURE}`;

  try {
    const response = await fetch(url);
    if (response.ok) return;
  } catch {}

  const server = spawn('python3', [
    '-m', 'http.server', '8765',
    '--bind', '0.0.0.0',
    '--directory', process.cwd(),
  ], {
    detached: true,
    stdio: 'ignore',
  });
  server.unref();

  for (let i = 0; i < 30; i += 1) {
    await sleep(150);
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {}
  }
  throw new Error('Fixture HTTP server did not start');
}

function wakefulness() {
  const output = run('./scripts/voxemu', [
    'adb', 'shell', 'dumpsys', 'power',
  ]);
  return output.match(/mWakefulness=(\w+)/)?.[1] ?? null;
}

async function togglePowerAndWait(expected) {
  run('./scripts/voxemu', [
    'adb', 'shell', 'input', 'keyevent', '26',
  ]);

  for (let i = 0; i < 30; i += 1) {
    await sleep(150);
    if (wakefulness() === expected) return;
  }

  throw new Error(`Android did not reach wakefulness=${expected}`);
}

async function ensureAwake() {
  if (wakefulness() === 'Awake') return;
  await togglePowerAndWait('Awake');
}
async function waitForInterruptedQueue() {
  let state = null;

  for (let i = 0; i < 30; i += 1) {
    await sleep(200);
    state = probe(['--inspect']);
    if (state.queue?.status === 'paused' && state.playerError) {
      return state;
    }
  }

  throw new Error(
    `Queue did not pause on sleep: ${JSON.stringify(state?.queue)}`,
  );
}

async function waitForSameMessageResume(messageId) {
  let state = null;

  for (let i = 0; i < 20; i += 1) {
    await sleep(150);
    state = probe(['--inspect']);

    if (
      state.queue?.status === 'playing'
      && state.queue?.current?.messageIds?.includes(messageId)
      && state.speaking
    ) {
      return state;
    }
  }
  throw new Error(
    `Interrupted message did not resume: ${JSON.stringify(state?.queue)}`,
  );
}

await ensureHttpServer();
run('node', ['scripts/build-userscript.mjs', '--dev']);
run('./scripts/voxemu', ['start']);
await ensureAwake();

const rev = Date.now();
run('./scripts/voxemu', [
  'adb', 'shell', 'am', 'start',
  '-a', 'android.intent.action.VIEW',
  '-d', `http://10.0.2.2:8765/tests/fixtures/${FIXTURE}?rev=${rev}`,
  'com.android.chrome',
]);

await sleep(1200);
run('./scripts/voxemu', ['cdp']);

const started = probe([
  '--pref=panelCollapsed=false',
  '--pref=autoResumeOnVisible=true',
  '--play',
]);

if (started.queue?.status !== 'playing' || !started.speaking) {
  throw new Error('Runtime did not start speech');
}
await sleep(250);
await togglePowerAndWait('Asleep');

const interrupted = await waitForInterruptedQueue();
const interruptedId = interrupted.queue.current?.messageIds?.[0];

if (!interruptedId) {
  throw new Error('Interrupted queue has no current message');
}

await togglePowerAndWait('Awake');

const resumed = await waitForSameMessageResume(interruptedId);
probe(['--inspect', '--stop']);

console.log(JSON.stringify({
  target: 'voxthread-api36',
  fixture: FIXTURE,
  queueLength: started.queue.length,
  interruptedMessageId: interruptedId,
  error: interrupted.playerError,
  sleptAtIndex: interrupted.queue.index,
  resumedAtIndex: resumed.queue.index,
  resumedSameMessage: resumed.queue.current.messageIds.includes(interruptedId),
}, null, 2));
