<!-- docs/development.md -->
# Development workflow

## Commit-before-run rule

Any executable change, including diagnostics and one-off experiments, must be committed before execution on Android, a browser, CI or an optional development host.

Recommended sequence:

1. Edit source/test/documentation files in a branch/worktree.
2. Review the diff and repository status.
3. Commit the complete experiment.
4. Push the branch and let GitHub Actions run it.
5. Record non-obvious observations in `docs/notes/` with the tested commit SHA.
6. Fix failures in a new commit; do not rewrite an observed commit.

This makes every reported behaviour attributable to an exact Git revision.

## Primary development environment

GitHub is the authoritative and reproducible development/test environment. Do not depend on `u24` or another always-on host.

- Work in a branch based on current `main`.
- Push complete commits to GitHub.
- `CI` runs Node tests and reproducible userscript builds.
- `Android emulator regression` runs the API 36 Chrome release gate.
- `Firefox Android comparison` is an investigation workflow used when browser choice may change the runtime decision.
- Keep Android diagnostics as workflow artifacts; never put Telegram credentials or private messages in them.

A local machine or `u24` may still be used as a convenience when available, but it is not required for ordinary development or CI acceptance.

## Commit messages

Use `TWR-xxx: description` when a backlog item applies. Infrastructure/documentation commits without a backlog item may use a concise scoped message such as `docs: record baseline architecture`.

## Decisions

Create a numbered ADR under `docs/decisions/` for choices that constrain future implementation. Mark superseded decisions rather than deleting them.

## Test data

Do not commit Telegram credentials, cookies, sessions or unsanitized private messages. Prefer synthetic fixtures; sanitize captured DOM before adding it to Git.

## TTS provider development

Provider-specific speech code belongs under `src/tts/`. Runtime/core/UI code must consume the backend surface rather than browser-native speech objects.

The current `WebSpeechBackend` owns Web Speech APIs and returns normalized voice descriptors. A native or remote backend should implement the same application-facing capabilities instead of adding provider checks throughout the program. Remote TTS requires a separate privacy/security ADR because message text leaves the device.

## Android test targets

### Galaxy A57

Primary real-device acceptance target. Use it for Samsung-specific power management, phone-call audio focus, secure lock-screen behaviour, Doze, real Telegram Web sessions and final Tampermonkey deployment/update acceptance.

When a suitable development host is available, Wireless ADB/CDP is the preferred transport. Real-device acceptance is intentionally separate from GitHub CI.

### GitHub Android Emulator

Primary automated Android regression target.

Current setup:

- GitHub-hosted Ubuntu 24.04 with KVM.
- Android 16/API 36 x86_64 Google Play image.
- Chrome with CDP.
- Synthetic/sanitized Telegram fixtures only.
- 2 vCPU, 2 GiB RAM, headless SwiftShader.

It does not replace Galaxy A57 for Samsung-specific behaviour, telephony, OEM power management or final secure-device acceptance.

## Emulator release gate

Run the complete emulator-capable regression set with:

```bash
npm run test:emulator:all
```

The GitHub Android workflow additionally records a foreground/background/screen-off/locked-screen TTS lifecycle matrix. The safety invariant is that lifecycle interruption may pause or fail speech, but it must never silently advance past the current message.

The gate covers Node tests, Chrome Web Speech availability, sleep/wake no-skip recovery, live-follow after queue completion and real-touch start selection.

## Userscript build and release

Development bundle:

```bash
npm run build:dev
```

Production userscript:

```bash
npm run build:userscript
npm run verify:userscript
```

Production output is always `dist/voxthread.user.js`. CI rebuilds both development and production outputs twice and compares them byte-for-byte.

A release tag must be `vX.Y.Z` and match `package.json` version. `.github/workflows/release.yml` verifies tests, metadata and reproducibility before publishing `voxthread.user.js` plus its SHA-256 file to the GitHub release. The userscript metadata points Tampermonkey-compatible update checks at the stable latest-release asset URL.

## Privacy

No GitHub workflow requires Telegram credentials. Browser regressions use committed sanitized fixtures. Do not upload cookies, session databases, pairing secrets, private messages or unsanitized browser state as artifacts.
