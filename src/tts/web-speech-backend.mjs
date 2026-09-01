// src/tts/web-speech-backend.mjs
import { WebSpeechPlayer } from './web-speech-player.mjs';
import {
  createVoiceResolver,
  prosodyForAuthor,
  resolveLanguageHint,
} from './voice-map.mjs';
import {
  normalizeTtsCapabilities,
  TTS_BACKEND_API_VERSION,
} from './backend-contract.mjs';

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
  });
}

export class WebSpeechBackend {
  constructor({
    speechSynthesis,
    Utterance,
    voiceOverrides = {},
    languagePreferences = {},
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
    this.languagePreferences = languagePreferences;
    this.maxUtteranceChars = maxUtteranceChars;
    this.apiVersion = TTS_BACKEND_API_VERSION;
  }

  #rawVoices() {
    const voices = this.speechSynthesis.getVoices?.();
    return Array.isArray(voices) ? voices : [];
  }

  getCapabilities() {
    return normalizeTtsCapabilities({
      provider: 'web-speech',
      execution: 'browser',
      network: 'provider-dependent',
      background: 'runtime-dependent',
      voiceSelection: true,
      pauseResume: true,
      streaming: false,
      wordBoundary: false,
      maxTextLength: this.maxUtteranceChars,
    });
  }

  createPlayer({ queue }) {
    const voiceResolver = createVoiceResolver({
      getVoices: () => this.#rawVoices(),
      overrides: this.voiceOverrides,
      languageForSegment: segment => resolveLanguageHint(
        segment,
        this.languagePreferences,
      ),
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

    const language = primaryLanguage(resolveLanguageHint(
      segment,
      this.languagePreferences,
    ));
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
      apiVersion: this.apiVersion,
      capabilities: this.getCapabilities(),
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
