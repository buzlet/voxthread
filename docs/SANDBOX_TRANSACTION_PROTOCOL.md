<!-- docs/SANDBOX_TRANSACTION_PROTOCOL.md -->
# Mandatory sandbox transaction protocol

This document is the source of truth for development from a network-isolated ChatGPT sandbox where direct GitHub/npm access and a real Git clone are unavailable.

## Non-negotiable rule

**When working in the network-isolated sandbox, use only this protocol.** Do not improvise synchronization, manually combine artifacts, reconstruct a repository from individual files, use stale workspaces, use the removed sparse-sync mechanism, or continue editing after a successful push.

If another document, old chat message, agent memory, or prior workflow conflicts with this document, **this document wins**.

The sandbox has no `.git` directory and Git hooks are not part of its integrity model. GitHub is authoritative; `sandboxctl.py` enforces local transaction state.

## One bundle, one exact commit

The only valid sandbox bootstrap input is the successful GitHub Actions artifact:

```text
sandbox-bundle-<EXACT_REMOTE_HEAD_SHA>
```

The bundle contains, as one consistency unit:

- `manifest.json` with repository, branch, commit SHA, tree SHA, Node version, package-lock digest, source/cache digests, tracked file blob SHAs and modes;
- `source.tgz` from that exact Git commit;
- `npm-cache.tgz` used for offline dependency installation;
- `sandboxctl.py`.

Never substitute a bundle for an older or different SHA. Never mix source and dependency artifacts from different workflow runs.

## Mandatory transaction lifecycle

Every coding task or checkpoint is one transaction:

1. **START**: read the remote branch HEAD through the GitHub connector.
2. Find a successful `sandbox-bundle-<HEAD>` for exactly that SHA. If it does not exist yet, do not start coding from an older bundle.
3. **PULL**: run:

   ```bash
   python sandboxctl.py pull <bundle.zip> <workdir>
   ```

4. **WORK** only while the workspace phase is `active`. Inventory changes only with:

   ```bash
   python sandboxctl.py status <workdir>
   ```

5. Optional local verification uses:

   ```bash
   python sandboxctl.py test <workdir>
   ```

6. **PUSH GATE**: before every push run:

   ```bash
   python sandboxctl.py prepare-push <workdir>
   ```

   This performs offline `npm ci`, unit tests, development build, production userscript build and userscript verification; then writes `.sandbox/push.json` and changes phase to `push-ready`.

7. **REMOTE GATE**: immediately re-read remote branch HEAD. It MUST equal `.sandbox/push.json:base_sha`.
   - If it differs, do not push.
   - Run `python sandboxctl.py abort-push <workdir>`.
   - Preserve/port the local changes and restart at START from the new exact-HEAD bundle.

8. **ATOMIC COMMIT**: create Git blobs/tree/commit through the GitHub connector using `base_tree` and `base_sha`, then update the branch ref with `force=false`. A logical multi-file change must be one Git commit, not a sequence of per-file commits.

9. **CLOSE**: after a successful push run:

   ```bash
   python sandboxctl.py mark-pushed <workdir> <new-sha>
   ```

   The workspace becomes `stale`. Do not edit, test, prepare or push from it again. Any further work starts from START and a new exact-SHA bundle.

## Turn boundary rule

Do not leave a transaction with unpushed local changes between agent turns. If work is incomplete but valid, make a tested checkpoint commit on the feature branch, mark the workspace stale, and continue in the next transaction from its new bundle.

This rule exists because sandbox-local state is not a durable synchronization authority.

## Dependency changes are environment boundaries

Changing `package.json`, `package-lock.json`, Node baseline, or another build/runtime dependency MUST be a separate dependency commit.

Required sequence:

1. Finish/close the current transaction.
2. Make the dependency change as its own GitHub commit, including the regenerated lockfile when applicable.
3. Let GitHub validate the dependency commit and build `sandbox-bundle-<DEPENDENCY_COMMIT_SHA>`.
4. Start a new sandbox transaction from that new bundle.
5. Only then continue feature development and local offline tests.

Do not continue feature work using the old bundle after dependencies changed. Do not hand-edit a lockfile merely to make offline installation pass.

## Bundle retention policy

Sandbox bundles have a maximum GitHub retention of 90 days. The `Sandbox bundle` workflow automatically keeps only the three newest sandbox bundles for each branch and deletes older ones. Therefore storage is bounded while recent recovery points remain available.

The exact-HEAD rule still applies: an older retained bundle is useful for historical recovery, but it is never a substitute for a missing bundle of the current remote HEAD.

## Forbidden paths

In the network-isolated sandbox, do NOT:

- use `git clone`, `git pull`, `git push` or assume direct GitHub network access;
- depend on Git hooks for sandbox integrity;
- use ad-hoc `curl`/download scripts to assemble repository state;
- manually combine source/cache artifacts;
- use `tools/github_sparse_sync.py` or recreate an equivalent alternate sync path;
- edit a `stale` workspace;
- push when remote HEAD differs from `base_sha`;
- force-update the branch;
- continue after a dependency change without obtaining the new dependency commit bundle.

If the mandated mechanism fails, fix the mechanism or stop the transaction. Do not bypass it with a second synchronization method.
