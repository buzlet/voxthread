// src/tts/web-speech-player.mjs

export class WebSpeechPlayer {
  #generation = 0;

  constructor({
    queue,
    speechSynthesis,
    Utterance,
    voiceResolver = null,
  }) {
    this.queue = queue;
    this.speechSynthesis = speechSynthesis;
    this.Utterance = Utterance;
    this.voiceResolver = voiceResolver;
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

    utterance.onend = () => {
      if (generation !== this.#generation) return;
      this.queue.advance();
      this.#speakCurrent();
    };

    utterance.onerror = () => {
      if (generation !== this.#generation) return;
      this.queue.advance();
      this.#speakCurrent();
    };

    this.speechSynthesis.speak(utterance);
  }

  play() {
    this.#generation += 1;
    this.speechSynthesis.cancel();
    this.queue.play();
    this.#speakCurrent();
  }

  pause() {
    this.speechSynthesis.pause();
    this.queue.pause();
  }

  resume() {
    this.queue.resume();
    this.speechSynthesis.resume();
  }

  stop() {
    this.#generation += 1;
    this.speechSynthesis.cancel();
    this.queue.stop();
  }

  next() {
    const wasPlaying = this.queue.status === 'playing';
    this.#generation += 1;
    this.speechSynthesis.cancel();
    this.queue.next();

    if (wasPlaying && this.queue.status !== 'completed') {
      this.queue.play();
      this.#speakCurrent();
    }
  }

  previous() {
    const wasPlaying = this.queue.status === 'playing';
    this.#generation += 1;
    this.speechSynthesis.cancel();
    this.queue.previous();

    if (wasPlaying) {
      this.queue.play();
      this.#speakCurrent();
    }
  }
}
