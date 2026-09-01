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

function replaceLiteral(text, search, replacement) {
  if (!search || !text.includes(search)) return text;
  return text.split(search).join(replacement);
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

  const entities = [...(policy.entities ?? [])]
    .filter(entity => entity?.text)
    .sort((a, b) => String(b.text).length - String(a.text).length);

  for (const entity of entities) {
    value = replaceLiteral(value, entity.text, entitySpeech(entity, policy));
  }

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
