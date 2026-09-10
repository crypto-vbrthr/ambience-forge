import { chooseIndex } from "./random.js";
import { TRACK_TYPES } from "../constants.js";

function clamp01(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

function nonNegative(value) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, n) : 0;
}

function timedStatus({ now, startedAtMs = null, endsAtMs = null, durationMs = null, loop = false }) {
  const start = Number.isFinite(Number(startedAtMs)) ? Number(startedAtMs) : null;
  const duration = Number.isFinite(Number(durationMs)) ? Math.max(0, Number(durationMs)) : null;
  const end = Number.isFinite(Number(endsAtMs)) ? Number(endsAtMs) : (start != null && duration != null ? start + duration : null);

  if (start == null || duration == null || duration <= 0) {
    return {
      startedAtMs: start,
      endsAtMs: end,
      durationMs: duration,
      elapsedMs: null,
      remainingMs: end == null ? null : Math.max(0, end - now),
      progress: null
    };
  }

  if (loop) {
    const totalElapsed = Math.max(0, now - start);
    const elapsed = totalElapsed % duration;
    return {
      startedAtMs: start,
      endsAtMs: null,
      durationMs: duration,
      elapsedMs: elapsed,
      remainingMs: Math.max(0, duration - elapsed),
      progress: Math.min(1, Math.max(0, elapsed / duration))
    };
  }

  const elapsed = Math.min(duration, Math.max(0, now - start));
  return {
    startedAtMs: start,
    endsAtMs: end,
    durationMs: duration,
    elapsedMs: elapsed,
    remainingMs: end == null ? null : Math.max(0, end - now),
    progress: Math.min(1, Math.max(0, elapsed / duration))
  };
}

class BaseTrackController {
  constructor({ track, backend, scheduler, masterVolume = 1 }) {
    this.track = track;
    this.backend = backend;
    this.scheduler = scheduler;
    this.masterVolume = clamp01(masterVolume);
    this.running = false;
    this.handles = new Set();
  }

  nowMs() {
    if (typeof this.scheduler?.now === "function") return Number(this.scheduler.now()) || 0;
    return Date.now();
  }

  async start() {
    this.running = true;
  }

  async stop({ fadeOutMs = this.track.fadeOutMs } = {}) {
    this.running = false;
    this.scheduler?.cancelAll?.();
    const handles = [...this.handles];
    this.handles.clear();
    await Promise.all(handles.map((handle) => this.backend.stop(handle, { fadeOutMs })));
  }

  get effectiveVolume() {
    return this.track.volume * this.masterVolume;
  }

  rememberHandle(handle) {
    if (!handle) return handle;
    this.handles.add(handle);
    if (handle.ended?.finally) handle.ended.finally(() => this.handles.delete(handle));
    return handle;
  }

  async discardHandle(handle) {
    if (!handle) return;
    this.handles.delete(handle);
    await this.backend.stop(handle, { fadeOutMs: 0 });
  }

  async setVolume(volume, { durationMs = 0 } = {}) {
    this.track.volume = clamp01(volume);
    await Promise.all([...this.handles].map((handle) => this.backend.setVolume(handle, this.effectiveVolume, { durationMs })));
  }

  async setMasterVolume(volume, { durationMs = 0 } = {}) {
    this.masterVolume = clamp01(volume);
    await Promise.all([...this.handles].map((handle) => this.backend.setVolume(handle, this.effectiveVolume, { durationMs })));
  }

  getRuntimeStatus() {
    return {
      trackId: this.track.id,
      type: this.track.type,
      active: Boolean(this.running),
      phase: this.running ? "idle" : "stopped",
      source: null,
      startedAtMs: null,
      endsAtMs: null,
      durationMs: null,
      elapsedMs: null,
      remainingMs: null,
      progress: null,
      activeSounds: []
    };
  }
}

export class AudioTrackController extends BaseTrackController {
  constructor(options) {
    super(options);
    this.playback = null;
    this.finished = false;
  }

