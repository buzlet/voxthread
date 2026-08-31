// scripts/emulator-tts-matrix.mjs
import fs from 'node:fs/promises';
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

function adb(...args) {
  return run('./scripts/voxemu', ['adb', ...args]);
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
  ], { detached: true, stdio: 'ignore' });
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
  return adb('shell', 'dumpsys', 'power').match(/mWakefulness=(\w+)/)?.[1] ?? null;
}

function keyguardLocked() {
  const window = adb('shell', 'dumpsys', 'window');
  return /mDreamingLockscreen=true|isStatusBarKeyguard=true|mShowingLockscreen=true|showing=true/.test(window);
}

async function power(expected) {
  adb('shell', 'input', 'keyevent', '26');
  for (let i = 0; i < 40; i += 1) {
    await sleep(150);
    if (wakefulness() === expected) return;
  }
  throw new Error(`Android did not reach wakefulness=${expected}`);
}

async function ensureAwake() {
  if (wakefulness() !== 'Awake') await power('Awake');
}

async function openFixture() {
  await ensureAwake();
  const rev = Date.now();
  adb(
    'shell', 'am', 'start',
    '-a', 'android.intent.action.VIEW',
    '-d', `http://10.0.2.2:8765/tests/fixtures/${FIXTURE}?rev=${rev}`,
    'com.android.chrome',
  );
  await sleep(1200);
  run('./scripts/voxemu', ['cdp']);
}

async function startSpeech() {
  const state = probe([
    '--pref=panelCollapsed=false',
    '--pref=autoResumeOnVisible=true',
    '--play',
  ]);
  if (state.queue?.status !== 'playing') {
    throw new Error(`Speech did not start: ${JSON.stringify(state.queue)}`);
  }
  await sleep(300);
  return probe(['--inspect']);
}

function compact(state) {
  return {
    queueStatus: state?.queue?.status ?? null,
    queueIndex: state?.queue?.index ?? null,
    messageId: state?.queue?.current?.messageIds?.[0] ?? null,
    speaking: Boolean(state?.speaking),
    playerError: state?.playerError ?? null,
  };
}

async function inspectSettled(maxMs = 1800) {
  let state = probe(['--inspect']);
  const loops = Math.max(1, Math.ceil(maxMs / 200));
  for (let i = 0; i < loops; i += 1) {
    if (state.playerError || state.queue?.status !== 'playing') return state;
    await sleep(200);
    state = probe(['--inspect']);
  }
  return state;
}

await fs.mkdir('artifacts', { recursive: true });
await ensureHttpServer();
run('node', ['scripts/build-userscript.mjs', '--dev']);
run('./scripts/voxemu', ['start']);
await openFixture();

const report = {
  target: 'GitHub/API36 generic Android emulator',
  fixture: FIXTURE,
  measuredAt: new Date().toISOString(),
  scenarios: {},
};

// Foreground baseline.
let started = await startSpeech();
report.scenarios.foreground = compact(started);
probe(['--inspect', '--stop']);

// App backgrounded while the display stays on.
started = await startSpeech();
const backgroundMessage = compact(started).messageId;
adb('shell', 'input', 'keyevent', 'KEYCODE_HOME');
await sleep(1000);
let state = await inspectSettled(600);
report.scenarios.background = {
  ...compact(state),
  sameMessage: compact(state).messageId === backgroundMessage,
  wakefulness: wakefulness(),
};
adb('shell', 'monkey', '-p', 'com.android.chrome', '-c', 'android.intent.category.LAUNCHER', '1');
await sleep(700);
probe(['--inspect', '--stop']);

// Display off / Android asleep.
await openFixture();
started = await startSpeech();
const screenOffMessage = compact(started).messageId;
await power('Asleep');
state = await inspectSettled();
report.scenarios.screenOff = {
  ...compact(state),
  sameMessage: compact(state).messageId === screenOffMessage,
  wakefulness: wakefulness(),
};
await power('Awake');
await sleep(500);
const resumedScreenOff = await inspectSettled(1200);
report.scenarios.screenOffAfterWake = {
  ...compact(resumedScreenOff),
  sameMessage: compact(resumedScreenOff).messageId === screenOffMessage,
};
probe(['--inspect', '--stop']);

// Secure keyguard is enabled only for this disposable emulator. This makes the
// locked-screen state distinguishable from a simple display-off measurement.
let secureLockConfigured = false;
try {
  adb('shell', 'locksettings', 'set-pin', '2468');
  secureLockConfigured = true;
  await openFixture();
  started = await startSpeech();
  const lockedMessage = compact(started).messageId;
  await power('Asleep');
  await power('Awake');
  await sleep(500);
  state = await inspectSettled(1200);
  report.scenarios.lockedScreen = {
    ...compact(state),
    sameMessage: compact(state).messageId === lockedMessage,
    keyguardLocked: keyguardLocked(),
    wakefulness: wakefulness(),
  };
} catch (error) {
  report.scenarios.lockedScreen = {
    unsupported: true,
    error: String(error?.message || error),
  };
} finally {
  if (secureLockConfigured) {
    try {
      adb('shell', 'locksettings', 'clear', '--old', '2468');
      adb('shell', 'wm', 'dismiss-keyguard');
    } catch {}
  }
  try { probe(['--inspect', '--stop']); } catch {}
}

// Safety invariant: lifecycle transitions may stop/pause TTS, but may not
// silently advance past the message that was being spoken.
for (const [name, scenario] of Object.entries(report.scenarios)) {
  if ('sameMessage' in scenario && scenario.sameMessage === false) {
    throw new Error(`${name}: lifecycle transition skipped the current message`);
  }
}

await fs.writeFile(
  'artifacts/tts-lifecycle-matrix.json',
  `${JSON.stringify(report, null, 2)}\n`,
);
console.log(JSON.stringify(report, null, 2));
