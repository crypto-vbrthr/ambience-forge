import { AmbienceRuntime } from "./ambience-runtime.js";
import { OwnerRegistry } from "./owner-registry.js";
import { TRACK_TYPES } from "../constants.js";
import { chooseIndex } from "./random.js";
import { cloneData, normalizeAmbience, normalizeTrack, validateAmbience } from "../data/schema.js";

export class AmbienceService {
  constructor({ store, backend, schedulerFactory, moduleVersion = "0.0.0", random = Math.random }) {
    this.store = store;
    this.backend = backend;
    this.schedulerFactory = schedulerFactory;
    this.moduleVersion = moduleVersion;
    this.random = random;
    this.ambiences = new Map();
    this.runtimes = new Map();
    this.owners = new OwnerRegistry();
    this.previewHandle = null;
    this.previewRandomPreviousSource = null;
    this.previewSequencePreviousSource = null;
    this.previewIntensityTrack = null;
    this.previewIntensityIndex = -1;
  }

  async initialize() {
    const items = await this.store.loadAll();
    this.ambiences = new Map(items.map((item) => [item.id, normalizeAmbience(item)]));
  }

  getAmbiences() {
    return [...this.ambiences.values()].map(cloneData);
  }

  getAmbience(id) {
    return cloneData(this.ambiences.get(id) ?? null);
  }

  getState() {
    return {
      activeAmbienceIds: [...this.runtimes.keys()],
      masterVolumes: Object.fromEntries([...this.runtimes.entries()].map(([id, runtime]) => [id, runtime.masterVolume])),
      trackIntensities: Object.fromEntries([...this.runtimes.entries()].map(([id, runtime]) => [id, runtime.getTrackIntensities()])),
      owners: Object.fromEntries([...this.owners.ownersByKey.entries()].map(([key, owners]) => [key, [...owners]]))
    };
  }

  async upsertAmbience(input) {
    const ambience = normalizeAmbience(input);
    const errors = validateAmbience(ambience);
    if (errors.length) throw new Error(`Invalid ambience: ${errors.join(", ")}`);
    const wasRunning = this.runtimes.has(ambience.id);
    if (wasRunning) await this.stopAmbience(ambience.id);
    this.ambiences.set(ambience.id, ambience);
    await this.#persist();
    if (wasRunning) await this.playAmbience(ambience.id);
    return cloneData(ambience);
  }

  async deleteAmbience(id) {
    await this.stopAmbience(id);
    this.ambiences.delete(id);
    this.owners.clear(id);
    await this.#persist();
  }

  async playAmbience(id) {
    const ambience = this.ambiences.get(id);
    if (!ambience) throw new Error(`Unknown Ambience Forge ambience: ${id}`);
    if (this.runtimes.has(id)) return false;
    const runtime = new AmbienceRuntime({
      ambience: normalizeAmbience(ambience),
      backend: this.backend,
      schedulerFactory: this.schedulerFactory
    });
    this.runtimes.set(id, runtime);
    try {
      await runtime.start();
      return true;
    } catch (error) {
      this.runtimes.delete(id);
      throw error;
    }
  }

  async stopAmbience(id) {
    const runtime = this.runtimes.get(id);
    if (!runtime) return false;
    await runtime.stop();
    this.runtimes.delete(id);
    return true;
  }

  async requestAmbience(id, owner) {
    const result = this.owners.request(id, owner);
    if (result.wasEmpty) await this.playAmbience(id);
    return result.count;
  }

  async releaseAmbience(id, owner) {
    const result = this.owners.release(id, owner);
    if (result.becameEmpty) await this.stopAmbience(id);
    return result.count;
  }

  async setMasterVolume(ambienceId, volume, options = {}) {
    return this.runtimes.get(ambienceId)?.setMasterVolume(volume, options) ?? false;
  }

  async setTrackVolume(ambienceId, trackId, volume, options = {}) {
    return this.runtimes.get(ambienceId)?.setTrackVolume(trackId, volume, options) ?? false;
  }

  async setTrackIntensity(ambienceId, trackId, intensity) {
    return this.runtimes.get(ambienceId)?.setTrackIntensity(trackId, intensity) ?? false;
  }

