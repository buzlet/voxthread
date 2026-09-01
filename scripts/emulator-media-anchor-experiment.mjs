// scripts/emulator-media-anchor-experiment.mjs
import fs from 'node:fs/promises';
import { execFileSync, spawn } from 'node:child_process';

const FIXTURE = 'telegram-group-long.html';
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function run(file, args = [], options = {}) {
  return execFileSync(file, args, {
    cwd: process.cwd(), encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], ...options,
  }).trim();
}
function adb(...args) { return run('./scripts/voxemu', ['adb', ...args]); }
function runtime(args = []) {
  return JSON.parse(run('node', ['scripts/cdp-runtime-smoke.mjs', `--fixture=${FIXTURE}`, ...args]));
}
function media(args = []) {
  return JSON.parse(run('node', ['scripts/cdp-media-session-probe.mjs', ...args]));
}

async function ensureHttpServer() {
  const url = `http://127.0.0.1:8765/tests/fixtures/${FIXTURE}`;
  try { if ((await fetch(url)).ok) return; } catch {}
  const server = spawn('python3', ['-m', 'http.server', '8765', '--bind', '0.0.0.0', '--directory', process.cwd()], {
    detached: true, stdio: 'ignore',
  });
  server.unref();
  for (let i = 0; i < 30; i += 1) {
    await sleep(150);
    try { if ((await fetch(url)).ok) return; } catch {}
  }
  throw new Error('Fixture HTTP server did not start');
}

function wakefulness() {
  return adb('shell', 'dumpsys', 'power').match(/mWakefulness=(\w+)/)?.[1] ?? null;
}
async function power(expected) {
  adb('shell', 'input', 'keyevent', '26');
  for (let i = 0; i < 40; i += 1) {
    await sleep(150);
    if (wakefulness() === expected) return;
  }
  throw new Error(`Android did not reach wakefulness=${expected}`);
}
async function ensureAwake() { if (wakefulness() !== 'Awake') await power('Awake'); }

async function openFixture() {
  await ensureAwake();
  adb('shell', 'am', 'start', '-a', 'android.intent.action.VIEW', '-d',
    `http://10.0.2.2:8765/tests/fixtures/${FIXTURE}?rev=${Date.now()}`, 'com.android.chrome');
  await sleep(1100);
  run('./scripts/voxemu', ['cdp']);
  runtime(['--pref=panelCollapsed=false']);
}

function compact(state) {
  return {
    queueStatus: state?.queue?.status ?? null,
    queueIndex: state?.queue?.index ?? null,
    messageId: state?.queue?.current?.messageIds?.[0] ?? null,
    playerError: state?.playerError ?? null,
    speaking: Boolean(state?.speaking),
    playbackState: state?.playbackState ?? null,
    anchor: state?.anchor ?? null,
  };
}

async function scenario(anchor, transition) {
  await openFixture();
  media([`--anchor=${anchor}`]);
  runtime(['--inspect', '--play']);
  await sleep(400);
  const before = compact(media(['--inspect']));

  if (transition === 'background') {
    adb('shell', 'input', 'keyevent', 'KEYCODE_HOME');
  } else {
    await power('Asleep');
  }
  await sleep(1400);
  const after = compact(media(['--inspect']));

  if (transition === 'background') {
    adb('shell', 'monkey', '-p', 'com.android.chrome', '-c', 'android.intent.category.LAUNCHER', '1');
    await sleep(500);
  } else {
    await power('Awake');
    await sleep(350);
  }

  try { runtime(['--inspect', '--stop']); } catch {}
  const beforeTime = before.anchor?.currentTime ?? null;
  const afterTime = after.anchor?.currentTime ?? null;
  return {
    anchor,
    transition,
    before,
    after,
    sameMessage: before.messageId === after.messageId,
    anchorAdvanced: beforeTime !== null && afterTime !== null
      ? afterTime > beforeTime + 0.2
      : null,
  };
}

await fs.mkdir('artifacts', { recursive: true });
await ensureHttpServer();
run('node', ['scripts/build-userscript.mjs', '--dev']);
run('./scripts/voxemu', ['start']);

const report = {
  target: 'GitHub/API36 generic Android emulator',
  note: 'audible uses a real 440 Hz PCM media element; host runner may suppress physical audio output',
  measuredAt: new Date().toISOString(),
  scenarios: [],
};

for (const anchor of ['none', 'silent', 'audible']) {
  for (const transition of ['background', 'screenOff']) {
    report.scenarios.push(await scenario(anchor, transition));
  }
}

for (const item of report.scenarios) {
  if (item.sameMessage === false) {
    throw new Error(`${item.anchor}/${item.transition}: lifecycle transition skipped current message`);
  }
}

await fs.writeFile(
  'artifacts/media-anchor-experiment.json',
  `${JSON.stringify(report, null, 2)}\n`,
);
console.log(JSON.stringify(report, null, 2));
