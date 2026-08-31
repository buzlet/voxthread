// src/tts/text-chunks.mjs

function wrapLongPart(part, maxChars) {
  const chunks = [];
  let rest = part.trim();

  while (rest.length > maxChars) {
    const window = rest.slice(0, maxChars + 1);
    let cut = window.lastIndexOf(' ');

    if (cut < Math.floor(maxChars * 0.55)) {
      cut = maxChars;
    }

    chunks.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }

  if (rest) chunks.push(rest);
  return chunks;
}

export function splitSpeechText(text, { maxChars = 480 } = {}) {
  const value = String(text ?? '').trim();
  if (!value) return [];

  const limit = Math.max(80, Number(maxChars) || 480);
  if (value.length <= limit) return [value];

  const parts = value
    .split(/(?<=[.!?…])\s+|\n+/u)
    .map(part => part.trim())
    .filter(Boolean)
    .flatMap(part => wrapLongPart(part, limit));

  const chunks = [];
  let current = '';

  for (const part of parts) {
    const candidate = current ? `${current} ${part}` : part;

    if (candidate.length <= limit) {
      current = candidate;
      continue;
    }

    if (current) chunks.push(current);
    current = part;
  }

  if (current) chunks.push(current);
  return chunks;
}
