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

export function inferLanguageHint(text) {
  const value = String(text ?? '');
  if (/[іїєґІЇЄҐ]/u.test(value)) return 'uk-UA';
  if (/[А-Яа-яЁё]/u.test(value)) return 'ru-RU';
  if (/[A-Za-z]/u.test(value)) return 'en-US';
  return null;
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
