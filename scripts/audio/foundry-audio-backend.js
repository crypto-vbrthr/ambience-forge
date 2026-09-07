import { AudioBackend } from "./audio-backend.js";

function clamp01(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}


function localized(key, data, fallback) {
  try {
    const i18n = globalThis.game?.i18n;
    if (i18n?.format) return i18n.format(key, data);
    if (i18n?.localize) return i18n.localize(key);
  } catch {}
  return fallback;
}

function normalizeLoopPoint(value) {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/**
 * A small direct Web Audio backend. We intentionally do not use Foundry playlists
 * or Foundry's streamed Sound path for repeating tracks. Looping therefore stays
 * inside one decoded AudioBufferSourceNode and does not incur playlist restart gaps.
 */
export class FoundryAudioBackend extends AudioBackend {
  constructor({ audioHelper = game.audio, fetchFn = globalThis.fetch?.bind(globalThis) } = {}) {
    super();
    this.audioHelper = audioHelper;
    this.fetchFn = fetchFn;
    this.bufferCache = new Map();
    this.nextId = 1;
  }

  async #unlock() {
    await this.audioHelper.unlock;
  }

  get context() {
    return this.audioHelper.environment;
  }

  async #loadBuffer(src) {
    if (!src) throw new Error(localized("AMBIENCE_FORGE.Errors.AudioSourceRequired", {}, "Audio source is required"));
    if (!this.fetchFn) throw new Error(localized("AMBIENCE_FORGE.Errors.FetchUnavailable", {}, "Fetch API is unavailable"));
    if (!this.bufferCache.has(src)) {
      this.bufferCache.set(src, (async () => {
        const response = await this.fetchFn(src, { credentials: "same-origin" });
        if (!response?.ok) throw new Error(localized(
          "AMBIENCE_FORGE.Errors.AudioLoadFailed",
          { status: response?.status ?? "?", source: src },
          `Ambience Forge could not load audio source (${response?.status ?? "network"}): ${src}`
        ));
        const bytes = await response.arrayBuffer();
        try {
          // decodeAudioData can detach its input buffer in some browsers, so hand it
          // an isolated copy rather than a shared ArrayBuffer.
          return await this.context.decodeAudioData(bytes.slice(0));
        } catch (error) {
          throw new Error(localized(
            "AMBIENCE_FORGE.Errors.AudioDecodeFailed",
            { source: src },
            `Ambience Forge could not decode audio source: ${src}`
          ), { cause: error });
        }
      })().catch((error) => {
        this.bufferCache.delete(src);
        throw error;
      }));
    }
    return this.bufferCache.get(src);
  }

  #createHandle({ src, buffer, loop, volume, fadeInMs = 0, loopStart = null, loopEnd = null }) {
    const context = this.context;
    const sourceNode = context.createBufferSource();
    const gainNode = context.createGain();
    sourceNode.buffer = buffer;
    sourceNode.loop = Boolean(loop);

    if (sourceNode.loop) {
      const start = normalizeLoopPoint(loopStart);
      const end = normalizeLoopPoint(loopEnd);
      if (start != null) sourceNode.loopStart = Math.min(start, buffer.duration);
      if (end != null && end > (start ?? 0)) sourceNode.loopEnd = Math.min(end, buffer.duration);
    }

    sourceNode.connect(gainNode);
    gainNode.connect(context.destination);

    const targetVolume = clamp01(volume);
    const now = context.currentTime;
    const fadeSeconds = Math.max(0, Number(fadeInMs) || 0) / 1000;
    if (fadeSeconds > 0) {
      gainNode.gain.setValueAtTime(0, now);
      gainNode.gain.linearRampToValueAtTime(targetVolume, now + fadeSeconds);
    } else {
      gainNode.gain.setValueAtTime(targetVolume, now);
    }

    const handle = {
      id: this.nextId++,
      kind: loop ? "loop" : "one-shot",
      src,
      durationMs: Math.max(0, buffer.duration * 1000),
      sourceNode,
      gainNode,
      stopped: false
    };

    sourceNode.addEventListener?.("ended", () => this.#disconnect(handle), { once: true });
    sourceNode.start(0);
    return handle;
  }

  async startLoop({ src, volume = 1, fadeInMs = 0, loopStart = null, loopEnd = null } = {}) {
    if (!src) throw new Error(localized("AMBIENCE_FORGE.Errors.AudioSourceRequired", {}, "Audio source is required"));
    await this.#unlock();
    const buffer = await this.#loadBuffer(src);
    return this.#createHandle({ src, buffer, loop: true, volume, fadeInMs, loopStart, loopEnd });
  }

  async playOneShot({ src, volume = 1, fadeInMs = 0 } = {}) {
    if (!src) throw new Error(localized("AMBIENCE_FORGE.Errors.AudioSourceRequired", {}, "Audio source is required"));
    await this.#unlock();
    const buffer = await this.#loadBuffer(src);
    return this.#createHandle({ src, buffer, loop: false, volume, fadeInMs });
  }

  async stop(handle, { fadeOutMs = 0 } = {}) {
    if (!handle?.sourceNode || handle.stopped) return;
    handle.stopped = true;
    const context = this.context;
    const now = context.currentTime;
    const fadeSeconds = Math.max(0, Number(fadeOutMs) || 0) / 1000;
    const gain = handle.gainNode?.gain;

    if (gain && fadeSeconds > 0) {
      if (typeof gain.cancelAndHoldAtTime === "function") gain.cancelAndHoldAtTime(now);
      else {
        gain.cancelScheduledValues?.(now);
        gain.setValueAtTime?.(gain.value, now);
      }
      gain.linearRampToValueAtTime(0, now + fadeSeconds);
      try { handle.sourceNode.stop(now + fadeSeconds); } catch {}
      return;
    }

    try { handle.sourceNode.stop(now); } catch {}
    this.#disconnect(handle);
  }

  async setVolume(handle, volume, { durationMs = 0 } = {}) {
    if (!handle?.gainNode || handle.stopped) return;
    const context = this.context;
    const now = context.currentTime;
    const durationSeconds = Math.max(0, Number(durationMs) || 0) / 1000;
    const gain = handle.gainNode.gain;
    const target = clamp01(volume);
    if (typeof gain.cancelAndHoldAtTime === "function") gain.cancelAndHoldAtTime(now);
    else {
      gain.cancelScheduledValues?.(now);
      gain.setValueAtTime?.(gain.value, now);
    }
    if (durationSeconds > 0) gain.linearRampToValueAtTime(target, now + durationSeconds);
    else gain.setValueAtTime(target, now);
  }

  async crossfade(handle, { src, volume = 1, durationMs = 3000, loopStart = null, loopEnd = null } = {}) {
    const next = await this.startLoop({ src, volume: 0, fadeInMs: 0, loopStart, loopEnd });
    await Promise.all([
      this.setVolume(next, volume, { durationMs }),
      handle ? this.setVolume(handle, 0, { durationMs }) : Promise.resolve()
    ]);
    if (handle) {
      const stopDelay = Math.max(0, Number(durationMs) || 0);
      globalThis.setTimeout?.(() => { void this.stop(handle, { fadeOutMs: 0 }); }, stopDelay);
    }
    return next;
  }

  #disconnect(handle) {
    if (!handle) return;
    try { handle.sourceNode?.disconnect?.(); } catch {}
    try { handle.gainNode?.disconnect?.(); } catch {}
  }
}
