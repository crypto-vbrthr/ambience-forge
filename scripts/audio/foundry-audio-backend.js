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
 * Foundry-aware audio backend.
 *
 * Repeating ambience is decoded to an AudioBuffer and looped by one
 * AudioBufferSourceNode, avoiding Playlist restart gaps. One-shot and sequence
 * audio uses Foundry's Sound abstraction so long files may stream instead of
 * being decoded into memory in their entirety.
 */
export class FoundryAudioBackend extends AudioBackend {
  constructor({ audioHelper = game.audio, fetchFn = globalThis.fetch?.bind(globalThis) } = {}) {
    super();
    this.audioHelper = audioHelper;
    this.fetchFn = fetchFn;
    this.pendingBuffers = new Map();
    this.fallbackBufferCache = new Map();
    this.nextId = 1;
  }

  async #unlock() {
    await this.audioHelper.unlock;
  }

  get context() {
    return this.audioHelper.environment;
  }

  get destination() {
    // Foundry's three AudioContexts expose a master gainNode which is driven by
    // the Environment/Music/Interface volume controls. Fall back to the native
    // destination for test doubles and older-compatible contexts.
    return this.context?.gainNode ?? this.context?.destination;
  }

  #getCachedBuffer(src) {
    const cache = this.audioHelper?.buffers;
    if (typeof cache?.getBuffer === "function") return cache.getBuffer(src);
    if (typeof cache?.get === "function") return cache.get(src);
    return this.fallbackBufferCache.get(src);
  }

  #setCachedBuffer(src, buffer) {
    const cache = this.audioHelper?.buffers;
    if (typeof cache?.setBuffer === "function") cache.setBuffer(src, buffer);
    else if (typeof cache?.set === "function") cache.set(src, buffer);
    else this.fallbackBufferCache.set(src, buffer);
  }

  async #loadBuffer(src) {
    if (!src) throw new Error(localized("AMBIENCE_FORGE.Errors.AudioSourceRequired", {}, "Audio source is required"));
    const cached = this.#getCachedBuffer(src);
    if (cached) return cached;
    if (!this.fetchFn) throw new Error(localized("AMBIENCE_FORGE.Errors.FetchUnavailable", {}, "Fetch API is unavailable"));

    if (!this.pendingBuffers.has(src)) {
      this.pendingBuffers.set(src, (async () => {
        const response = await this.fetchFn(src, { credentials: "same-origin" });
        if (!response?.ok) throw new Error(localized(
          "AMBIENCE_FORGE.Errors.AudioLoadFailed",
          { status: response?.status ?? "?", source: src },
          `Ambience Forge could not load audio source (${response?.status ?? "network"}): ${src}`
        ));
        const bytes = await response.arrayBuffer();
        let buffer;
        try {
          // decodeAudioData can detach its input buffer in some browsers.
          buffer = await this.context.decodeAudioData(bytes.slice(0));
        } catch (error) {
          throw new Error(localized(
            "AMBIENCE_FORGE.Errors.AudioDecodeFailed",
            { source: src },
            `Ambience Forge could not decode audio source: ${src}`
          ), { cause: error });
        }
        this.#setCachedBuffer(src, buffer);
        return buffer;
      })().finally(() => this.pendingBuffers.delete(src)));
    }
    return this.pendingBuffers.get(src);
  }

  #createEndedHandle(base) {
    let resolveEnded;
    const ended = new Promise((resolve) => { resolveEnded = resolve; });
    return {
      id: this.nextId++,
      stopped: false,
      ended,
      _endedResolved: false,
      _resolveEnded: resolveEnded,
      ...base
    };
  }

  #finalize(handle) {
    if (!handle || handle._endedResolved) return;
    handle.stopped = true;
    handle._endedResolved = true;
    try { handle.sourceNode?.disconnect?.(); } catch {}
    try { handle.gainNode?.disconnect?.(); } catch {}
    handle._resolveEnded?.();
  }

  #createLoopHandle({ src, buffer, volume, fadeInMs = 0, loopStart = null, loopEnd = null }) {
    const context = this.context;
    const sourceNode = context.createBufferSource();
    const gainNode = context.createGain();
    sourceNode.buffer = buffer;
    sourceNode.loop = true;

    const start = normalizeLoopPoint(loopStart);
    const end = normalizeLoopPoint(loopEnd);
    if (start != null) sourceNode.loopStart = Math.min(start, buffer.duration);
    if (end != null && end > (start ?? 0)) sourceNode.loopEnd = Math.min(end, buffer.duration);

    sourceNode.connect(gainNode);
    gainNode.connect(this.destination);

    const targetVolume = clamp01(volume);
    const now = context.currentTime;
    const fadeSeconds = Math.max(0, Number(fadeInMs) || 0) / 1000;
    if (fadeSeconds > 0) {
      gainNode.gain.setValueAtTime(0, now);
      gainNode.gain.linearRampToValueAtTime(targetVolume, now + fadeSeconds);
    } else gainNode.gain.setValueAtTime(targetVolume, now);

    const handle = this.#createEndedHandle({
      kind: "loop",
      src,
      durationMs: Math.max(0, buffer.duration * 1000),
      sourceNode,
      gainNode
    });
    sourceNode.addEventListener?.("ended", () => this.#finalize(handle), { once: true });
    try {
      sourceNode.start(0);
    } catch (error) {
      this.#finalize(handle);
      throw error;
    }
    return handle;
  }

  async startLoop({ src, volume = 1, fadeInMs = 0, loopStart = null, loopEnd = null } = {}) {
    if (!src) throw new Error(localized("AMBIENCE_FORGE.Errors.AudioSourceRequired", {}, "Audio source is required"));
    await this.#unlock();
    const buffer = await this.#loadBuffer(src);
    return this.#createLoopHandle({ src, buffer, volume, fadeInMs, loopStart, loopEnd });
  }

  async playOneShot({ src, volume = 1, fadeInMs = 0 } = {}) {
    if (!src) throw new Error(localized("AMBIENCE_FORGE.Errors.AudioSourceRequired", {}, "Audio source is required"));
    await this.#unlock();
    if (typeof this.audioHelper?.create !== "function") {
      // Test/compatibility fallback. Normal Foundry V14 runtime always exposes create().
      const buffer = await this.#loadBuffer(src);
      const sourceNode = this.context.createBufferSource();
      const gainNode = this.context.createGain();
      sourceNode.buffer = buffer;
      sourceNode.loop = false;
      sourceNode.connect(gainNode);
      gainNode.connect(this.destination);
      const targetVolume = clamp01(volume);
      const now = this.context.currentTime;
      const fadeSeconds = Math.max(0, Number(fadeInMs) || 0) / 1000;
      gainNode.gain.setValueAtTime(fadeSeconds > 0 ? 0 : targetVolume, now);
      if (fadeSeconds > 0) gainNode.gain.linearRampToValueAtTime(targetVolume, now + fadeSeconds);
      const handle = this.#createEndedHandle({
        kind: "one-shot-buffer",
        src,
        durationMs: Math.max(0, buffer.duration * 1000),
        sourceNode,
        gainNode
      });
      sourceNode.addEventListener?.("ended", () => this.#finalize(handle), { once: true });
      sourceNode.start(0);
      return handle;
    }

    const sound = this.audioHelper.create({ src, context: this.context, singleton: false });
    await sound.load();
    const handle = this.#createEndedHandle({
      kind: "foundry-sound",
      src,
      sound,
      durationMs: Math.max(0, Number(sound.duration) * 1000 || 0),
      sourceNode: null,
      gainNode: null
    });
    try {
      await sound.play({
        volume: clamp01(volume),
        fade: Math.max(0, Number(fadeInMs) || 0),
        loop: false,
        onended: () => this.#finalize(handle)
      });
      return handle;
    } catch (error) {
      this.#finalize(handle);
      throw error;
    }
  }

  async stop(handle, { fadeOutMs = 0 } = {}) {
    if (!handle || handle.stopped) return;
    handle.stopped = true;

    if (handle.kind === "foundry-sound" && handle.sound) {
      try { await handle.sound.stop({ fade: Math.max(0, Number(fadeOutMs) || 0) }); } catch {}
      this.#finalize(handle);
      return;
    }

    if (!handle.sourceNode) {
      this.#finalize(handle);
      return;
    }
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
      try { handle.sourceNode.stop(now + fadeSeconds); } catch { this.#finalize(handle); }
      return;
    }
    try { handle.sourceNode.stop(now); } catch {}
    this.#finalize(handle);
  }

  async setVolume(handle, volume, { durationMs = 0 } = {}) {
    if (!handle || handle.stopped) return;
    const target = clamp01(volume);
    const duration = Math.max(0, Number(durationMs) || 0);

    if (handle.kind === "foundry-sound" && handle.sound) {
      await handle.sound.fade(target, { duration });
      return;
    }

    if (!handle.gainNode) return;
    const now = this.context.currentTime;
    const durationSeconds = duration / 1000;
    const gain = handle.gainNode.gain;
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
    try {
      await Promise.all([
        this.setVolume(next, volume, { durationMs }),
        handle ? this.setVolume(handle, 0, { durationMs }) : Promise.resolve()
      ]);
    } catch (error) {
      // A failed transition must not leave the newly-created loop running at
      // zero/partial volume in the background. The previous source remains the
      // controller's active handle and can be retried later.
      try { await this.stop(next, { fadeOutMs: 0 }); } catch {}
      throw error;
    }
    if (handle) {
      const stopDelay = Math.max(0, Number(durationMs) || 0);
      globalThis.setTimeout?.(() => { void this.stop(handle, { fadeOutMs: 0 }); }, stopDelay);
    }
    return next;
  }
}
