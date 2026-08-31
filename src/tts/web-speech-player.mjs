// src/tts/web-speech-player.mjs
import { splitSpeechText } from './text-chunks.mjs';

export class WebSpeechPlayer {
  #generation = 0;
  #restartOnResume = false;
  #lastError = null;
  #chunkIndex = 0;
  #transitionTimer = null;
  #waitingForNext = false;

  constructor({
    queue,
    speechSynthesis,
    Utterance,
    voiceResolver = null,
    prosodyResolver = null,
    maxUtteranceChars = 480,
  }) {
    this.queue = queue;
    this.speechSynthesis = speechSynthesis;
    this.Utterance = Utterance;
    this.voiceResolver = voiceResolver;
    this.prosodyResolver = prosodyResolver;
    this.maxUtteranceChars = maxUtteranceChars;
  }

  #segmentChunks(segment) {
    const text =
      segment.announceAuthor && segment.authorName
        ? `${segment.authorName}. ${segment.text}`
        : segment.text;

    return splitSpeechText(text, {
      maxChars: this.maxUtteranceChars,
    });
  }

  #clearTransitionTimer() {
    if (this.#transitionTimer !== null) {
      clearTimeout(this.#transitionTimer);
      this.#transitionTimer = null;
    }
  }

  #advanceAfterPause(segment, generation) {
    const delay = Math.max(0, Number(segment.pauseAfterMs) || 0);

    if (!delay) {
      this.queue.advance();
      this.#speakCurrent();
      return;
    }

    this.#waitingForNext = true;
    this.#clearTransitionTimer();

    this.#transitionTimer = setTimeout(() => {
      this.#transitionTimer = null;

      if (generation !== this.#generation) return;
      if (this.queue.status !== 'playing') return;

      this.#waitingForNext = false;
      this.queue.advance();
      this.#speakCurrent();
    }, delay);
  }

  #speakCurrent() {
    const segment = this.queue.current;
    if (!segment || this.queue.status !== 'playing') return;

    const generation = this.#generation;
    const chunks = this.#segmentChunks(segment);
    if (!chunks.length) {
      this.#chunkIndex = 0;
      this.#advanceAfterPause(segment, generation);
      return;
    }

    if (this.#chunkIndex >= chunks.length) {
      this.#chunkIndex = 0;
    }

    const utterance = new this.Utterance(chunks[this.#chunkIndex]);
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

      if (this.#chunkIndex < chunks.length - 1) {
        this.#chunkIndex += 1;
        this.#speakCurrent();
        return;
      }

      this.#chunkIndex = 0;
      this.#advanceAfterPause(segment, generation);
    };

    utterance.onerror = event => {
      if (generation !== this.#generation) return;

      this.#lastError = String(event?.error || 'unknown');
      this.#waitingForNext = false;
      this.#clearTransitionTimer();
      this.#restartOnResume = true;
      this.#generation += 1;
      this.queue.pause();
    };

    this.speechSynthesis.speak(utterance);
  }

  play() {
    this.#generation += 1;
    this.#clearTransitionTimer();
    this.#waitingForNext = false;
    this.#chunkIndex = 0;
    this.#restartOnResume = false;
    this.#lastError = null;
    this.speechSynthesis.cancel();
    this.queue.play();
    this.#speakCurrent();
  }

  pause() {
    this.speechSynthesis.pause();
    this.queue.pause();

    if (this.#waitingForNext) {
      this.#clearTransitionTimer();
    }
  }

  resume() {
    if (this.queue.status !== 'paused') return;

    this.queue.resume();

    if (this.#waitingForNext) {
      this.#waitingForNext = false;
      this.#generation += 1;
      this.queue.advance();
      this.#speakCurrent();
      return;
    }

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
    this.#clearTransitionTimer();
    this.#waitingForNext = false;
    this.#chunkIndex = 0;
    this.#restartOnResume = false;
    this.#lastError = null;
    this.speechSynthesis.cancel();
    this.queue.stop();
  }

  next() {
    const wasPlaying = this.queue.status === 'playing';
    const wasPaused = this.queue.status === 'paused';

    this.#clearTransitionTimer();
    this.#waitingForNext = false;
    this.#chunkIndex = 0;
    this.#restartOnResume = false;
    this.#lastError = null;
    this.#generation += 1;
    this.speechSynthesis.cancel();
    this.queue.next();

    if (wasPlaying && this.queue.status !== 'completed') {
      this.queue.play();
      this.#speakCurrent();
    } else if (wasPaused && this.queue.status !== 'completed') {
      this.#restartOnResume = true;
    }
  }

  previous() {
    const wasPlaying = this.queue.status === 'playing';
    const wasPaused = this.queue.status === 'paused';

    this.#clearTransitionTimer();
    this.#waitingForNext = false;
    this.#chunkIndex = 0;
    this.#restartOnResume = false;
    this.#lastError = null;
    this.#generation += 1;
    this.speechSynthesis.cancel();
    this.queue.previous();

    if (wasPlaying) {
      this.queue.play();
      this.#speakCurrent();
    } else if (wasPaused) {
      this.#restartOnResume = true;
    }
  }

  get lastError() {
    return this.#lastError;
  }

  get chunkIndex() {
    return this.#chunkIndex;
  }

  get chunkCount() {
    const segment = this.queue.current;
    return segment ? this.#segmentChunks(segment).length : 0;
  }
}
