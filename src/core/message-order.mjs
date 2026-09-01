// src/core/message-order.mjs

function numericId(value) {
  const text = String(value ?? '');
  return /^\d+$/.test(text) ? BigInt(text) : null;
}

export function compareMessageOrder(left, right) {
  if (!left || !right) return null;

  const leftTimestamp = Number(left.timestamp);
  const rightTimestamp = Number(right.timestamp);
  const leftHasTimestamp = left.timestamp !== null
    && left.timestamp !== undefined
    && Number.isFinite(leftTimestamp);
  const rightHasTimestamp = right.timestamp !== null
    && right.timestamp !== undefined
    && Number.isFinite(rightTimestamp);

  if (
    leftHasTimestamp
    && rightHasTimestamp
    && leftTimestamp !== rightTimestamp
  ) {
    return leftTimestamp < rightTimestamp ? -1 : 1;
  }

  const leftId = numericId(left.id);
  const rightId = numericId(right.id);
  if (leftId !== null && rightId !== null && leftId !== rightId) {
    return leftId < rightId ? -1 : 1;
  }

  if (leftHasTimestamp && rightHasTimestamp) return 0;
  return null;
}

export function isMessageAfter(message, watermark, {
  unknownIsAfter = true,
} = {}) {
  if (!watermark) return true;
  const order = compareMessageOrder(message, watermark);
  return order === null ? Boolean(unknownIsAfter) : order > 0;
}

export function laterMessage(left, right) {
  if (!left) return right ?? null;
  if (!right) return left;
  const order = compareMessageOrder(left, right);
  return order === null || order <= 0 ? right : left;
}
