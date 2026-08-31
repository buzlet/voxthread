// src/tts/web-speech-backend.mjs
import { WebSpeechPlayer } from './web-speech-player.mjs';
import {
  createVoiceResolver,
  inferLanguageHint,
  prosodyForAuthor,
} from './voice-map.mjs';

function primaryLanguage(value) {
  return String(value ?? '').toLowerCase().split(/[-_]/)[0] || null;
}

function normalizeVoice(voice) {
  return Object.freeze({
    id: String(voice?.voiceURI || voice?.name || ''),
    name: String(voice?.name || voice?.voiceURI || 'Unknown voice'),
    lang: String(voice?.lang || ''),
    local: Boolean(voice?.localService),
    default: Boolean(voice?.default),
    native: voice,
  });
}

/**
 * Provider boundary for browser Web Speech.
 *
 * The application runtime talks to this object rather than directly to
 * speechSynthesis/SpeechSynthesisUtterance. A remote/native TTS provider can
 * replace this class by implementing the same small surface:
 * createPlayer(), listVoices(), onVoicesChanged(), diagnostics().
 */
export class WebSpeechBackend {
  constructor({
    speechSynthesis,
    Utterance,
    voiceOverrides = {},
    maxUtteranceChars = 480,
  }) {
    if (!speechSynthesis || typeof speechSynthesis.speak !== 'function') {
      throw new TypeError('WebSpeechBackend requires speechSynthesis');
    }
    if (typeof Utterance !== 'function') {
      throw new TypeError('WebSpeechBackend requires an Utterance constructor');
    }

    this.speechSynthesis = speechSynthesis;
    this.Utterance = Utterance;
    this.voiceOverrides = voiceOverrides;
    this.maxUtteranceChars = maxUtteranceChars;
  }

  #rawVoices() {
    const voices = this.speechSynthesis.getVoices?.();
    return Array.isArray(voices) ? voices : [];
  }

  createPlayer({ queue }) {
    const voiceResolver = createVoiceResolver({
      getVoices: () => this.#rawVoices(),
      overrides: this.voiceOverrides,
      languageForSegment: segment => inferLanguageHint(segment.text),
    });

    return new WebSpeechPlayer({
      queue,
      speechSynthesis: this.speechSynthesis,
      Utterance: this.Utterance,
      voiceResolver,
      prosodyResolver: segment => prosodyForAuthor(segment.authorKey),
      maxUtteranceChars: this.maxUtteranceChars,
    });
  }

  listVoices(segment = null) {
    const voices = this.#rawVoices();
    if (!segment) return voices.map(normalizeVoice);

    const language = primaryLanguage(inferLanguageHint(segment?.text));
    const compatible = language
      ? voices.filter(voice => primaryLanguage(voice.lang) === language)
      : voices;

    return (compatible.length ? compatible : voices).map(normalizeVoice);
  }

  onVoicesChanged(listener) {
    if (typeof listener !== 'function') return () => {};
    const add = this.speechSynthesis.addEventListener?.bind(this.speechSynthesis);
    const remove = this.speechSynthesis.removeEventListener?.bind(this.speechSynthesis);
    if (!add) return () => {};

    add('voiceschanged', listener);
    return () => remove?.('voiceschanged', listener);
  }

  diagnostics(player = null) {
    const voices = this.#rawVoices();
    return Object.freeze({
      provider: 'web-speech',
      speaking: Boolean(this.speechSynthesis.speaking),
      pending: Boolean(this.speechSynthesis.pending),
      paused: Boolean(this.speechSynthesis.paused),
      error: player?.lastError ?? null,
      chunkIndex: player?.chunkIndex ?? 0,
      chunkCount: player?.chunkCount ?? 0,
      voiceCount: voices.length,
      fallbackProsody: voices.length === 0,
    });
  }
}
