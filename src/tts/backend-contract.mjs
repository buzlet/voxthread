// src/tts/backend-contract.mjs

export const TTS_BACKEND_API_VERSION = 2;

const EXECUTION_MODES = new Set(['browser', 'native', 'remote', 'hybrid', 'unknown']);
const NETWORK_MODES = new Set(['never', 'required', 'provider-dependent', 'unknown']);
const BACKGROUND_MODES = new Set(['supported', 'runtime-dependent', 'unsupported', 'unknown']);

function enumValue(value, allowed, fallback) {
  const normalized = String(value ?? '');
  return allowed.has(normalized) ? normalized : fallback;
}

export function normalizeTtsCapabilities(input = {}) {
  const maxTextLength = Number(input.maxTextLength);

  return Object.freeze({
    apiVersion: TTS_BACKEND_API_VERSION,
    provider: String(input.provider || 'unknown'),
    execution: enumValue(input.execution, EXECUTION_MODES, 'unknown'),
    network: enumValue(input.network, NETWORK_MODES, 'unknown'),
    background: enumValue(input.background, BACKGROUND_MODES, 'unknown'),
    voiceSelection: Boolean(input.voiceSelection),
    pauseResume: Boolean(input.pauseResume),
    streaming: Boolean(input.streaming),
    wordBoundary: Boolean(input.wordBoundary),
    maxTextLength: Number.isFinite(maxTextLength) && maxTextLength > 0
      ? Math.floor(maxTextLength)
      : null,
  });
}
