export function randomBetween(min, max, random = Math.random) {
  if (max <= min) return min;
  return min + (max - min) * random();
}

export function chooseIndex(length, { previous = -1, avoidImmediateRepeat = true, random = Math.random } = {}) {
  if (length <= 0) return -1;
  if (length === 1) return 0;
  let index = Math.min(length - 1, Math.floor(random() * length));
  if (avoidImmediateRepeat && index === previous) index = (index + 1) % length;
  return index;
}
