<!-- AGENTS.md -->
# Agent instructions

This repository is a userscript-first project for reading web chat conversations aloud with human-friendly TTS and distinguishable per-author voices.

## Current handoff

For autonomous GitHub-only continuation while the development server is
offline, read [`docs/GITHUB_AGENT_HANDOFF.md`](docs/GITHUB_AGENT_HANDOFF.md)
before starting work.

## Read before changing code

Read these files first:

1. `docs/architecture.md` — current system boundaries and module design.
2. `docs/development.md` — mandatory development workflow.
3. `docs/backlog.md` — tracked work and permanent `TWR-xxx` IDs.
4. Relevant ADRs under `docs/decisions/`.

Architecture and ADRs are the source of truth. If implementation needs to contradict them, update or supersede the decision explicitly.

## Repository rules

- Keep Telegram extraction in `src/telegram/`; do not leak Telegram DOM selectors into core logic.
- Keep normalized messages, speech planning and playback state in `src/core/`.
- Keep voice selection and speech runtime behind `src/tts/` abstractions.
- Keep browser/UI integration thin and replaceable.
- Prefer testable pure JavaScript modules over code tied directly to a browser page.
- Treat Edge/Tampermonkey and browser `speechSynthesis` as current candidates, not permanent architectural requirements.

## Commit-before-run

Any executable experiment on `u24`, Android, a browser or CI must be committed before it is run there. The network-isolated sandbox is the exception: local Node unit/build checks are the mandatory pre-push gate and therefore run before the connector commit.

For tracked work, prefix commit messages with the backlog ID, for example `TWR-003: add TTS diagnostics`. Do not rewrite a commit after its behaviour has been observed; fix it in a new commit.

## Testing and evidence

- Add or update tests for behaviour changes where practical.
- Prefer Node tests and captured/synthetic DOM fixtures before device testing.
- Use Wireless ADB/CDP or WebDriver for Android/browser automation instead of coordinate taps when possible.
- Record non-obvious device/browser observations under `docs/notes/` and include the tested commit SHA.
- Preserve failing fixtures that reproduce Telegram Web compatibility breakage.

## Privacy and security

Never commit Telegram credentials, cookies, session databases, pairing secrets, unsanitized private messages or remote-debugging credentials. Do not introduce an external/cloud TTS service without an explicit ADR because message text would leave the device.

## Backlog and decisions

Add deferred work to `docs/backlog.md` with the next permanent `TWR-xxx` ID. Do not recycle identifiers. Record decisions that constrain future implementation as numbered ADRs rather than burying them in code comments or chat history.

## Local development

On `u24`, project operations are performed as the dedicated `gpt` user with `HOME=/home/gpt`. Do not assume local-only paths or host details belong in portable application code. Do not push, publish releases or rewrite shared history unless explicitly requested.

## Network-isolated sandbox transaction protocol

When direct Git access is unavailable, do not use ad-hoc source snapshots, separate dependency artifacts, or `tools/github_sparse_sync.py`. Treat each coding task as one transaction and use only the single `Sandbox bundle` artifact for the exact branch HEAD.

1. START: read the remote branch HEAD through the GitHub connector. Obtain `sandbox-bundle-<HEAD>` from the successful `Sandbox bundle` workflow for exactly that SHA. Never substitute an older artifact.
2. PULL: extract `sandboxctl.py` from the artifact and run `python sandboxctl.py pull <artifact.zip> <workdir>`. This replaces a clean/stale workspace and refuses to overwrite uncommitted work.
3. WORK: edit only while session phase is `active`. Use `python sandboxctl.py status <workdir>` as the only local change inventory.
4. PUSH GATE: run `python sandboxctl.py prepare-push <workdir>`. It performs offline `npm ci`, tests, both builds, userscript verification, writes `.sandbox/push.json`, and changes phase to `push-ready`.
5. REMOTE GATE: immediately re-read remote branch HEAD. It MUST equal `.sandbox/push.json:base_sha`. If not, do not push; run `abort-push`, preserve/port the changes, and restart from START.
6. COMMIT: create blobs/tree/commit through the GitHub connector using `base_tree` and `base_sha`, then update the branch ref with `force=false`. Do not use per-file sequential commits for a multi-file change.
7. CLOSE: run `python sandboxctl.py mark-pushed <workdir> <new-sha>`. The workspace becomes `stale` and MUST NOT be edited again. Any further work starts again at START from `sandbox-bundle-<new-sha>`.

A transaction must not be left with unpushed local changes between agent turns. If work is incomplete but valid, make a tested checkpoint commit on the feature branch and close the transaction.
