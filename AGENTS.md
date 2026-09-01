<!-- AGENTS.md -->
# Agent instructions

This repository is a userscript-first project for reading web chat conversations aloud with human-friendly TTS and distinguishable per-author voices.

## HARD REQUIREMENT: network-isolated ChatGPT sandbox

If direct GitHub/npm network access or a real Git clone is unavailable, **before doing anything else read [`docs/SANDBOX_TRANSACTION_PROTOCOL.md`](docs/SANDBOX_TRANSACTION_PROTOCOL.md)**.

That protocol is mandatory and is the source of truth for sandbox synchronization. Use only the exact-HEAD `sandbox-bundle-<SHA>` + `sandboxctl.py` transaction workflow. Do not invent, revive, or use another synchronization path. If the mandated mechanism fails, fix it or stop the transaction; do not bypass it.

In particular, never:

- work from an older bundle when the current branch HEAD has no bundle yet;
- combine separate source/dependency artifacts;
- rely on Git hooks inside the sandbox;
- continue editing a workspace after `mark-pushed` made it `stale`;
- push when remote HEAD differs from `.sandbox/push.json:base_sha`;
- continue feature work after a dependency change until a bundle for the dependency commit has been obtained.

## Current handoff

For autonomous GitHub-only continuation while the development server is offline, read [`docs/GITHUB_AGENT_HANDOFF.md`](docs/GITHUB_AGENT_HANDOFF.md) before starting work.

## Read before changing code

Read these files first:

1. `docs/SANDBOX_TRANSACTION_PROTOCOL.md` — mandatory when running in the network-isolated sandbox.
2. `docs/architecture.md` — current system boundaries and module design.
3. `docs/development.md` — mandatory development workflow.
4. `docs/backlog.md` — tracked work and permanent `TWR-xxx` IDs.
5. Relevant ADRs under `docs/decisions/`.

Architecture and ADRs are the source of truth for product design. The sandbox protocol is the source of truth for sandbox synchronization/execution. If implementation needs to contradict an architecture decision, update or supersede the decision explicitly.

## Repository rules

- Keep Telegram extraction in `src/telegram/`; do not leak Telegram DOM selectors into core logic.
- Keep normalized messages, speech planning and playback state in `src/core/`.
- Keep voice selection and speech runtime behind `src/tts/` abstractions.
- Keep browser/UI integration thin and replaceable.
- Prefer testable pure JavaScript modules over code tied directly to a browser page.
- Treat Edge/Tampermonkey and browser `speechSynthesis` as current candidates, not permanent architectural requirements.

## Commit-before-run

Any executable experiment on `u24`, Android, a browser or CI must be committed before it is run there. The network-isolated sandbox is the exception: local Node unit/build checks are the mandatory pre-push gate and therefore run before the connector commit, strictly through `sandboxctl.py`.

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

## Sandbox transaction summary

This summary does not replace `docs/SANDBOX_TRANSACTION_PROTOCOL.md`.

`START exact HEAD → exact-SHA bundle → sandboxctl pull → WORK(active) → sandboxctl prepare-push → re-read remote HEAD → atomic connector commit with force=false → sandboxctl mark-pushed → STALE`.

Do not leave unpushed sandbox changes between agent turns. If work is incomplete but valid, create a tested checkpoint commit and start the next turn from its new exact-SHA bundle.
