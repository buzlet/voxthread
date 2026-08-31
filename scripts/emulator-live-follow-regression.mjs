// scripts/emulator-live-follow-regression.mjs
import { execFileSync } from 'node:child_process';

const fixture = 'telegram-group-basic.html';
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function run(file, args = []) {
  return execFileSync(file, args, {
    cwd: process.cwd(),
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

function probe(args = []) {
  return JSON.parse(run('node', [
    'scripts/cdp-runtime-smoke.mjs',
    `--fixture=${fixture}`,
    ...args,
  ]));
}

run('node', ['scripts/build-userscript.mjs', '--dev']);
run('./scripts/voxemu', ['start']);
run('./scripts/voxemu', ['adb', 'shell', 'input', 'keyevent', '224']);

const rev = Date.now();
run('./scripts/voxemu', [
  'adb', 'shell', 'am', 'start',
  '-a', 'android.intent.action.VIEW',
  '-d', `http://10.0.2.2:8765/tests/fixtures/${fixture}?rev=${rev}`,
  'com.android.chrome',
]);

await sleep(1500);
run('./scripts/voxemu', ['cdp']);

const started = probe([
  '--pref=announceAuthors=true',
  '--pref=mergeAdjacent=true',
  '--pref=linkMode=domain',
  '--pref=panelCollapsed=false',
  '--play',
]);

if (started.queue?.length !== 2 || started.queue?.status !== 'playing') {
  throw new Error(`Unexpected initial queue: ${JSON.stringify(started.queue)}`);
}

let completed = null;
for (let i = 0; i < 80; i += 1) {
  await sleep(250);
  completed = probe(['--inspect']);
  if (completed.queue?.status === 'completed') break;
}

if (completed?.queue?.status !== 'completed') {
  throw new Error('Initial queue did not complete');
}

const appended = JSON.parse(run('node', [
  'scripts/cdp-append-synthetic-message.mjs',
  `--fixture=${fixture}`,
  '--mid=5001',
]));

if (!appended.appended) {
  throw new Error(`Synthetic append failed: ${JSON.stringify(appended)}`);
}

let resumed = null;
for (let i = 0; i < 40; i += 1) {
  await sleep(200);
  resumed = probe(['--inspect']);
  if (
    resumed.queue?.length === 3
    && resumed.queue?.status === 'playing'
    && resumed.queue?.current?.messageIds?.includes('5001')
  ) {
    break;
  }
}

probe(['--inspect', '--stop']);

if (
  resumed?.queue?.length !== 3
  || resumed?.queue?.status !== 'playing'
  || !resumed.queue?.current?.messageIds?.includes('5001')
) {
  throw new Error(`Live follow did not resume: ${JSON.stringify(resumed?.queue)}`);
}

console.log(JSON.stringify({
  target: 'voxthread-api36',
  initialQueueLength: started.queue.length,
  completedIndex: completed.queue.index,
  appendedMessageId: appended.mid,
  resumedQueueLength: resumed.queue.length,
  resumedStatus: resumed.queue.status,
  resumedMessageId: resumed.queue.current.messageIds[0],
}, null, 2));
