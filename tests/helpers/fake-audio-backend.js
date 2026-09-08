import { AudioBackend } from "../../scripts/audio/audio-backend.js";

export class FakeAudioBackend extends AudioBackend {
  constructor({ durations = {} } = {}) {
    super();
    this.durations = durations;
    this.events = [];
    this.nextId = 1;
  }

  async startLoop(options) {
    const handle = this.#handle("loop", options.src);
    this.events.push({ type: "startLoop", handle, options: { ...options } });
    return handle;
  }

  async playOneShot(options) {
    const handle = this.#handle("one-shot", options.src);
    this.events.push({ type: "playOneShot", handle, options: { ...options } });
    return handle;
  }

  async stop(handle, options = {}) {
    this.events.push({ type: "stop", handle, options: { ...options } });
    this.finish(handle);
  }

  async setVolume(handle, volume, options = {}) {
    this.events.push({ type: "setVolume", handle, volume, options: { ...options } });
  }

  async crossfade(handle, options) {
    const next = this.#handle("loop", options.src);
    this.events.push({ type: "crossfade", from: handle, to: next, options: { ...options } });
    return next;
  }

  finish(handle) {
    if (!handle || handle._ended) return;
    handle._ended = true;
    handle._resolveEnded?.();
  }

  #handle(kind, src) {
    let resolveEnded;
    const ended = new Promise((resolve) => { resolveEnded = resolve; });
    return {
      id: this.nextId++,
      kind,
      src,
      durationMs: this.durations[src] ?? 1000,
      ended,
      _resolveEnded: resolveEnded,
      _ended: false
    };
  }
}
