<!-- docs/GITHUB_AGENT_HANDOFF.md -->
# GitHub agent handoff

Repository: https://github.com/buzlet/voxthread

## Mission

Continue VoxThread autonomously until every backlog item is either `DONE` or
demonstrably blocked by unavailable real hardware/account state. The user will
not be available for clarification. Do not wait for answers: choose the safest
reasonable implementation, document the decision, add tests, and continue.

Development must be GitHub-first. Do not depend on `u24`; it may be offline.
Use repository code, GitHub Actions and sanitized/synthetic fixtures as the
normal development and test environment.

## Read first

Treat these as source of truth, in this order:

1. [`AGENTS.md`](../AGENTS.md) — repository rules and commit-before-run policy.
2. [`docs/architecture.md`](architecture.md) — boundaries and runtime strategy.
3. [`docs/backlog.md`](backlog.md) — permanent `TWR-xxx` tasks and priorities.
4. [`docs/development.md`](development.md) — tests and GitHub Actions workflow.
5. [`docs/decisions/`](decisions/) — accepted architecture decisions.
6. [`docs/notes/`](notes/) — empirical browser/Android findings.

Do not reconstruct project history from chat. The repository is authoritative.

## Current validated baseline

At handoff, `main` and `emulator-dev` are synchronized. The tree is clean
and has no unresolved merge entries.

Validated locally before handoff:

- `npm ci`
- `npm test` → 58/58 passing
- `npm run build:userscript`
- `npm run build:dev`
- `npm run test:emulator:all` → PASS
- Android 16/API 36 Chrome emulator exposes Web Speech and passes lifecycle,
  live-follow and real-touch start-selection regressions.

The combined emulator gate covers unit tests, Web Speech, sleep/wake recovery,
live-follow and selection. Preserve this as a release gate.

## GitHub-only working model

Work from a branch based on current `main`; keep commits small and attributable.
For tracked work, prefix commits with the permanent backlog ID, e.g.
`TWR-016: ...`.

Before running changed executable code:

1. edit;
2. review `git diff` / `git diff --check`;
3. commit the experiment;
4. run CI/emulator tests;
5. fix failures in a new commit.

Use GitHub Actions:

- `CI`: `.github/workflows/ci.yml`
- `Android emulator regression`: `.github/workflows/android-emulator.yml`
- Actions UI: https://github.com/buzlet/voxthread/actions

Do not require Telegram credentials in CI. Use committed sanitized fixtures.

## Work order

Drive work from [`docs/backlog.md`](backlog.md), not from this file.
Priority order is `P0`, then `P1`, then `P2`.

At handoff the unfinished items are mainly hardware/runtime validation:

- `TWR-004` — clean foreground/background/screen-off/locked-screen TTS
  measurement. Emulator evidence is useful, but final Samsung acceptance
  requires Galaxy A57 when it becomes available.
- `TWR-014` — Firefox Android comparison. Do it only if it can materially
  change runtime choice; emulator-based comparison is acceptable first.
- `TWR-016` — reproducible userscript install/update workflow. Finish as much
  as possible without Galaxy/Tampermonkey state; final real-device acceptance
  may remain blocked.

If new defects/gaps are discovered, allocate the next unused `TWR-xxx` ID and
continue without waiting for the user.

## Product requirements that must not regress

VoxThread must:

- read actual Telegram message text, not UI/service metadata;
- start from a user-selected message and continue in order;
- follow newly arriving messages;
- preserve unread/current content across TTS interruption instead of skipping;
- handle long messages by safe speech chunking;
- keep Telegram DOM selectors out of core logic;
- distinguish authors using compatible voices when available, with deterministic
  rate/pitch fallback;
- persist reader preferences and voice overrides;
- keep private Telegram content, cookies and credentials out of Git and logs.

Browser `speechSynthesis` is replaceable. If browser background execution is
the dominant blocker, preserve core/Telegram layers and move only the runtime
boundary toward native Android TTS + foreground service rather than rewriting
the product.

## Definition of done

For each backlog item:

- implementation and tests committed;
- relevant GitHub CI green;
- non-obvious findings recorded under `docs/notes/`;
- backlog status updated;
- architecture/ADR updated if a decision changes;
- no secrets/private messages in repository or artifacts.

Before declaring the project ready, run every GitHub-capable regression and
ensure the repository is clean and synchronized with GitHub.

Real-hardware-only checks may remain `BLOCKED` while Galaxy A57 is unavailable,
but everything not inherently hardware-bound should be completed without user
interaction.
