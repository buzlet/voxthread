<!-- docs/GITHUB_AGENT_HANDOFF.md -->
# GitHub agent handoff

Repository: https://github.com/buzlet/voxthread

## HARD REQUIREMENT FOR CHATGPT SANDBOX

If the agent is running in a network-isolated ChatGPT sandbox without direct GitHub/npm access and without a real Git clone, **the very first operational step is to read [`docs/SANDBOX_TRANSACTION_PROTOCOL.md`](SANDBOX_TRANSACTION_PROTOCOL.md)**.

That protocol is mandatory and overrides any older synchronization instructions, chat history, remembered workflow, or ad-hoc workaround. **Before any content change, create a fresh dedicated branch for this chat/task. Never write directly to `main`, an integration branch, an existing shared branch, or another active agent's branch. One active writer owns one branch.** Use only the exact-HEAD `sandbox-bundle-<SHA>` and `sandboxctl.py` transaction model. Do not use stale bundles, manual source/cache combinations, Git hooks as sandbox enforcement, sparse sync, per-file multi-commit pushes, or continued editing after `mark-pushed`.

After any interruption, do not infer whether a push completed. Read the branch remote HEAD and run `sandboxctl.py recover <workdir> <remote-head>` first. Follow only the recovery action derived from the recorded transaction phase and pending commit metadata.

If the mandated sandbox mechanism fails, fix the mechanism or stop that transaction. **Do not create a second synchronization method.**

## Mission

Continue VoxThread autonomously until every backlog item is either `DONE` or demonstrably blocked by unavailable real hardware/account state. The user will not be available for clarification. Do not wait for answers: choose the safest reasonable implementation, document the decision, add tests, and continue.

Development must be GitHub-first. Do not depend on `u24`; it may be offline. Use repository code, GitHub Actions and sanitized/synthetic fixtures as the normal development and test environment.

## Read first

Treat these as source of truth, in this order:

1. [`docs/SANDBOX_TRANSACTION_PROTOCOL.md`](SANDBOX_TRANSACTION_PROTOCOL.md) — mandatory synchronization/execution protocol when in the network-isolated sandbox.
2. [`AGENTS.md`](../AGENTS.md) — repository-wide agent rules.
3. [`docs/architecture.md`](architecture.md) — boundaries and runtime strategy.
4. [`docs/backlog.md`](backlog.md) — permanent `TWR-xxx` tasks and priorities.
5. [`docs/development.md`](development.md) — tests and GitHub Actions workflow.
6. [`docs/decisions/`](decisions/) — accepted architecture decisions.
7. [`docs/notes/`](notes/) — empirical browser/Android findings.

Do not reconstruct project history from chat. The repository is authoritative.

## Current validated baseline

The authoritative baseline is the current branch commit validated by GitHub CI and, for sandbox work, by the exact-SHA `Sandbox bundle` workflow. Do not rely on old numeric test counts in handoff prose when the repository can provide fresher evidence.

Current normal gates include:

- `npm ci`
- `npm test`
- `npm run build:userscript`
- `npm run build:dev`
- `npm run verify:userscript`
- Android emulator regressions where applicable.

The combined emulator gate covers unit tests, Web Speech, sleep/wake recovery, live-follow and selection. Preserve this as a release gate.

## Working models

### Real Git clone/worktree

When a genuine Git clone is available, work from a branch based on current `main`; keep commits small and attributable. For tracked work, prefix commits with the permanent backlog ID, e.g. `TWR-016: ...`.

Before running changed executable code on external environments:

1. edit;
2. review `git diff` / `git diff --check`;
3. commit the experiment;
4. run CI/emulator tests;
5. fix failures in a new commit.

### Network-isolated ChatGPT sandbox

Do not apply the ordinary clone/worktree sequence as a substitute. Follow `docs/SANDBOX_TRANSACTION_PROTOCOL.md` exactly:

`NEW OWNED BRANCH → START exact remote HEAD → exact-SHA bundle → sandboxctl pull → WORK(active) → sandboxctl prepare-push → remote gate → create one connector commit object → sandboxctl record-commit → final remote gate → update_ref(force=false) → sandboxctl mark-pushed → STALE`.

Crash/restart recovery always starts with `remote HEAD → sandboxctl recover`. Never rerun a push blindly.

A sandbox transaction must not cross an agent-turn boundary with unpushed local changes. Make a tested checkpoint commit if necessary.

A dependency/environment change is a separate commit boundary. After changing `package.json`, `package-lock.json`, Node baseline or another dependency, do not continue feature development until GitHub has produced the bundle for that dependency commit and a new sandbox transaction has started from it.

`Sandbox bundle` artifacts request 90-day retention and the workflow keeps only the three newest bundles per branch.

## GitHub Actions

Use GitHub Actions:

- `CI`: `.github/workflows/ci.yml`
- `Sandbox bundle`: `.github/workflows/sandbox-bundle.yml`
- `Android emulator regression`: `.github/workflows/android-emulator.yml`
- Actions UI: https://github.com/buzlet/voxthread/actions

Do not require Telegram credentials in CI. Use committed sanitized fixtures.

## Work order

Drive work from [`docs/backlog.md`](backlog.md), not from this file. Priority order is `P0`, then `P1`, then `P2`.

If new defects/gaps are discovered, allocate the next unused `TWR-xxx` ID and continue without waiting for the user.

## Product requirements that must not regress

VoxThread must:

- read actual Telegram message text, not UI/service metadata;
- start from a user-selected message and continue in order;
- follow newly arriving messages;
- preserve unread/current content across TTS interruption instead of skipping;
- handle long messages by safe speech chunking;
- keep Telegram DOM selectors out of core logic;
- distinguish authors using compatible voices when available, with deterministic rate/pitch fallback;
- persist reader preferences and voice overrides;
- keep private Telegram content, cookies and credentials out of Git and logs.

Browser `speechSynthesis` is replaceable. If browser background execution is the dominant blocker, preserve core/Telegram layers and move only the runtime boundary toward native Android TTS + foreground service rather than rewriting the product.

## Definition of done

For each backlog item:

- implementation and tests committed;
- relevant GitHub CI green;
- non-obvious findings recorded under `docs/notes/`;
- backlog status updated;
- architecture/ADR updated if a decision changes;
- no secrets/private messages in repository or artifacts.

Before declaring the project ready, run every GitHub-capable regression and ensure the repository is clean and synchronized with GitHub.

Real-hardware-only checks may remain `BLOCKED` while the primary device is unavailable, but everything not inherently hardware-bound should be completed without user interaction.
