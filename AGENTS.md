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

Any executable experiment must be committed before it is run on `u24`, Android, a browser or CI. Do not execute modified/uncommitted project code merely to "quickly check" it.

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
