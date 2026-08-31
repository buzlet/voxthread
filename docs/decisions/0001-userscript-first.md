<!-- docs/decisions/0001-userscript-first.md -->
# ADR 0001: Userscript-first Telegram reader

- Status: Accepted
- Date: 2026-08-31

## Context

The desired product reads Telegram messages continuously with human-oriented filtering and distinct voices per author. Implementing a full Telegram client through TDLib would provide maximum control but adds substantial authentication, synchronization, UI and lifecycle code before the reading concept is validated.

Telegram Web already provides authentication, synchronization, message rendering and history loading. Modern Android browsers can run userscripts and expose browser TTS APIs.

## Decision

Start with a JavaScript userscript injected into Telegram Web K. Keep the reader core independent from Telegram DOM details and browser TTS so either boundary can later be replaced.

Edge Android + Tampermonkey is the primary initial runtime because Chromium/CDP is convenient for automated debugging from `u24`. Firefox Android remains a comparison/fallback target until real locked-screen tests are complete.

## Consequences

- Fastest path to validating listening UX and voice assignment.
- Telegram Web DOM changes can break only the Telegram adapter if boundaries are respected.
- Browser background suspension may make `speechSynthesis` unsuitable for locked-screen playback.
- Failure of browser TTS does not imply failure of the architecture; a native TTS/foreground-service shell can replace the runtime layer later.
- TDLib remains a possible future replacement for Telegram Web if browser integration becomes the dominant limitation.
