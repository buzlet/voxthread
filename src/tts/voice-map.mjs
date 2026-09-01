// src/tts/voice-map.mjs

function hashString(value) {
  let hash = 0x811c9dc5;
  for (const char of String(value ?? '')) {
    hash ^= char.codePointAt(0);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

function primaryLanguage(value) {
  return String(value ?? '').trim().toLowerCase().split(/[-_]/)[0] || null;
}

function normalizedLanguage(value) {
  const primary = primaryLanguage(value);
  if (!primary) return null;
  if (primary === 'uk') return 'uk-UA';
  if (primary === 'ru') return 'ru-RU';
  if (primary === 'en') return 'en-US';
  return String(value).trim();
}

function speechLetters(text) {
  return String(text ?? '')
    .replace(/\b(?:https?:\/\/|www\.|t\.me\/)[^\s]+/giu, ' ')
    .replace(/(^|\s)[@#][\p{L}\p{N}_]+/gu, ' ')
    .match(/\p{L}+/gu) ?? [];
}

function scriptCounts(text) {
  const tokens = speechLetters(text);
  let cyrillic = 0;
  let latin = 0;
  let other = 0;
  let cyrillicTokens = 0;
  let latinTokens = 0;
  let ukrainianSpecific = 0;
  let russianSpecific = 0;

  for (const token of tokens) {
    let tokenCyrillic = 0;
    let tokenLatin = 0;
    for (const char of token) {
      if (/\p{Script=Cyrillic}/u.test(char)) {
        cyrillic += 1;
        tokenCyrillic += 1;
        if (/[іїєґІЇЄҐ]/u.test(char)) ukrainianSpecific += 1;
        if (/[ыэъёЫЭЪЁ]/u.test(char)) russianSpecific += 1;
      } else if (/\p{Script=Latin}/u.test(char)) {
        latin += 1;
        tokenLatin += 1;
      } else {
        other += 1;
      }
    }
    if (tokenCyrillic > 0 && tokenLatin === 0) cyrillicTokens += 1;
    if (tokenLatin > 0 && tokenCyrillic === 0) latinTokens += 1;
  }

  return {
    cyrillic,
    latin,
    other,
    cyrillicTokens,
    latinTokens,
    ukrainianSpecific,
    russianSpecific,
  };
}

export function inferLanguageHint(text, {
  preferredLanguage = null,
  minLetters = 6,
  dominance = 0.68,
} = {}) {
  const preferred = normalizedLanguage(preferredLanguage);
  const counts = scriptCounts(text);
  let cyrillic = counts.cyrillic;
  let latin = counts.latin;

  // One short foreign-script token is usually a brand/acronym, not a language
  // switch ("Привет OpenAI", "release Телеграм").
  if (
    counts.cyrillicTokens >= 1
    && counts.latinTokens === 1
    && latin <= Math.max(8, Math.floor(cyrillic * 0.6))
  ) {
    latin = 0;
  }
  if (
    counts.latinTokens >= 1
    && counts.cyrillicTokens === 1
    && cyrillic <= Math.max(6, Math.floor(latin * 0.45))
  ) {
    cyrillic = 0;
  }

  const total = cyrillic + latin;
  if (total < Math.max(1, Number(minLetters) || 6)) return preferred;

  const threshold = Math.min(0.95, Math.max(0.5, Number(dominance) || 0.68));
  if (cyrillic / total >= threshold) {
    if (counts.ukrainianSpecific > 0 && counts.russianSpecific === 0) return 'uk-UA';
    if (counts.russianSpecific > 0 && counts.ukrainianSpecific === 0) return 'ru-RU';
    if (['uk', 'ru'].includes(primaryLanguage(preferred))) return preferred;
    return 'ru-RU';
  }

  if (latin / total >= threshold) return 'en-US';
  return preferred;
}

export function resolveLanguageHint(segment, preferences = {}) {
  const authorKey = String(segment?.authorKey ?? '');
  const chatId = String(segment?.chatId ?? '');
  const manual = preferences.manualOverrides?.[authorKey]
    ?? preferences.manualOverrides?.[`chat:${chatId}`]
    ?? null;
  if (manual) return normalizedLanguage(manual);

  const preferred = preferences.authorPreferences?.[authorKey]
    ?? preferences.chatPreferences?.[chatId]
    ?? preferences.defaultLanguage
    ?? null;

  return inferLanguageHint(segment?.text, {
    preferredLanguage: preferred,
    minLetters: preferences.minLetters,
    dominance: preferences.dominance,
  });
}

export function selectVoice({
  authorKey,
  voices,
  languageHint = null,
  overrides = {},
}) {
  const list = [...(voices ?? [])];
  if (!list.length) return null;

  const override = overrides?.[authorKey] ?? null;
  if (override) {
    const exact = list.find(voice =>
      voice.voiceURI === override
      || voice.name === override
    );
    if (exact) return exact;
  }

  const language = primaryLanguage(languageHint);
  const compatible = language
    ? list.filter(voice => primaryLanguage(voice.lang) === language)
    : [];

  const pool = compatible.length ? compatible : list;
  return pool[hashString(authorKey) % pool.length];
}

export function prosodyForAuthor(authorKey) {
  const hash = hashString(authorKey);
  const rateStep = hash % 5;
  const pitchStep = (hash >>> 8) % 7;

  return Object.freeze({
    rate: 0.96 + rateStep * 0.02,
    pitch: 0.94 + pitchStep * 0.02,
  });
}

export function createVoiceResolver({
  getVoices,
  overrides = {},
  languageForSegment = null,
}) {
  return segment => selectVoice({
    authorKey: segment.authorKey,
    voices: getVoices(),
    overrides,
    languageHint: languageForSegment?.(segment) ?? null,
  });
}
