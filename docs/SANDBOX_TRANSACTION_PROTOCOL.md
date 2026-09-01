<!-- docs/SANDBOX_TRANSACTION_PROTOCOL.md -->
# Mandatory sandbox transaction protocol

This document is the source of truth for development from a network-isolated ChatGPT sandbox where direct GitHub/npm access and a real Git clone are unavailable.

## Non-negotiable rule

**When working in the network-isolated sandbox, use only this protocol.** If another document, old chat, memory, handoff, or previous workflow conflicts with this document, this document wins.

GitHub is authoritative. Sandbox-local files are temporary transaction state, never an independent source of truth.

## Mandatory branch ownership

**All content changes MUST be made on a newly created dedicated branch. Never develop directly on `main`, an integration branch, or a pre-existing/shared branch.**

For every new chat/workstream that will write repository content:

1. Read the chosen base/integration branch HEAD through the GitHub connector.
2. Create a fresh uniquely named branch from that exact SHA, for example `agent-<task>-<date>-<shortid>`.
3. That branch is owned by exactly one active chat/agent. Two independent chats/agents must never write to the same branch.
4. Wait for the `Sandbox bundle` workflow to produce the exact-SHA bundle for the new branch before coding.
5. Integrate completed work through normal GitHub review/merge flow. Do not turn the integration branch itself into an agent workspace.

The only exception to "new branch" is crash recovery of the same unfinished transaction: the recovering agent may continue the already-owned branch after completing the recovery procedure below.

## One bundle, one exact commit

The only valid sandbox bootstrap input is a successful GitHub Actions artifact:

```text
sandbox-bundle-<EXACT_REMOTE_HEAD_SHA>
```

The bundle contains one consistency unit:

- `manifest.json` with repository, branch, commit SHA, tree SHA, Node version, package-lock digest, source/cache digests, tracked file blob SHAs and modes;
- `source.tgz` from that exact Git commit;
- `npm-cache.tgz` for offline dependency installation;
- `sandboxctl.py`.

Never substitute an older SHA. Never mix source/cache artifacts from different workflow runs.

## Mandatory transaction lifecycle

Every coding task/checkpoint is one transaction:

1. **START**: read the owned branch remote HEAD through the GitHub connector.
2. Obtain the successful `sandbox-bundle-<HEAD>` for exactly that SHA.
3. **PULL**:

   ```bash
   python sandboxctl.py pull <bundle.zip> <workdir>
   ```

   `sandboxctl` creates a unique `transaction_id`, timestamps, base commit/tree, and phase metadata in `.sandbox/state.json`.

4. **WORK** only while phase=`active`. Inventory changes only with:

   ```bash
   python sandboxctl.py status <workdir>
   ```

5. Optional full local verification:

   ```bash
   python sandboxctl.py test <workdir>
   ```

6. **PUSH GATE**:

   ```bash
   python sandboxctl.py prepare-push <workdir>
   ```

   This runs offline `npm ci`, unit tests, development build, production build and userscript verification, then writes `.sandbox/push.json` and changes phase to `push-ready`.

7. **REMOTE GATE**: immediately re-read the owned branch remote HEAD. It MUST equal `.sandbox/push.json:base_sha`. If not, do not push.

8. **CREATE COMMIT OBJECT**: create all changed blobs, one Git tree, and one Git commit through the GitHub connector. The commit parent MUST be `base_sha`. Do not update the branch ref yet.

9. **RECORD PENDING COMMIT** before publishing it:

   ```bash
   python sandboxctl.py record-commit <workdir> <commit_sha> <tree_sha>
   ```

   Phase becomes `commit-created`, and the exact pending commit/tree SHAs are durably recorded in the surviving workspace metadata.

10. **FINAL REMOTE GATE**: re-read remote HEAD again. It MUST still equal `base_sha`.

11. **PUBLISH**: update the owned branch ref to `commit_sha` with `force=false`. A logical multi-file change is one atomic Git commit, never sequential per-file commits.

12. **CLOSE**:

   ```bash
   python sandboxctl.py mark-pushed <workdir> <commit_sha>
   ```

   This only succeeds when `commit_sha` equals the recorded pending commit. Phase becomes `stale`. Never edit/test/push from that workspace again.

Any further work starts from a fresh exact-HEAD bundle.

## Crash/restart recovery

After any interruption, **never guess the transaction state and never immediately rerun a push**.

First read the owned branch remote HEAD through the GitHub connector, then run:

```bash
python sandboxctl.py recover <workdir> <REMOTE_HEAD_SHA>
```

Interpretation is deterministic:

- no `.sandbox/state.json` -> local transaction state is unusable; START from a fresh exact-HEAD bundle;
- `active` + remote==base -> inspect `status`, then resume local work;
- `active` + remote!=base -> restart from remote HEAD; do not push old workspace;
- `push-ready` + remote==base -> commit was not published; safely continue commit creation;
- `push-ready` + remote!=base -> prepared transaction is obsolete; do not publish it;
- `commit-created` + remote==base -> Git commit object exists but branch was not advanced; after a fresh remote check, publish the recorded `pending_commit_sha` with `force=false`;
- `commit-created` + remote==pending_commit_sha -> publication already succeeded; run `mark-pushed` and close the workspace;
- `commit-created` + remote neither base nor pending -> conflict; never push from that workspace;
- `stale` -> never resume; START a new transaction.

This specifically closes the dangerous crash window between GitHub commit creation, branch ref update, and local `mark-pushed`.

If the entire sandbox/container was destroyed, uncommitted local files cannot be recovered from metadata because the metadata was destroyed with them. Therefore long work must use tested checkpoint commits, and no agent may intentionally leave unpushed changes across a turn/session boundary.

## Turn/session boundary rule

Do not leave a transaction with unpushed local changes across agent turns or sessions. If work is incomplete but valid, create a tested checkpoint commit on the owned branch, publish it atomically, mark the workspace stale, and continue later from its new exact-SHA bundle.

## Dependency/environment changes are transaction boundaries

Changes to `package.json`, lockfiles, Node baseline, build/runtime dependencies or environment tooling MUST be separate commits.

Required sequence:

1. Close the current transaction.
2. Make the dependency/environment change as its own commit on the owned branch.
3. Let GitHub validate it and produce `sandbox-bundle-<DEPENDENCY_COMMIT_SHA>`.
4. Start a new sandbox transaction from that bundle.
5. Only then continue feature development.

Never continue feature work on a bundle created before the dependency/environment commit.

## Bundle retention

Bundles request 90-day retention. Automation keeps only the three newest sandbox bundles per branch. The exact-HEAD rule always wins: a retained older bundle is never a substitute for a missing current-HEAD bundle.

## Strictly forbidden

In the network-isolated sandbox, do NOT:

- modify `main`, an integration branch, or another chat/agent's branch;
- let two active chats/agents write the same branch;
- use an older bundle when the exact HEAD bundle is missing;
- mix source/cache artifacts from different runs;
- use ad-hoc synchronization or recreate sparse-sync;
- use `git clone`, `git pull`, or `git push` from the isolated sandbox;
- rely on Git hooks for sandbox integrity;
- make sequential per-file commits for one logical change;
- update a branch when remote HEAD differs from `base_sha`;
- force-update a branch;
- edit a stale workspace;
- continue feature work after dependency/environment changes without a new bundle;
- leave intentional unpushed local changes across agent turns/sessions.

If the mandated workflow fails, **fix the workflow**. Do not bypass it with another synchronization method.