  async start({ fadeInMs = this.track.fadeInMs } = {}) {
    if (this.running) return;
    await super.start();
    this.finished = false;
    if (!this.track.source) return;
    const handle = this.track.repeat
      ? await this.backend.startLoop({
          src: this.track.source,
          volume: this.effectiveVolume,
          fadeInMs,
          loopStart: this.track.loopStart,
          loopEnd: this.track.loopEnd
        })
      : await this.backend.playOneShot({
          src: this.track.source,
          volume: this.effectiveVolume,
          fadeInMs
        });
    if (!this.running) return this.discardHandle(handle);
    this.rememberHandle(handle);
    const startedAtMs = this.nowMs();
    let durationMs = nonNegative(handle.durationMs);
    if (this.track.repeat && this.track.loopEnd != null) {
      const loopStart = nonNegative(this.track.loopStart ?? 0);
      const loopEnd = nonNegative(this.track.loopEnd);
      if (loopEnd > loopStart) durationMs = (loopEnd - loopStart) * 1000;
    }
    this.playback = {
      handle,
      source: this.track.source,
      startedAtMs,
      durationMs,
      endsAtMs: this.track.repeat ? null : startedAtMs + durationMs
    };
    handle.ended?.finally?.(() => {
      if (this.playback?.handle !== handle) return;
      this.playback = null;
      if (this.running && !this.track.repeat) this.finished = true;
    });
  }

  async stop(options = {}) {
    this.playback = null;
    this.finished = false;
    await super.stop(options);
  }

  getRuntimeStatus() {
    const base = super.getRuntimeStatus();
    if (!this.running) return base;
    if (!this.playback) return { ...base, phase: this.finished ? "finished" : "idle" };
    const now = this.nowMs();
    const timing = timedStatus({
      now,
      startedAtMs: this.playback.startedAtMs,
      endsAtMs: this.playback.endsAtMs,
      durationMs: this.playback.durationMs,
      loop: Boolean(this.track.repeat)
    });
    return {
      ...base,
      phase: "playing",
      source: this.playback.source,
      loop: Boolean(this.track.repeat),
      ...timing,
      activeSounds: [{ source: this.playback.source, ...timing }]
    };
  }
}

export class RandomTrackController extends BaseTrackController {
  constructor(options) {
    super(options);
    this.previousIndex = -1;
    this.timer = null;
    this.nextEvent = null;
    this.activePlays = new Map();
  }

  async start() {
    if (this.running) return;
    await super.start();
    this.#scheduleNext();
  }

  async stop(options = {}) {
    if (this.timer != null) this.scheduler.cancel(this.timer);
    this.timer = null;
    this.nextEvent = null;
    this.activePlays.clear();
    await super.stop(options);
  }

