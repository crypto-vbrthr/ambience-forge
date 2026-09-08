import { randomBetween } from "./random.js";

export class RandomScheduler {
  constructor({
    random = Math.random,
    clock = globalThis,
    onError = (error) => console.error("ambience-forge | scheduled audio callback failed", error)
  } = {}) {
    this.random = random;
    this.clock = clock;
    this.onError = onError;
    this.handles = new Set();
  }

  delay(minMs, maxMs) {
    return Math.round(randomBetween(minMs, maxMs, this.random));
  }

  schedule(delayMs, callback) {
    const handle = this.clock.setTimeout(async () => {
      this.handles.delete(handle);
      try {
        await callback();
      } catch (error) {
        this.onError?.(error);
      }
    }, Math.max(0, delayMs));
    this.handles.add(handle);
    return handle;
  }

  cancel(handle) {
    if (handle == null) return;
    this.clock.clearTimeout(handle);
    this.handles.delete(handle);
  }

  cancelAll() {
    for (const handle of this.handles) this.clock.clearTimeout(handle);
    this.handles.clear();
  }
}
