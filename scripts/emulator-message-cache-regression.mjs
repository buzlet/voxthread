// scripts/emulator-message-cache-regression.mjs
import { execFileSync, spawn } from 'node:child_process';

const FIXTURE = 'telegram-group-basic.html';
const PORT = 8768;
const REMOVED_MID = '1002';
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
  throw new Error('Message-cache fixture server did not start');
}

function openFixture() {
  run('./scripts/voxemu', [
    'adb', 'shell', 'am', 'start',
    '-a', 'android.intent.action.VIEW',
    '-d', `http://10.0.2.2:${PORT}/tests/fixtures/${FIXTURE}?rev=${Date.now()}`,
    'com.android.chrome',
  ]);
}

await ensureHttpServer();
run('node', ['scripts/build-userscript.mjs', '--dev']);
run('./scripts/voxemu', ['start']);
openFixture();
await sleep(1400);
run('./scripts/voxemu', ['cdp']);

const initial = probe();
if (
  initial.build?.visibleMessages !== 3
  || initial.build?.cachedMessages !== 3
  || initial.build?.messages !== 3
) {
  throw new Error(`Initial cache was not primed: ${JSON.stringify(initial.build)}`);
}

run('node', [
  'scripts/cdp-remove-fixture-bubble.mjs',
  `--fixture=${FIXTURE}`,
  `--mid=${REMOVED_MID}`,
]);
await sleep(250);

const rebuilt = probe();
if (rebuilt.build?.visibleMessages !== 2) {
  throw new Error(`Expected two remaining DOM messages: ${JSON.stringify(rebuilt.build)}`);
}
if (rebuilt.build?.cachedMessages !== 3 || rebuilt.build?.messages !== 3) {
  throw new Error(`Virtualized message was lost from cache: ${JSON.stringify(rebuilt.build)}`);
}
if (!rebuilt.queue?.current?.messageIds?.includes(REMOVED_MID)) {
  throw new Error(`Cached message did not survive queue rebuild: ${JSON.stringify(rebuilt.queue)}`);
}
if (rebuilt.diagnostics?.reader?.cachedMessages !== 3) {
  throw new Error(`Diagnostics cache count disagrees: ${JSON.stringify(rebuilt.diagnostics?.reader)}`);
}

console.log(JSON.stringify({
  target: 'voxthread-api36',
  fixture: FIXTURE,
  removedDomMessageId: REMOVED_MID,
  visibleAfterRemoval: rebuilt.build.visibleMessages,
  cachedAfterRemoval: rebuilt.build.cachedMessages,
  queueStillContainsRemovedDomMessage: true,
  persistentStorageUsed: false,
}, null, 2));
