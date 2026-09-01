// src/core/tts-text-normalizer.mjs

const URL_RE = /\b(?:https?:\/\/|www\.|t\.me\/)[^\s<>()]+/giu;
const MENTION_RE = /(^|[^\p{L}\p{N}_])@([\p{L}\p{N}_]{2,})/gu;
const HASHTAG_RE = /(^|[^\p{L}\p{N}_])#([\p{L}\p{N}_]{2,})/gu;

function trimUrlPunctuation(value) {
  const match = String(value).match(/^(.*?)([.,!?;:»”'\])}]*)$/u);
  return match ? { url: match[1], suffix: match[2] } : { url: value, suffix: '' };
}

function domainFromUrl(value) {
  const raw = String(value);
  const qualified = /^https?:\/\//i.test(raw)
    ? raw
    : `https://${raw}`;
  try {
    return new URL(qualified).hostname.replace(/^www\./i, '');
  } catch {
    return raw;
  }
}

export function simplifyLinks(text, mode = 'domain') {
  if (mode === 'verbatim') return String(text ?? '');

  return String(text ?? '').replace(URL_RE, raw => {
    const { url, suffix } = trimUrlPunctuation(raw);
    if (mode === 'skip') return suffix;
    return `${domainFromUrl(url)}${suffix}`;
  })
    .replace(/\s+([,.;:!?。！？؟؛])/gu, '$1')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function entitySpeech(entity, options) {
  const text = String(entity.text ?? '').trim();
  if (!text) return '';

  switch (entity.type) {
    case 'link':
      if (options.linkMode === 'skip') return '';
      if (options.linkMode === 'verbatim') return entity.href || text;
      return domainFromUrl(entity.href || text);
    case 'mention':
      return options.mentionMode === 'verbatim' ? text : text.replace(/^@/, '');
    case 'hashtag':
      return options.hashtagMode === 'verbatim' ? text : text.replace(/^#/, '');
    case 'code':
    case 'pre':
      return options.codeMode === 'skip'
        ? ''
        : text.replace(/[\t ]+/g, ' ').replace(/\n+/g, ' ').trim();
    case 'spoiler':
      return options.spoilerMode === 'skip' ? '' : text;
    case 'quote':
      return options.quoteMode === 'skip' ? '' : text;
    default:
      return text;
  }
}

function nthIndexOf(value, search, occurrence = 0) {
  if (!search) return -1;
  const target = Math.max(0, Number.isInteger(occurrence) ? occurrence : 0);
  let from = 0;
  let found = -1;

  for (let current = 0; current <= target; current += 1) {
    found = value.indexOf(search, from);
    if (found < 0) return -1;
    from = found + search.length;
  }

  return found;
}

function overlaps(left, right) {
  return left.start < right.end && right.start < left.end;
}

function applyStructuredEntities(value, entities, policy) {
  const candidates = [];

  for (const entity of entities ?? []) {
    const text = String(entity?.text ?? '').trim();
    if (!text) continue;
    const start = nthIndexOf(value, text, entity.occurrence ?? 0);
    if (start < 0) continue;
    const replacement = entitySpeech(entity, policy);
    if (replacement === text) continue;

    candidates.push({
      start,
      end: start + text.length,
      replacement,
    });
  }

  // For overlapping/nested Telegram entities, the wider policy wins. This is
  // important for cases such as a skipped spoiler containing a link: the
  // spoiler must suppress the whole span instead of letting the inner link
  // policy leak content back into speech.
  candidates.sort((a, b) =>
    (b.end - b.start) - (a.end - a.start)
    || a.start - b.start
  );

  const selected = [];
  for (const candidate of candidates) {
    if (!selected.some(item => overlaps(item, candidate))) {
      selected.push(candidate);
    }
  }

  selected.sort((a, b) => b.start - a.start);
  let result = value;
  for (const span of selected) {
    result = `${result.slice(0, span.start)}${span.replacement}${result.slice(span.end)}`;
  }
  return result;
}

export function normalizeTelegramTextForSpeech(text, options = {}) {
  const policy = {
    linkMode: 'domain',
    mentionMode: 'plain',
    hashtagMode: 'plain',
    codeMode: 'verbatim',
    spoilerMode: 'verbatim',
    quoteMode: 'verbatim',
    entities: [],
    ...options,
  };

  let value = String(text ?? '').replace(/\r\n?/g, '\n').trim();
  value = applyStructuredEntities(value, policy.entities, policy);

  value = simplifyLinks(value, policy.linkMode);
  if (policy.mentionMode !== 'verbatim') {
    value = value.replace(MENTION_RE, '$1$2');
  }
  if (policy.hashtagMode !== 'verbatim') {
    value = value.replace(HASHTAG_RE, '$1$2');
  }

  return value
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\s+([,.;:!?。！？؟؛])/gu, '$1')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
