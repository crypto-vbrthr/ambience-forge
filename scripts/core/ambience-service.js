import { AmbienceRuntime } from "./ambience-runtime.js";
import { OwnerRegistry } from "./owner-registry.js";
import { TRACK_TYPES } from "../constants.js";
import { chooseIndex } from "./random.js";
import { cloneData, normalizeAmbience, normalizeTrack, validateAmbience } from "../data/schema.js";
import { exportAmbienceEnvelope, importAmbienceEnvelope } from "../data/export-import.js";
import { findAmbienceState, findStateGroup } from "./state-resolver.js";

export class AmbienceService {
  constructor({ store, backend, schedulerFactory, moduleVersion = "0.0.0", random = Math.random, onLibraryChanged = null }) {
    this.store = store;
    this.backend = backend;
    this.schedulerFactory = schedulerFactory;
    this.moduleVersion = moduleVersion;
    this.random = random;
    this.onLibraryChanged = onLibraryChanged;
    this.ambiences = new Map();
    this.revisions = new Map();
    this.runtimes = new Map();
    this.explicitPlayback = new Set();
    this.owners = new OwnerRegistry();
    this.desiredStates = new Map();
    this.stateRevisions = new Map();
    this.contextStates = new Map();
    this.previewHandle = null;
    this.previewRandomPreviousSource = null;
    this.previewSequencePreviousSource = null;
    this.previewIntensityTrack = null;
    this.previewIntensityIndex = -1;
  }

  async initialize() {
    const items = await this.store.loadAll();
    this.ambiences = new Map(items.map((item) => {
      const ambience = normalizeAmbience(item);
      return [ambience.id, ambience];
    }));
    this.revisions = new Map([...this.ambiences.keys()].map((id) => [id, 1]));
    this.stateRevisions = new Map([...this.ambiences.keys()].map((id) => [id, 0]));
  }

  getAmbienceRevision(id) {
    return this.revisions.get(id) ?? 0;
  }

  getAmbienceStateRevision(id) {
    return this.stateRevisions.get(id) ?? 0;
  }

