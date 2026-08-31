<!-- docs/development.md -->
# Development workflow

## Commit-before-run rule

Any executable change, including throwaway diagnostics and one-off experiments, must be committed before execution on `u24`, Android, a desktop browser or CI.

Recommended sequence:

1. Edit source/test/documentation files.
2. Review `git diff` and repository status.
3. Commit the complete experiment.
4. Run tests or deploy/inject it.
5. Record observations in `docs/notes/` when they affect later work.
6. Fix failures in a new commit; do not silently rewrite the executed commit.

This gives every observed behaviour an exact Git revision.

## Commit messages

Use `TWR-xxx: description` when a backlog item applies. Infrastructure/documentation commits without a backlog item may use a concise scoped message such as `docs: record baseline architecture`.

## Decisions

Create a numbered ADR under `docs/decisions/` for choices that constrain future implementation. Mark superseded decisions rather than deleting them.

## Test data

Do not commit Telegram credentials, cookies, sessions or unsanitized private messages. Prefer synthetic fixtures; sanitize captured DOM before adding it to Git.

## Android test targets

### Galaxy A57
Primary real-device target.

Use it for Samsung/Android behaviour, phone-call audio focus, screen lock,
Doze, real Telegram Web sessions and final background acceptance tests.

Transport:
- Wireless ADB from `u24`.
- Edge Android + Tampermonkey + CDP.

### Android Emulator
Secondary fast development target.

Use it for rapid browser/userscript regression tests, DOM/queue/control
experiments and reproducible clean Android state.

It does not replace Galaxy A57 for Samsung-specific behaviour, telephony,
audio focus, power management or final lock-screen acceptance tests.

Current setup:
- Hyper-V nested virtualization is enabled for `u24`.
- `/dev/kvm` is available and KVM acceleration is usable.
- AVD: `voxthread-api36`, Android 16/API 36, Google APIs x86_64.
- Runtime: 2 vCPU, 2 GiB RAM, headless SwiftShader.
- Chrome is exposed through CDP on host port `9223`.
- `npm run test:emulator` performs the repeatable Chrome/Web Speech smoke test.

## Emulator release gate

Run the complete emulator-capable regression set with:

```bash
npm run test:emulator:all
```

It covers Node tests, Chrome Web Speech availability, sleep/wake no-skip
recovery, live-follow after queue completion, and real-touch start selection.
Galaxy A57 remains the acceptance target for Samsung-specific power/audio
behaviour and the final Tampermonkey deployment path.

## GitHub Actions fallback development environment

GitHub Actions is the independent fallback when `u24` is unavailable.

- `CI` runs on every push and pull request: clean `npm ci`, all Node tests,
  development userscript build, and generated-bundle reproducibility check.
- `Android emulator regression` runs on `main`, pull requests, or manually. It
  creates an API 36 x86_64 Google Play AVD with KVM, prepares Chrome for CDP,
  then runs smoke, lifecycle, live-follow and real-touch selection regressions.
- Emulator diagnostics are retained as a short-lived workflow artifact.

No secret Telegram state is required by either workflow; all browser regressions
use committed sanitized fixtures.
