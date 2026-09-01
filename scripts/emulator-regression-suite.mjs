// scripts/emulator-regression-suite.mjs
import { execFileSync } from 'node:child_process';

const checks = [
  ['unit', 'npm', ['test']],
  ['web-speech', 'node', ['scripts/emulator-smoke.mjs']],
  ['lifecycle', 'node', ['scripts/emulator-lifecycle-regression.mjs']],
  ['live-follow', 'node', ['scripts/emulator-live-follow-regression.mjs']],
  ['selection', 'node', ['scripts/emulator-selection-regression.mjs']],
  ['read-cursor', 'node', ['scripts/emulator-read-cursor-regression.mjs']],
  ['tts-matrix', 'node', ['scripts/emulator-tts-matrix.mjs']],
];

const results = [];

for (const [name, file, args] of checks) {
  const started = Date.now();

  try {
    const output = execFileSync(file, args, {
      cwd: process.cwd(),
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();

    if (output) process.stdout.write(`${output}\n`);

    results.push({
      name,
      status: 'PASS',
      durationMs: Date.now() - started,
    });
  } catch (error) {
    if (error.stdout) process.stdout.write(String(error.stdout));
    if (error.stderr) process.stderr.write(String(error.stderr));

    results.push({
      name,
      status: 'FAIL',
      durationMs: Date.now() - started,
    });

    console.error(JSON.stringify({ checks: results }, null, 2));
    process.exit(1);
  }
}

console.log(JSON.stringify({
  target: 'voxthread-api36',
  status: 'PASS',
  checks: results,
}, null, 2));
