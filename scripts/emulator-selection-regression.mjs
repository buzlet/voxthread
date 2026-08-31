// scripts/emulator-selection-regression.mjs
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

const state = JSON.parse(run('node', [
  'scripts/cdp-runtime-smoke.mjs',
  `--fixture=${fixture}`,
  '--select-mid=1003',
  '--play',
]));

run('node', [
  'scripts/cdp-runtime-smoke.mjs',
  `--fixture=${fixture}`,
  '--inspect',
  '--stop',
]);

if (state.selectedMessageId !== '1003') {
  throw new Error(`Wrong selected message: ${state.selectedMessageId}`);
}

if (
  state.queue?.index !== 1
  || !state.queue?.current?.messageIds?.includes('1003')
  || state.queue?.status !== 'playing'
  || !state.speaking
) {
  throw new Error(`Playback did not start at selection: ${JSON.stringify(state.queue)}`);
}

console.log(JSON.stringify({
  target: 'voxthread-api36',
  selectedMessageId: state.selectedMessageId,
  queueIndex: state.queue.index,
  queueLength: state.queue.length,
  currentMessageIds: state.queue.current.messageIds,
  speaking: state.speaking,
}, null, 2));
