// scripts/emulator-read-cursor-regression.mjs
import { execFileSync, spawn } from 'node:child_process';

const FIXTURE = 'telegram-group-basic.html';
const PORT = 8767;
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
  const url = `http://127.0.0.1:${PORT}/tests/fixtures/${FIXTURE}`;
  try {
    const response = await fetch(url);
    if (response.ok) return;
  } catch {}

  const server = spawn('python3', [
    '-m', 'http.server', String(PORT),
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
  throw new Error('Read-cursor fixture server did not start');
}

function openFixture(rev) {
  run('./scripts/voxemu', [
    'adb', 'shell', 'am', 'start',
    '-a', 'android.intent.action.VIEW',
    '-d', `http://10.0.2.2:${PORT}/tests/fixtures/${FIXTURE}?rev=${rev}`,
    'com.android.chrome',
  ]);
}

await ensureHttpServer();
run('node', ['scripts/build-userscript.mjs', '--dev']);
run('./scripts/voxemu', ['start']);

openFixture(Date.now());
await sleep(1400);
run('./scripts/voxemu', ['cdp']);

const started = probe(['--select-mid=1003', '--play']);
if (
  started.queue?.status !== 'playing'
  || !started.queue?.current?.messageIds?.includes('1003')
  || started.diagnostics?.reader?.storedChatCursors !== 1
) {
  throw new Error(`Initial cursor was not persisted: ${JSON.stringify(started)}`);
}

let completed = null;
for (let i = 0; i < 30; i += 1) {
  await sleep(300);
  completed = probe(['--inspect']);
  if (completed.queue?.status === 'completed') break;
}

if (completed?.queue?.status !== 'completed') {
  throw new Error(`Selected final message did not complete: ${JSON.stringify(completed?.queue)}`);
}

// Navigate the same browser origin to a fresh document. localStorage survives,
// while the VoxThread runtime and its in-memory selection state do not.
openFixture(Date.now() + 1);
await sleep(1400);
run('./scripts/voxemu', ['cdp']);

const resumed = probe();
if (resumed.build?.startMode !== 'first-unread') {
  throw new Error(`Expected first-unread cursor mode: ${JSON.stringify(resumed.build)}`);
}
if (resumed.queue?.status !== 'completed') {
  throw new Error(`Completed cursor replayed already-read content: ${JSON.stringify(resumed.queue)}`);
}
if (resumed.diagnostics?.reader?.storedChatCursors !== 1) {
  throw new Error(`Cursor did not survive page reload: ${JSON.stringify(resumed.diagnostics?.reader)}`);
}

console.log(JSON.stringify({
  target: 'voxthread-api36',
  fixture: FIXTURE,
  selectedMessageId: '1003',
  persistedAcrossReload: true,
  resumeMode: resumed.build.startMode,
  replayPrevented: resumed.queue.status === 'completed',
}, null, 2));
