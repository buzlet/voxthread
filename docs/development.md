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
