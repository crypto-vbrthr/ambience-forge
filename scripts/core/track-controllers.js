import { chooseIndex } from "./random.js";
import { TRACK_TYPES } from "../constants.js";

class BaseTrackController {
  constructor({ track, backend, scheduler, masterVolume = 1 }) {
    this.track = track;
    this.backend = backend;
    this.scheduler = scheduler;
    this.masterVolume = Math.min(1, Math.max(0, Number(masterVolume) || 0));
    this.running = false;
    this.handles = new Set();
  }

  async start() {
    this.running = true;
  }

  async stop() {
    this.running = false;
    this.scheduler?.cancelAll?.();
    const handles = [...this.handles];
    this.handles.clear();
    await Promise.all(handles.map((handle) => this.backend.stop(handle, { fadeOutMs: this.track.fadeOutMs })));
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
    this.track.volume = Math.min(1, Math.max(0, Number(volume) || 0));
    await Promise.all([...this.handles].map((handle) => this.backend.setVolume(handle, this.effectiveVolume, { durationMs })));
  }

  async setMasterVolume(volume, { durationMs = 0 } = {}) {
    this.masterVolume = Math.min(1, Math.max(0, Number(volume) || 0));
    await Promise.all([...this.handles].map((handle) => this.backend.setVolume(handle, this.effectiveVolume, { durationMs })));
  }
}

export class AudioTrackController extends BaseTrackController {
  async start() {
    if (this.running) return;
    await super.start();
    if (!this.track.source) return;
    const handle = this.track.repeat
      ? await this.backend.startLoop({
          src: this.track.source,
          volume: this.effectiveVolume,
          fadeInMs: this.track.fadeInMs,
          loopStart: this.track.loopStart,
          loopEnd: this.track.loopEnd
        })
      : await this.backend.playOneShot({
          src: this.track.source,
          volume: this.effectiveVolume,
          fadeInMs: this.track.fadeInMs
        });
    if (!this.running) return this.discardHandle(handle);
    this.rememberHandle(handle);
  }
}

export class RandomTrackController extends BaseTrackController {
  constructor(options) {
    super(options);
    this.previousIndex = -1;
    this.timer = null;
  }

  async start() {
    if (this.running) return;
    await super.start();
    this.#scheduleNext();
  }

  async stop() {
    if (this.timer != null) this.scheduler.cancel(this.timer);
    this.timer = null;
    await super.stop();
  }

  #scheduleNext(extraDelay = 0) {
    if (!this.running || !this.track.sources.length) return;
    const delay = extraDelay + this.scheduler.delay(this.track.minDelayMs, this.track.maxDelayMs);
    this.timer = this.scheduler.schedule(delay, async () => {
      if (!this.running) return;
      let nextExtra = 0;
      try {
        const index = chooseIndex(this.track.sources.length, {
          previous: this.previousIndex,
          avoidImmediateRepeat: this.track.avoidImmediateRepeat,
          random: this.scheduler.random
        });
        this.previousIndex = index;
        const handle = await this.backend.playOneShot({ src: this.track.sources[index], volume: this.effectiveVolume });
        if (!this.running) return this.discardHandle(handle);
        this.rememberHandle(handle);
        nextExtra = this.track.allowOverlap ? 0 : handle.durationMs;
      } finally {
        if (this.running) this.#scheduleNext(nextExtra);
      }
    });
  }
}

export class SequenceTrackController extends BaseTrackController {
  constructor(options) {
    super(options);
    this.index = -1;
    this.timer = null;
  }

  async start() {
    if (this.running) return;
    await super.start();
    this.#scheduleNext(0, true);
  }

  async stop() {
    if (this.timer != null) this.scheduler.cancel(this.timer);
    this.timer = null;
    await super.stop();
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
    const gap = immediate ? 0 : this.scheduler.delay(this.track.minDelayMs, this.track.maxDelayMs);
    this.timer = this.scheduler.schedule(extraDelay + gap, async () => {
      if (!this.running) return;
      let durationMs = 0;
      try {
        this.index = this.#nextIndex();
        const handle = await this.backend.playOneShot({ src: this.track.sources[this.index], volume: this.effectiveVolume });
        if (!this.running) return this.discardHandle(handle);
        this.rememberHandle(handle);
        durationMs = handle.durationMs;
      } finally {
        if (this.running) this.#scheduleNext(durationMs, false);
      }
    });
  }
}

export class IntensityTrackController extends BaseTrackController {
  constructor(options) {
    super(options);
    this.handle = null;
    this.variantIndex = -1;
  }

  #indexForIntensity(intensity) {
    if (!this.track.variants.length) return -1;
    return Math.min(this.track.variants.length - 1, Math.round(intensity * (this.track.variants.length - 1)));
  }

  async start() {
    if (this.running) return;
    await super.start();
    const index = this.#indexForIntensity(this.track.intensity);
    if (index < 0) return;
    this.variantIndex = index;
    const handle = await this.backend.startLoop({
      src: this.track.variants[index].source,
      volume: this.effectiveVolume,
      fadeInMs: this.track.fadeInMs
    });
    if (!this.running) return this.discardHandle(handle);
    this.handle = this.rememberHandle(handle);
  }

  async stop() {
    this.handle = null;
    this.variantIndex = -1;
    await super.stop();
  }

  async setIntensity(intensity) {
    this.track.intensity = Math.min(1, Math.max(0, Number(intensity) || 0));
    const index = this.#indexForIntensity(this.track.intensity);
    if (!this.running || index < 0 || index === this.variantIndex) return;
    const previous = this.handle;
    const next = await this.backend.crossfade(previous, {
      src: this.track.variants[index].source,
      volume: this.effectiveVolume,
      durationMs: this.track.transitionMs
    });
    if (!this.running) return this.discardHandle(next);
    if (previous) this.handles.delete(previous);
    this.handle = this.rememberHandle(next);
    this.variantIndex = index;
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