  getDesiredStateSelections(id) {
    return cloneData(this.#desiredSelections(id));
  }

  async reloadFromStore() {
    const items = await this.store.loadAll();
    return this.syncLibrary(items);
  }

  async syncLibrary(items) {
    const next = new Map((items ?? []).map((item) => {
      const ambience = normalizeAmbience(item);
      return [ambience.id, ambience];
    }));
    const ids = new Set([...this.ambiences.keys(), ...next.keys()]);
    const changed = [...ids].filter((id) => JSON.stringify(this.ambiences.get(id) ?? null) !== JSON.stringify(next.get(id) ?? null));
    if (!changed.length) return false;

    const running = changed.filter((id) => this.runtimes.has(id));
    await Promise.all(running.map((id) => this.#stopRuntime(id)));
    for (const id of changed) {
      if (next.has(id)) this.revisions.set(id, (this.revisions.get(id) ?? 0) + 1);
      else {
        this.revisions.delete(id);
        this.explicitPlayback.delete(id);
        this.owners.clear(id);
        this.desiredStates.delete(id);
        this.stateRevisions.delete(id);
      }
    }
    this.ambiences = next;
    for (const id of running) if (this.ambiences.has(id)) await this.#startRuntime(id);
    await this.#notifyLibraryChanged(changed);
    return true;
  }

  async syncAmbienceDefinition(input) {
    const ambience = normalizeAmbience(input);
    const errors = validateAmbience(ambience);
    if (errors.length) throw new Error(`Invalid ambience: ${errors.join(", ")}`);
    const current = this.ambiences.get(ambience.id);
    if (JSON.stringify(current ?? null) === JSON.stringify(ambience)) return false;
    const wasRunning = this.runtimes.has(ambience.id);
    if (wasRunning) await this.#stopRuntime(ambience.id);
    this.ambiences.set(ambience.id, ambience);
    this.revisions.set(ambience.id, (this.revisions.get(ambience.id) ?? 0) + 1);
    if (!this.stateRevisions.has(ambience.id)) this.stateRevisions.set(ambience.id, 0);
    if (wasRunning) await this.#startRuntime(ambience.id);
    await this.#notifyLibraryChanged([ambience.id]);
    return true;
  }

  getAmbiences() {
    return [...this.ambiences.values()].map(cloneData);
  }

  getAmbience(id) {
    return cloneData(this.ambiences.get(id) ?? null);
  }

  getAmbiencesByKey(key) {
    const value = String(key ?? "").trim();
    if (!value) return [];
    return [...this.ambiences.values()]
      .filter((ambience) => ambience.key === value)
      .map(cloneData);
  }

  getActiveAmbienceIds() {
    return [...this.runtimes.keys()];
  }

  getCompatibleAmbienceIds(groupRef, stateRef = null, { ambienceIds = null } = {}) {
    const allowed = ambienceIds == null ? null : new Set([...ambienceIds].map(String));
    const ids = [];
    for (const ambience of this.ambiences.values()) {
      if (allowed && !allowed.has(ambience.id)) continue;
      const group = findStateGroup(ambience, groupRef);
      if (!group) continue;
      if (stateRef != null && stateRef !== "" && !findAmbienceState(group, stateRef)) continue;
      ids.push(ambience.id);
    }
    return ids;
  }

  getContextStates() {
    return cloneData(Object.fromEntries([...this.contextStates.entries()].map(([groupKey, entry]) => [groupKey, {
      state: entry.stateKey,
      owner: entry.owner ?? null
    }])));
  }

  async setContextState(groupRef, stateRef, { owner = null, durationMs = null } = {}) {
    const groupKey = String(groupRef ?? "").trim();
    const stateKey = String(stateRef ?? "").trim();
    if (!groupKey) throw new Error("Ambience Forge context state group is required");
    if (!stateKey) throw new Error("Ambience Forge context state is required");

    const current = this.contextStates.get(groupKey);
    const ownerKey = owner ? String(owner) : null;
    if (current?.owner && ownerKey && current.owner !== ownerKey) return false;

    this.contextStates.set(groupKey, { stateKey, owner: ownerKey });
    const compatible = this.getCompatibleAmbienceIds(groupKey, stateKey);
    for (const ambienceId of compatible) {
      await this.setState(ambienceId, groupKey, stateKey, { owner: ownerKey, durationMs, source: "context" });
    }
    return compatible;
  }

  async clearContextState(groupRef, { owner = null, durationMs = null } = {}) {
    const groupKey = String(groupRef ?? "").trim();
    if (!groupKey) throw new Error("Ambience Forge context state group is required");
    const current = this.contextStates.get(groupKey);
    if (!current) return [];
    const ownerKey = owner ? String(owner) : null;
    if (ownerKey != null && current.owner !== ownerKey) return false;

    this.contextStates.delete(groupKey);
    const compatible = this.getCompatibleAmbienceIds(groupKey, null);
    const cleared = [];
    for (const ambienceId of compatible) {
      const desired = this.desiredStates.get(ambienceId)?.get(groupKey);
      if (!desired || desired.source !== "context" || desired.owner !== current.owner || desired.stateKey !== current.stateKey) continue;
      const result = await this.clearState(ambienceId, groupKey, { owner: current.owner, durationMs });
      if (result !== false) cleared.push(ambienceId);
    }
    return cleared;
  }

  getStateCatalog({ ambienceIds = null } = {}) {
    const allowed = ambienceIds == null ? null : new Set([...ambienceIds].map(String));
    const compositions = [...this.ambiences.values()]
      .filter((ambience) => !allowed || allowed.has(ambience.id))
      .map((ambience) => ({
        id: ambience.id,
        key: ambience.key,
        name: ambience.name,
        groups: (ambience.stateGroups ?? []).map((group) => ({
          id: group.id,
          key: group.key,
          name: group.name,
          defaultStateId: group.defaultStateId ?? null,
          states: (group.states ?? []).map((state) => ({
            id: state.id,
            key: state.key,
            name: state.name
          }))
        }))
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
    return { compositions: cloneData(compositions) };
  }

  getTrackRuntimeStatus(ambienceId, trackId) {
    return cloneData(this.runtimes.get(ambienceId)?.getTrackRuntimeStatus(trackId) ?? null);
  }

  getRuntimeStatus(ambienceId = null) {
    if (ambienceId != null) {
      const runtime = this.runtimes.get(String(ambienceId));
      if (!runtime) return null;
      return cloneData({ ambienceId: String(ambienceId), ...runtime.getRuntimeStatus() });
    }
    return cloneData({
      ambiences: Object.fromEntries([...this.runtimes.entries()].map(([id, runtime]) => [id, {
        ambienceId: id,
        ...runtime.getRuntimeStatus()
      }]))
    });
  }

  getState() {
    return {
      activeAmbienceIds: [...this.runtimes.keys()],
      masterVolumes: Object.fromEntries([...this.runtimes.entries()].map(([id, runtime]) => [id, runtime.masterVolume])),
      trackVolumes: Object.fromEntries([...this.runtimes.entries()].map(([id, runtime]) => [id, runtime.getTrackVolumes()])),
      trackActiveStates: Object.fromEntries([...this.runtimes.entries()].map(([id, runtime]) => [id, runtime.getTrackActiveStates()])),
      trackIntensities: Object.fromEntries([...this.runtimes.entries()].map(([id, runtime]) => [id, runtime.getTrackIntensities()])),
      trackRuntimeStatuses: Object.fromEntries([...this.runtimes.entries()].map(([id, runtime]) => [id, runtime.getRuntimeStatus().tracks])),
      ambienceStates: Object.fromEntries([...this.runtimes.entries()].map(([id, runtime]) => [id, runtime.getStateSelectionsByKey()])),
      ambienceStateOwners: Object.fromEntries([...this.runtimes.entries()].map(([id, runtime]) => [id, runtime.getStateOwners()])),
      contextStates: this.getContextStates(),
      owners: Object.fromEntries([...this.owners.ownersByKey.entries()].map(([key, owners]) => [key, [...owners]]))
    };
  }

  async upsertAmbience(input) {
    const ambience = normalizeAmbience(input);
    const errors = validateAmbience(ambience);
    if (errors.length) throw new Error(`Invalid ambience: ${errors.join(", ")}`);
    const wasRunning = this.runtimes.has(ambience.id);
    if (wasRunning) await this.#stopRuntime(ambience.id);
    this.ambiences.set(ambience.id, ambience);
    this.revisions.set(ambience.id, (this.revisions.get(ambience.id) ?? 0) + 1);
    if (!this.stateRevisions.has(ambience.id)) this.stateRevisions.set(ambience.id, 0);
    await this.#persist();
    if (wasRunning) await this.#startRuntime(ambience.id);
    await this.#notifyLibraryChanged([ambience.id]);
    return cloneData(ambience);
  }

  async deleteAmbience(id) {
    this.explicitPlayback.delete(id);
    this.owners.clear(id);
    this.desiredStates.delete(id);
    this.stateRevisions.delete(id);
    await this.#stopRuntime(id);
    this.ambiences.delete(id);
    this.revisions.delete(id);
    await this.#persist();
    await this.#notifyLibraryChanged([id]);
  }

  exportAmbience(id) {
    const ambience = this.ambiences.get(id);
    if (!ambience) throw new Error(`Unknown Ambience Forge ambience: ${id}`);
    return exportAmbienceEnvelope(ambience, this.moduleVersion);
  }

  async importAmbience(envelope) {
    const ambience = importAmbienceEnvelope(envelope);
    return this.upsertAmbience(ambience);
  }

  async #startRuntime(id) {
    const ambience = this.ambiences.get(id);
    if (!ambience) throw new Error(`Unknown Ambience Forge ambience: ${id}`);
    if (this.runtimes.has(id)) return false;
    const contextSelections = this.#contextSelectionsForAmbience(ambience);
    const desired = this.#desiredMap(id);
    for (const [groupKey, stateKey] of Object.entries(contextSelections)) {
      if (!desired.has(groupKey)) {
        const context = this.contextStates.get(groupKey);
        desired.set(groupKey, {
          stateKey,
          owner: context?.owner ?? null,
          source: "context"
        });
      }
    }
    const explicitSelections = this.#desiredSelections(id);
    const runtime = new AmbienceRuntime({
      ambience: normalizeAmbience(ambience),
      backend: this.backend,
      schedulerFactory: this.schedulerFactory,
      stateSelections: { ...contextSelections, ...explicitSelections }
    });
    const desiredStateEntries = this.desiredStates.get(id);
    for (const group of runtime.ambience.stateGroups ?? []) {
      const entry = desiredStateEntries?.get(group.key) ?? this.contextStates.get(group.key);
      if (entry?.owner) runtime.stateOwners.set(group.id, entry.owner);
    }
    this.runtimes.set(id, runtime);
    try {
      await runtime.start();
      return true;
    } catch (error) {
      this.runtimes.delete(id);
      throw error;
    }
  }

  async #stopRuntime(id) {
    const runtime = this.runtimes.get(id);
    if (!runtime) return false;
    await runtime.stop();
    this.runtimes.delete(id);
    return true;
  }

  async playAmbience(id) {
    if (!this.ambiences.has(id)) throw new Error(`Unknown Ambience Forge ambience: ${id}`);
    const wasExplicit = this.explicitPlayback.has(id);
    this.explicitPlayback.add(id);
    try {
      return await this.#startRuntime(id);
    } catch (error) {
      if (!wasExplicit) this.explicitPlayback.delete(id);
      throw error;
    }
  }

  async stopAmbience(id) {
    // An explicit Stop is a GM/API override for this ambience. Clear owner
    // requests as well so the visible runtime state and ownership state cannot
    // diverge after a manual stop.
    this.explicitPlayback.delete(id);
    this.owners.clear(id);
    return this.#stopRuntime(id);
  }

  async requestAmbience(id, owner) {
    if (!this.ambiences.has(id)) throw new Error(`Unknown Ambience Forge ambience: ${id}`);
    const result = this.owners.request(id, owner);
    try {
      if (result.wasEmpty) await this.#startRuntime(id);
    } catch (error) {
      this.owners.release(id, owner);
      throw error;
    }
    return result.count;
  }

  async releaseAmbience(id, owner) {
    const result = this.owners.release(id, owner);
    if (result.becameEmpty && !this.explicitPlayback.has(id)) await this.#stopRuntime(id);
    return result.count;
  }

  async setMasterVolume(ambienceId, volume, options = {}) {
    return this.runtimes.get(ambienceId)?.setMasterVolume(volume, options) ?? false;
  }

  async setTrackVolume(ambienceId, trackId, volume, options = {}) {
    return this.runtimes.get(ambienceId)?.setTrackVolume(trackId, volume, options) ?? false;
  }

  async setTrackActive(ambienceId, trackId, active, options = {}) {
    return this.runtimes.get(ambienceId)?.setTrackActive(trackId, active, options) ?? false;
  }

  async setState(ambienceId, groupRef, stateRef, { owner = null, durationMs = null, source = "direct" } = {}) {
    const ambience = this.ambiences.get(ambienceId);
    if (!ambience) throw new Error(`Unknown Ambience Forge ambience: ${ambienceId}`);
    const group = findStateGroup(ambience, groupRef);
    if (!group) throw new Error(`Unknown Ambience Forge state group: ${groupRef}`);
    const state = findAmbienceState(group, stateRef);
    if (!state) throw new Error(`Unknown Ambience Forge state: ${stateRef}`);
    const desired = this.#desiredMap(ambienceId);
    desired.set(group.key, {
      stateKey: state.key,
      owner: owner == null || owner === "" ? null : String(owner),
      source: source === "context" ? "context" : "direct"
    });
    this.stateRevisions.set(ambienceId, (this.stateRevisions.get(ambienceId) ?? 0) + 1);
    const runtime = this.runtimes.get(ambienceId);
    if (runtime) await runtime.setState(group.key, state.key, { owner, durationMs });
    return state.key;
  }

  async clearState(ambienceId, groupRef, { owner = null, durationMs = null } = {}) {
    const ambience = this.ambiences.get(ambienceId);
    if (!ambience) throw new Error(`Unknown Ambience Forge ambience: ${ambienceId}`);
    const group = findStateGroup(ambience, groupRef);
    if (!group) throw new Error(`Unknown Ambience Forge state group: ${groupRef}`);
    const desired = this.#desiredMap(ambienceId);
    const current = desired.get(group.key);
    const ownerKey = owner == null || owner === "" ? null : String(owner);
    if (ownerKey != null && current?.owner !== ownerKey) return false;
    desired.set(group.key, { stateKey: null, owner: null, source: "direct" });
    this.stateRevisions.set(ambienceId, (this.stateRevisions.get(ambienceId) ?? 0) + 1);
    const runtime = this.runtimes.get(ambienceId);
    if (runtime) return runtime.clearState(group.key, { owner, durationMs });
    return true;
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
    this.explicitPlayback.clear();
    this.owners.clearAll();
    await Promise.all([...this.runtimes.keys()].map((id) => this.#stopRuntime(id)));
    await this.stopPreview();
  }

  #desiredMap(ambienceId) {
    if (!this.desiredStates.has(ambienceId)) this.desiredStates.set(ambienceId, new Map());
    return this.desiredStates.get(ambienceId);
  }

  #desiredSelections(ambienceId) {
    const desired = this.desiredStates.get(ambienceId);
    if (!desired) return {};
    return Object.fromEntries([...desired.entries()].map(([groupKey, entry]) => [groupKey, entry?.stateKey ?? null]));
  }

  #contextSelectionsForAmbience(ambience) {
    const selections = {};
    for (const [groupKey, entry] of this.contextStates) {
      const group = findStateGroup(ambience, groupKey);
      if (!group) continue;
      const state = findAmbienceState(group, entry?.stateKey);
      if (!state) continue;
      selections[group.key] = state.key;
    }
    return selections;
  }

  async #persist() {
    await this.store.saveAll([...this.ambiences.values()]);
  }

  async #notifyLibraryChanged(ids) {
    if (!this.onLibraryChanged) return;
    await this.onLibraryChanged([...ids]);
  }
}
