<!-- docs/decisions/0002-project-name-voxthread.md -->
# ADR 0002: Project name is VoxThread

Status: accepted, 2026-08-31.

## Decision

Use **VoxThread** as the public project/product name and `voxthread` as the preferred repository/directory slug.

Keep the existing `TWR-xxx` backlog identifiers. They are stable historical references and do not need to mirror the public project name.

## Rationale

`Vox` conveys spoken voice and `Thread` conveys an ordered conversation or message thread without tying the project permanently to Telegram.

The name is short, pronounceable, suitable for a userscript or later native application, and had no exact repository-name match in the GitHub search performed when selected.

## Consequences

Documentation and local repository paths should use VoxThread/`voxthread`. Browser/runtime choices, Telegram adapters and TTS engines remain implementation details rather than part of the product name.
