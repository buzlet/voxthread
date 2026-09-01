// tests/sandboxctl.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const tool = new URL('../tools/sandboxctl.py', import.meta.url).pathname;

function run(args) {
  const r = spawnSync('python3', [tool, ...args], { encoding: 'utf8' });
  return { code: r.status, out: r.stdout, err: r.stderr };
}

async function makeRoot(phase = 'push-ready') {
  const root = await mkdtemp(join(tmpdir(), 'voxthread-sandboxctl-'));
  await mkdir(join(root, '.sandbox'));
  const state = {
    phase,
    transaction_id: 'tx-test',
    branch: 'agent-test',
    commit: 'base123',
    tree: 'tree123',
    pending_commit_sha: null,
    pending_tree_sha: null,
    files: [],
  };
  await writeFile(join(root, '.sandbox', 'state.json'), `${JSON.stringify(state, null, 2)}\n`);
  await writeFile(join(root, '.sandbox', 'push.json'), `${JSON.stringify({
    transaction_id: 'tx-test',
    branch: 'agent-test',
    base_sha: 'base123',
    base_tree: 'tree123',
    changes: [{ path: 'x.txt', kind: 'added', sha: 'blob', mode: '100644' }],
  }, null, 2)}\n`);
  return root;
}

test('sandboxctl records pending commit and distinguishes crash recovery states', async () => {
  const root = await makeRoot();
  let r = run(['record-commit', root, 'commit456', 'tree456']);
  assert.equal(r.code, 0, r.err);

  const state = JSON.parse(await readFile(join(root, '.sandbox', 'state.json'), 'utf8'));
  assert.equal(state.phase, 'commit-created');
  assert.equal(state.pending_commit_sha, 'commit456');
  assert.equal(state.pending_tree_sha, 'tree456');

  r = run(['recover', root, 'base123']);
  assert.equal(r.code, 0, r.err);
  assert.match(r.out, /PUBLISH-PENDING/);

  r = run(['recover', root, 'commit456']);
  assert.equal(r.code, 0, r.err);
  assert.match(r.out, /ACTION CLOSE/);

  r = run(['mark-pushed', root, 'commit456']);
  assert.equal(r.code, 0, r.err);
  const closed = JSON.parse(await readFile(join(root, '.sandbox', 'state.json'), 'utf8'));
  assert.equal(closed.phase, 'stale');
  assert.equal(closed.pushed_sha, 'commit456');
});

test('sandboxctl recovery refuses an active workspace after remote branch moves', async () => {
  const root = await makeRoot('active');
  const r = run(['recover', root, 'other789']);
  assert.equal(r.code, 3);
  assert.match(r.out, /ACTION RESTART/);
});
