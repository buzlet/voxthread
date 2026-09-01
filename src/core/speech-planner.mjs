import { prepareMessageForSpeech } from './content-policy.mjs';
// src/core/speech-planner.mjs

function authorKey(message) {
  if (message.outgoing) return 'self';
  if (message.authorId) return `id:${message.authorId}`;
  if (message.authorName) return `name:${message.authorName}`;
  return `unknown:${message.id}`;
}

function shouldSpeak(message) {
  return message
    && message.type === 'text'
    && Boolean(message.text?.trim());
}

function hasTerminalBoundary(text) {
  return /(?:[.!?…:;。！？؟؛।॥]|[)\]}>»”’"'`]|\p{Extended_Pictographic}|\p{Emoji_Modifier})$/u
    .test(String(text).trim());
}

function joinText(left, right) {
  if (!left) return right;
  if (!right) return left;
  return hasTerminalBoundary(left)
    ? `${left} ${right}`
    : `${left}. ${right}`;
}

export function planSpeech(messages, options = {}) {
  const {
    mergeAdjacent = true,
    announceAuthors = true,
    pauseAfterMs = 250,
    contentPolicy = {},
  } = options;

  const source = messages
    .map(message => prepareMessageForSpeech(message, contentPolicy))
    .filter(shouldSpeak);
  const segments = [];
  let previousAuthorKey = null;

  for (const message of source) {
    const key = authorKey(message);
    const previous = segments.at(-1);

    if (
      mergeAdjacent
      && previous
      && previous.authorKey === key
      && previous.chatId === message.chatId
    ) {
      previous.messageIds.push(message.id);
      previous.text = joinText(previous.text, message.text);
      continue;
    }

    const announceAuthor = Boolean(
      announceAuthors
      && message.authorName
      && key !== previousAuthorKey
    );

    segments.push({
      kind: 'speech',
      chatId: message.chatId,
      messageIds: [message.id],
      authorKey: key,
      authorId: message.authorId,
      authorName: message.authorName,
      outgoing: message.outgoing,
      announceAuthor,
      text: message.text,
      pauseAfterMs,
    });

    previousAuthorKey = key;
  }

  return segments;
}