  #rememberPlay(handle, source) {
    const startedAtMs = this.nowMs();
    const durationMs = nonNegative(handle.durationMs);
    const play = { handle, source, startedAtMs, durationMs, endsAtMs: startedAtMs + durationMs };
    this.activePlays.set(handle, play);
    handle.ended?.finally?.(() => this.activePlays.delete(handle));
    return play;
  }

  #scheduleNext(extraDelay = 0) {
    if (!this.running || !this.track.sources.length) return;
    const soundDurationMs = nonNegative(extraDelay);
    const gapMs = this.scheduler.delay(this.track.minDelayMs, this.track.maxDelayMs);
    const now = this.nowMs();
    const delay = soundDurationMs + gapMs;
    this.nextEvent = {
      scheduledAtMs: now,
      waitStartsAtMs: now + soundDurationMs,
      endsAtMs: now + delay,
      durationMs: gapMs
    };
    this.timer = this.scheduler.schedule(delay, async () => {
      this.timer = null;
      this.nextEvent = null;
      if (!this.running) return;
      let nextExtra = 0;
      try {
        const index = chooseIndex(this.track.sources.length, {
          previous: this.previousIndex,
          avoidImmediateRepeat: this.track.avoidImmediateRepeat,
          random: this.scheduler.random
        });
        this.previousIndex = index;
        const source = this.track.sources[index];
        const handle = await this.backend.playOneShot({ src: source, volume: this.effectiveVolume });
        if (!this.running) return this.discardHandle(handle);
        this.rememberHandle(handle);
        this.#rememberPlay(handle, source);
        nextExtra = this.track.allowOverlap ? 0 : handle.durationMs;
      } finally {
        if (this.running) this.#scheduleNext(nextExtra);
      }
    });
  }

  getRuntimeStatus() {
    const base = super.getRuntimeStatus();
    if (!this.running) return base;
    const now = this.nowMs();
    const activeSounds = [...this.activePlays.values()].map((play) => ({
      source: play.source,
      ...timedStatus({ now, startedAtMs: play.startedAtMs, endsAtMs: play.endsAtMs, durationMs: play.durationMs })
    }));
    if (activeSounds.length) {
      const primary = activeSounds.at(-1);
      return {
        ...base,
        phase: "playing",
        source: primary.source,
        startedAtMs: primary.startedAtMs,
        endsAtMs: primary.endsAtMs,
        durationMs: primary.durationMs,
        elapsedMs: primary.elapsedMs,
        remainingMs: primary.remainingMs,
        progress: primary.progress,
        activeSounds,
        activeSoundCount: activeSounds.length,
        nextEventAtMs: this.nextEvent?.endsAtMs ?? null,
        nextEventInMs: this.nextEvent ? Math.max(0, this.nextEvent.endsAtMs - now) : null
      };
    }
    if (this.nextEvent) {
      const waitStarted = Math.max(this.nextEvent.waitStartsAtMs, Math.min(now, this.nextEvent.endsAtMs));
      const durationMs = Math.max(0, this.nextEvent.endsAtMs - this.nextEvent.waitStartsAtMs);
      const timing = timedStatus({ now, startedAtMs: this.nextEvent.waitStartsAtMs, endsAtMs: this.nextEvent.endsAtMs, durationMs });
      return {
        ...base,
        phase: "waiting",
        source: null,
        ...timing,
        // If the scheduled wait begins after a non-overlapping sound's expected
        // end, clamp display progress to zero until that pause actually starts.
        elapsedMs: now < this.nextEvent.waitStartsAtMs ? 0 : timing.elapsedMs,
        remainingMs: Math.max(0, this.nextEvent.endsAtMs - Math.max(now, waitStarted)),
        progress: now < this.nextEvent.waitStartsAtMs ? 0 : timing.progress,
        nextEventAtMs: this.nextEvent.endsAtMs,
        nextEventInMs: Math.max(0, this.nextEvent.endsAtMs - now),
        activeSoundCount: 0
      };
    }
    return { ...base, phase: "idle", activeSoundCount: 0 };
  }
}

export class SequenceTrackController extends BaseTrackController {
  constructor(options) {
    super(options);
    this.index = -1;
    this.timer = null;
    this.nextEvent = null;
    this.currentPlay = null;
  }

  async start() {
    if (this.running) return;
    await super.start();
    this.#scheduleNext(0, true);
  }

  async stop(options = {}) {
    if (this.timer != null) this.scheduler.cancel(this.timer);
    this.timer = null;
    this.nextEvent = null;
    this.currentPlay = null;
    await super.stop(options);
  }

