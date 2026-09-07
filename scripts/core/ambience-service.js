import { AmbienceRuntime } from "./ambience-runtime.js";
import { OwnerRegistry } from "./owner-registry.js";
import { TRACK_TYPES } from "../constants.js";
import { cloneData, normalizeAmbience, normalizeTrack, validateAmbience } from "../data/schema.js";

export class AmbienceService {
  constructor({ store, backend, schedulerFactory, moduleVersion = "0.0.0" }) {
    this.store = store;
    this.backend = backend;
    this.schedulerFactory = schedulerFactory;
    this.moduleVersion = moduleVersion;
    this.ambiences = new Map();
    this.runtimes = new Map();
    this.owners = new OwnerRegistry();
    this.previewHandle = null;
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

  async setTrackVolume(ambienceId, trackId, volume, options = {}) {
    return this.runtimes.get(ambienceId)?.setTrackVolume(trackId, volume, options) ?? false;
  }

  async setTrackIntensity(ambienceId, trackId, intensity) {
    return this.runtimes.get(ambienceId)?.setTrackIntensity(trackId, intensity) ?? false;
  }

  async previewLoop(input) {
    const track = normalizeTrack({ ...input, type: TRACK_TYPES.LOOP });
    if (!track.source) throw new Error("Loop preview source is required");
    await this.stopPreview();
    this.previewHandle = await this.backend.startLoop({
      src: track.source,
      volume: track.volume,
      fadeInMs: track.fadeInMs,
      loopStart: track.loopStart,
      loopEnd: track.loopEnd
    });
    return true;
  }

  async stopPreview() {
    if (!this.previewHandle) return false;
    const handle = this.previewHandle;
    this.previewHandle = null;
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
