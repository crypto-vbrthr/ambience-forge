import { AmbienceRuntime } from "./ambience-runtime.js";
import { OwnerRegistry } from "./owner-registry.js";
import { cloneData, normalizeAmbience, validateAmbience } from "../data/schema.js";

export class AmbienceService {
  constructor({ store, backend, schedulerFactory, moduleVersion = "0.0.0" }) {
    this.store = store;
    this.backend = backend;
    this.schedulerFactory = schedulerFactory;
    this.moduleVersion = moduleVersion;
    this.ambiences = new Map();
    this.runtimes = new Map();
    this.owners = new OwnerRegistry();
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
    this.ambiences.set(ambience.id, ambience);
    await this.#persist();
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

  async stopAll() {
    await Promise.all([...this.runtimes.keys()].map((id) => this.stopAmbience(id)));
    this.owners.clearAll();
  }

  async #persist() {
    await this.store.saveAll([...this.ambiences.values()]);
  }
}
