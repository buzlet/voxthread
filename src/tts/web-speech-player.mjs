// src/tts/web-speech-player.mjs

export class WebSpeechPlayer {
  #generation = 0;
  #restartOnResume = false;
  #lastError = null;

  constructor({
    queue,
    speechSynthesis,
    Utterance,
    voiceResolver = null,
    prosodyResolver = null,
  }) {
    this.queue = queue;
    this.speechSynthesis = speechSynthesis;
    this.Utterance = Utterance;
    this.voiceResolver = voiceResolver;
    this.prosodyResolver = prosodyResolver;
  }

  #utteranceText(segment) {
    if (segment.announceAuthor && segment.authorName) {
      return `${segment.authorName}. ${segment.text}`;
    }
    return segment.text;
  }

  #speakCurrent() {
    const segment = this.queue.current;
    if (!segment || this.queue.status !== 'playing') return;

    const generation = this.#generation;
    const utterance = new this.Utterance(this.#utteranceText(segment));
    const voice = this.voiceResolver?.(segment) ?? null;

    if (voice) {
      utterance.voice = voice;
      if (voice.lang) utterance.lang = voice.lang;
    }

    const prosody = this.prosodyResolver?.(segment) ?? null;
    if (prosody?.rate) utterance.rate = prosody.rate;
    if (prosody?.pitch) utterance.pitch = prosody.pitch;

    utterance.onend = () => {
      if (generation !== this.#generation) return;
      this.#lastError = null;
      this.#restartOnResume = false;
      this.queue.advance();
      this.#speakCurrent();
    };

    utterance.onerror = event => {
      if (generation !== this.#generation) return;
      this.#lastError = String(event?.error || 'unknown');
      this.#restartOnResume = true;
      this.#generation += 1;
      this.queue.pause();
    };

    this.speechSynthesis.speak(utterance);
  }

  play() {
    this.#generation += 1;
    this.#restartOnResume = false;
    this.#lastError = null;
    this.speechSynthesis.cancel();
    this.queue.play();
    this.#speakCurrent();
  }

  pause() {
    this.speechSynthesis.pause();
    this.queue.pause();
  }

  resume() {
    if (this.queue.status !== 'paused') return;

    this.queue.resume();
    if (this.#restartOnResume) {
      this.#restartOnResume = false;
      this.#generation += 1;
      this.#speakCurrent();
      return;
    }

    this.speechSynthesis.resume();
  }

  stop() {
    this.#generation += 1;
    this.#restartOnResume = false;
    this.#lastError = null;
    this.speechSynthesis.cancel();
    this.queue.stop();
  }

  next() {
    const wasPlaying = this.queue.status === 'playing';
    this.#restartOnResume = false;
    this.#lastError = null;
    this.#generation += 1;
    this.speechSynthesis.cancel();
    this.queue.next();

    if (wasPlaying && this.queue.status !== 'completed') {
      this.queue.play();
      this.#speakCurrent();
    }
  }

  get lastError() {
    return this.#lastError;
  }

  previous() {
    const wasPlaying = this.queue.status === 'playing';
    this.#restartOnResume = false;
    this.#lastError = null;
    this.#generation += 1;
    this.speechSynthesis.cancel();
    this.queue.previous();

    if (wasPlaying) {
      this.queue.play();
      this.#speakCurrent();
    }
  }
}