  #nextIndex() {
    if (this.track.order === "random") {
      return chooseIndex(this.track.sources.length, {
        previous: this.index,
        avoidImmediateRepeat: this.track.avoidImmediateRepeat,
        random: this.scheduler.random
      });
    }
    return (this.index + 1) % this.track.sources.length;
  }

  #scheduleNext(extraDelay = 0, immediate = false) {
    if (!this.running || !this.track.sources.length) return;
    const soundDurationMs = nonNegative(extraDelay);
    const gapMs = immediate ? 0 : this.scheduler.delay(this.track.minDelayMs, this.track.maxDelayMs);
    const now = this.nowMs();
    const delay = soundDurationMs + gapMs;
    this.nextEvent = {
      scheduledAtMs: now,
      waitStartsAtMs: now + soundDurationMs,
      endsAtMs: now + delay,
      durationMs: gapMs
    };
    this.timer = this.scheduler.schedule(delay, async () => {
      this.timer = null;
      this.nextEvent = null;
      if (!this.running) return;
      let durationMs = 0;
      try {
        this.index = this.#nextIndex();
        const source = this.track.sources[this.index];
        const handle = await this.backend.playOneShot({ src: source, volume: this.effectiveVolume });
        if (!this.running) return this.discardHandle(handle);
        this.rememberHandle(handle);
        const startedAtMs = this.nowMs();
        durationMs = nonNegative(handle.durationMs);
        this.currentPlay = { handle, source, startedAtMs, durationMs, endsAtMs: startedAtMs + durationMs };
        handle.ended?.finally?.(() => {
          if (this.currentPlay?.handle === handle) this.currentPlay = null;
        });
      } finally {
        if (this.running) this.#scheduleNext(durationMs, false);
      }
    });
  }

  getRuntimeStatus() {
    const base = super.getRuntimeStatus();
    const sequence = {
      sequenceIndex: this.index,
      sequencePosition: this.index >= 0 ? this.index + 1 : null,
      sequenceLength: this.track.sources.length
    };
    if (!this.running) return { ...base, ...sequence };
    const now = this.nowMs();
    if (this.currentPlay) {
      const timing = timedStatus({
        now,
        startedAtMs: this.currentPlay.startedAtMs,
        endsAtMs: this.currentPlay.endsAtMs,
        durationMs: this.currentPlay.durationMs
      });
      return {
        ...base,
        ...sequence,
        phase: "playing",
        source: this.currentPlay.source,
        ...timing,
        activeSounds: [{ source: this.currentPlay.source, ...timing }],
        nextEventAtMs: this.nextEvent?.endsAtMs ?? null,
        nextEventInMs: this.nextEvent ? Math.max(0, this.nextEvent.endsAtMs - now) : null
      };
    }
    if (this.nextEvent) {
      const durationMs = Math.max(0, this.nextEvent.endsAtMs - this.nextEvent.waitStartsAtMs);
      const timing = timedStatus({ now, startedAtMs: this.nextEvent.waitStartsAtMs, endsAtMs: this.nextEvent.endsAtMs, durationMs });
      return {
        ...base,
        ...sequence,
        phase: "waiting",
        ...timing,
        elapsedMs: now < this.nextEvent.waitStartsAtMs ? 0 : timing.elapsedMs,
        progress: now < this.nextEvent.waitStartsAtMs ? 0 : timing.progress,
        nextEventAtMs: this.nextEvent.endsAtMs,
        nextEventInMs: Math.max(0, this.nextEvent.endsAtMs - now)
      };
    }
    return { ...base, ...sequence, phase: "idle" };
  }
}

export class IntensityTrackController extends BaseTrackController {
  constructor(options) {
    super(options);
    this.handle = null;
    this.variantIndex = -1;
    this.playback = null;
    this.transition = null;
  }

