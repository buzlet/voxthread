// src/tts/text-chunks.mjs

const ABBREVIATION_RE = /(?:^|\s)(?:т|е|к|д|п|г|ул|стр|рис|см|им|т\.\s?е|т\.\s?к|т\.\s?д|т\.\s?п|и\.\s?т\.\s?д|и\.\s?т\.\s?п|mr|mrs|ms|dr|prof|sr|jr|vs|etc|e\.g|i\.e)\.[»”’"')\]]*$/iu;
const INITIAL_RE = /(?:^|\s)\p{L}\.[»”’"')\]]*$/u;
const COMMON_TLDS = new Set([
  'app', 'biz', 'com', 'dev', 'edu', 'gov', 'info', 'io', 'me', 'net', 'org',
  'ru', 'ua', 'uk',
]);

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

function looksLikeDomainBoundary(left, right) {
  const leftMatch = String(left).trim().match(/([\p{L}\p{N}-]{1,63})\.[»”’"')\]]*$/u);
  const rightMatch = String(right).trim().match(/^([\p{L}\p{N}-]{2,63})(?:[/:\s]|$)/u);
  return Boolean(
    leftMatch
    && rightMatch
    && COMMON_TLDS.has(rightMatch[1].toLowerCase())
  );
}

function shouldMergeBoundary(left, right) {
  const before = String(left).trim();
  const after = String(right).trim();
  if (!before || !after) return false;
  if (ABBREVIATION_RE.test(before)) return true;
  if (INITIAL_RE.test(before) && /^\p{L}/u.test(after)) return true;
  if (looksLikeDomainBoundary(before, after)) return true;
  return false;
}

function correctTelegramBoundaries(parts) {
  const result = [];

  for (const raw of parts) {
    const part = String(raw ?? '').trim();
    if (!part) continue;
    const previous = result.at(-1);
    if (previous && shouldMergeBoundary(previous, part)) {
      result[result.length - 1] = `${previous} ${part}`;
    } else {
      result.push(part);
    }
  }

  return result;
}

function fallbackSentenceSegments(value) {
  return value
    .split(/(?<=[.!?…。！？؟])\s+|\n+/u)
    .map(part => part.trim())
    .filter(Boolean);
}

export function segmentSpeechSentences(text, {
  locale = undefined,
  SegmenterCtor = globalThis.Intl?.Segmenter,
} = {}) {
  const value = String(text ?? '').trim();
  if (!value) return [];

  let parts;
  if (typeof SegmenterCtor === 'function') {
    try {
      const segmenter = new SegmenterCtor(locale, { granularity: 'sentence' });
      parts = [...segmenter.segment(value)].map(item => item.segment);
    } catch {
      parts = fallbackSentenceSegments(value);
    }
  } else {
    parts = fallbackSentenceSegments(value);
  }

  return correctTelegramBoundaries(parts);
}

export function splitSpeechText(text, {
  maxChars = 480,
  locale = undefined,
  SegmenterCtor = globalThis.Intl?.Segmenter,
} = {}) {
  const value = String(text ?? '').trim();
  if (!value) return [];

  const limit = Math.max(80, Number(maxChars) || 480);
  if (value.length <= limit) return [value];

  const parts = segmentSpeechSentences(value, { locale, SegmenterCtor })
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
