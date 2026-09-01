#!/bin/sh
# tools/install-git-hooks.sh
set -eu
git config core.hooksPath .githooks
chmod +x .githooks/pre-commit .githooks/pre-push
printf 'core.hooksPath=%s\n' "$(git config --get core.hooksPath)"