  async previewAudio(input) {
    const track = normalizeTrack({ ...input, type: TRACK_TYPES.AUDIO });
    if (!track.source) throw new Error("Audio preview source is required");
    await this.stopPreview();
    this.previewHandle = track.repeat
      ? await this.backend.startLoop({
          src: track.source,
          volume: track.volume,
          fadeInMs: track.fadeInMs,
          loopStart: track.loopStart,
          loopEnd: track.loopEnd
        })
      : await this.backend.playOneShot({
          src: track.source,
          volume: track.volume,
          fadeInMs: track.fadeInMs
        });
    return true;
  }

  async previewLoop(input) {
    return this.previewAudio({ ...input, repeat: true });
  }

  async previewRandom(input) {
    const track = normalizeTrack({ ...input, type: TRACK_TYPES.RANDOM });
    if (!track.sources.length) throw new Error("Random preview sources are required");
    await this.stopPreview();
    const previous = this.previewRandomPreviousSource ? track.sources.indexOf(this.previewRandomPreviousSource) : -1;
    const index = chooseIndex(track.sources.length, {
      previous,
      avoidImmediateRepeat: track.avoidImmediateRepeat,
      random: this.random
    });
    this.previewRandomPreviousSource = track.sources[index];
    this.previewHandle = await this.backend.playOneShot({
      src: track.sources[index],
      volume: track.volume
    });
    return track.sources[index];
  }

  async previewSequence(input) {
    const track = normalizeTrack({ ...input, type: TRACK_TYPES.SEQUENCE });
    if (!track.sources.length) throw new Error("Sequence preview sources are required");
    await this.stopPreview();
    let index = 0;
    if (track.order === "random") {
      const previous = this.previewSequencePreviousSource ? track.sources.indexOf(this.previewSequencePreviousSource) : -1;
      index = chooseIndex(track.sources.length, {
        previous,
        avoidImmediateRepeat: track.avoidImmediateRepeat,
        random: this.random
      });
    }
    if (track.order === "random") this.previewSequencePreviousSource = track.sources[index];
    this.previewHandle = await this.backend.playOneShot({
      src: track.sources[index],
      volume: track.volume
    });
    return track.sources[index];
  }

  #intensityIndex(track, intensity) {
    if (!track.variants?.length) return -1;
    const value = Math.min(1, Math.max(0, Number(intensity) || 0));
    return Math.min(track.variants.length - 1, Math.round(value * (track.variants.length - 1)));
  }

  async previewIntensity(input) {
    const track = normalizeTrack({ ...input, type: TRACK_TYPES.INTENSITY });
    if (!track.variants.length) throw new Error("Intensity preview variants are required");
    await this.stopPreview();
    const index = this.#intensityIndex(track, track.intensity);
    this.previewIntensityTrack = track;
    this.previewIntensityIndex = index;
    this.previewHandle = await this.backend.startLoop({
      src: track.variants[index].source,
      volume: track.volume,
      fadeInMs: track.fadeInMs
    });
    return track.variants[index].source;
  }

  async setPreviewIntensity(intensity) {
    if (!this.previewHandle || !this.previewIntensityTrack) return false;
    const track = this.previewIntensityTrack;
    track.intensity = Math.min(1, Math.max(0, Number(intensity) || 0));
    const index = this.#intensityIndex(track, track.intensity);
    if (index < 0 || index === this.previewIntensityIndex) return true;
    const previous = this.previewHandle;
    const next = await this.backend.crossfade(previous, {
      src: track.variants[index].source,
      volume: track.volume,
      durationMs: track.transitionMs
    });
    this.previewHandle = next;
    this.previewIntensityIndex = index;
    return true;
  }

  async stopPreview() {
    if (!this.previewHandle) {
      this.previewIntensityTrack = null;
      this.previewIntensityIndex = -1;
      return false;
    }
    const handle = this.previewHandle;
    this.previewHandle = null;
    this.previewIntensityTrack = null;
    this.previewIntensityIndex = -1;
    await this.backend.stop(handle, { fadeOutMs: 150 });
    return true;
  }

  async stopAll() {
    await Promise.all([...this.runtimes.keys()].map((id) => this.stopAmbience(id)));
    await this.stopPreview();
    this.owners.clearAll();
  }

  async #persist() {
    await this.store.saveAll([...this.ambiences.values()]);
  }
}