  #indexForIntensity(intensity) {
    if (!this.track.variants.length) return -1;
    return Math.min(this.track.variants.length - 1, Math.round(intensity * (this.track.variants.length - 1)));
  }

  #variantDetails(index) {
    const variant = this.track.variants[index];
    return variant ? { variantIndex: index, variantName: variant.name || "", source: variant.source } : null;
  }

  async start({ fadeInMs = this.track.fadeInMs } = {}) {
    if (this.running) return;
    await super.start();
    const index = this.#indexForIntensity(this.track.intensity);
    if (index < 0) return;
    this.variantIndex = index;
    const variant = this.track.variants[index];
    const handle = await this.backend.startLoop({
      src: variant.source,
      volume: this.effectiveVolume,
      fadeInMs
    });
    if (!this.running) return this.discardHandle(handle);
    this.handle = this.rememberHandle(handle);
    this.playback = {
      handle,
      source: variant.source,
      startedAtMs: this.nowMs(),
      durationMs: nonNegative(handle.durationMs)
    };
  }

  async stop(options = {}) {
    this.handle = null;
    this.variantIndex = -1;
    this.playback = null;
    this.transition = null;
    await super.stop(options);
  }

  async setIntensity(intensity) {
    this.track.intensity = clamp01(intensity);
    const index = this.#indexForIntensity(this.track.intensity);
    if (!this.running || index < 0 || index === this.variantIndex) return;
    const previous = this.handle;
    const previousDetails = this.#variantDetails(this.variantIndex);
    const nextDetails = this.#variantDetails(index);
    const startedAtMs = this.nowMs();
    const durationMs = nonNegative(this.track.transitionMs);
    this.transition = {
      fromSource: previousDetails?.source ?? null,
      toSource: nextDetails?.source ?? null,
      fromVariantIndex: previousDetails?.variantIndex ?? null,
      toVariantIndex: nextDetails?.variantIndex ?? null,
      startedAtMs,
      endsAtMs: startedAtMs + durationMs,
      durationMs
    };
    let next;
    try {
      next = await this.backend.crossfade(previous, {
        src: this.track.variants[index].source,
        volume: this.effectiveVolume,
        durationMs: this.track.transitionMs
      });
    } catch (error) {
      this.transition = null;
      throw error;
    }
    if (!this.running) {
      this.transition = null;
      return this.discardHandle(next);
    }
    if (previous) this.handles.delete(previous);
    this.handle = this.rememberHandle(next);
    this.variantIndex = index;
    this.playback = {
      handle: next,
      source: nextDetails.source,
      startedAtMs,
      durationMs: nonNegative(next.durationMs)
    };
  }

  getRuntimeStatus() {
    const base = super.getRuntimeStatus();
    const now = this.nowMs();
    const variant = this.#variantDetails(this.variantIndex);
    const intensityData = {
      intensity: this.track.intensity ?? 0,
      variantIndex: variant?.variantIndex ?? null,
      variantPosition: variant ? variant.variantIndex + 1 : null,
      variantCount: this.track.variants.length,
      variantName: variant?.variantName ?? ""
    };
    if (!this.running) return { ...base, ...intensityData };

    if (this.transition && now < this.transition.endsAtMs) {
      const timing = timedStatus({
        now,
        startedAtMs: this.transition.startedAtMs,
        endsAtMs: this.transition.endsAtMs,
        durationMs: this.transition.durationMs
      });
      return {
        ...base,
        ...intensityData,
        phase: "crossfading",
        source: this.transition.toSource,
        ...timing,
        transition: {
          fromSource: this.transition.fromSource,
          toSource: this.transition.toSource,
          fromVariantIndex: this.transition.fromVariantIndex,
          toVariantIndex: this.transition.toVariantIndex,
          ...timing
        }
      };
    }
    if (this.transition && now >= this.transition.endsAtMs) this.transition = null;
    if (!this.playback) return { ...base, ...intensityData, phase: "idle" };
    const timing = timedStatus({
      now,
      startedAtMs: this.playback.startedAtMs,
      durationMs: this.playback.durationMs,
      loop: true
    });
    return {
      ...base,
      ...intensityData,
      phase: "playing",
      source: this.playback.source,
      loop: true,
      ...timing,
      activeSounds: [{ source: this.playback.source, ...timing }]
    };
  }
}

export function createTrackController({ track, backend, scheduler, masterVolume = 1 }) {
  switch (track.type) {
    case TRACK_TYPES.AUDIO:
      return new AudioTrackController({ track, backend, scheduler, masterVolume });
    case TRACK_TYPES.RANDOM:
      return new RandomTrackController({ track, backend, scheduler, masterVolume });
    case TRACK_TYPES.SEQUENCE:
      return new SequenceTrackController({ track, backend, scheduler, masterVolume });
    case TRACK_TYPES.INTENSITY:
      return new IntensityTrackController({ track, backend, scheduler, masterVolume });
    default:
      throw new Error(`Unsupported Ambience Forge track type: ${track.type}`);
  }
}
