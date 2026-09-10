import { RandomScheduler } from "./random-scheduler.js";
import { createTrackController } from "./track-controllers.js";
import {
  defaultStateSelections,
  findAmbienceState,
  findStateGroup,
  resolveTrackStates,
  selectionsByKey,
  transitionForState
} from "./state-resolver.js";

function clamp01(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

export class AmbienceRuntime {
  constructor({ ambience, backend, schedulerFactory = () => new RandomScheduler(), stateSelections = {} }) {
    this.ambience = ambience;
    this.backend = backend;
    this.schedulerFactory = schedulerFactory;
    this.controllers = new Map();
    this.masterVolume = clamp01(ambience.masterVolume ?? 1);
    this.liveTrackVolumes = new Map((ambience.tracks ?? []).map((track) => [track.id, clamp01(track.volume ?? 1)]));
    this.liveTrackActiveOverrides = new Map();
    this.stateSelections = defaultStateSelections(ambience, stateSelections);
    this.stateOwners = new Map();
    this.running = false;
  }

  #resolvedTracks() {
    return resolveTrackStates(this.ambience, {
      selections: this.stateSelections,
      liveVolumes: this.liveTrackVolumes,
      liveActiveOverrides: this.liveTrackActiveOverrides
    });
  }

  async start() {
    if (this.running) return;
    this.running = true;
    try {
      const resolved = this.#resolvedTracks();
      for (const track of this.ambience.tracks ?? []) {
        const controller = createTrackController({
          track: globalThis.structuredClone ? globalThis.structuredClone(track) : JSON.parse(JSON.stringify(track)),
          backend: this.backend,
          scheduler: this.schedulerFactory(track),
          masterVolume: this.masterVolume
        });
        const state = resolved.get(track.id);
        controller.track.volume = state?.volume ?? track.volume ?? 1;
        this.controllers.set(track.id, controller);
        if (state?.active) await controller.start();
      }
    } catch (error) {
      try { await this.stop(); } catch {}
      throw error;
    }
  }

  async stop() {
    if (!this.running) return;
    this.running = false;
    await Promise.all([...this.controllers.values()].map((controller) => controller.stop()));
    this.controllers.clear();
  }

  async setMasterVolume(volume, options = {}) {
    this.masterVolume = clamp01(volume);
    await Promise.all([...this.controllers.values()].map((controller) => controller.setMasterVolume(this.masterVolume, options)));
    return true;
  }

  async setTrackVolume(trackId, volume, options = {}) {
    if (!this.controllers.has(trackId)) return false;
    this.liveTrackVolumes.set(trackId, clamp01(volume));
    const target = this.#resolvedTracks().get(trackId)?.volume ?? clamp01(volume);
    await this.controllers.get(trackId).setVolume(target, options);
    return true;
  }

  getTrackVolumes() {
    return Object.fromEntries(this.liveTrackVolumes);
  }

  getResolvedTrackVolumes() {
    const resolved = this.#resolvedTracks();
    return Object.fromEntries([...resolved.entries()].map(([trackId, value]) => [trackId, value.volume]));
  }

  getTrackActiveStates() {
    return Object.fromEntries([...this.controllers.entries()]
      .map(([trackId, controller]) => [trackId, Boolean(controller.running)]));
  }

  getTrackRuntimeStatus(trackId) {
    const controller = this.controllers.get(trackId);
    return controller?.getRuntimeStatus?.() ?? null;
  }

  getRuntimeStatus() {
    return {
      running: Boolean(this.running),
      tracks: Object.fromEntries([...this.controllers.entries()]
        .map(([trackId, controller]) => [trackId, controller.getRuntimeStatus?.() ?? null]))
    };
  }

  async setTrackActive(trackId, active, options = {}) {
    const controller = this.controllers.get(trackId);
    if (!controller) return false;
    const desired = Boolean(active);
    this.liveTrackActiveOverrides.set(trackId, desired);
    if (controller.running === desired) return true;
    if (desired) {
      const target = this.#resolvedTracks().get(trackId)?.volume ?? this.liveTrackVolumes.get(trackId) ?? 1;
      controller.track.volume = target;
      try {
        await controller.start({ fadeInMs: options.durationMs ?? controller.track.fadeInMs });
      } catch (error) {
        try { await controller.stop({ fadeOutMs: 0 }); } catch {}
        throw error;
      }
    } else await controller.stop({ fadeOutMs: options.durationMs ?? controller.track.fadeOutMs });
    return true;
  }

  clearTrackLiveOverride(trackId) {
    return this.liveTrackActiveOverrides.delete(trackId);
  }

  getTrackIntensities() {
    return Object.fromEntries([...this.controllers.entries()]
      .filter(([, controller]) => typeof controller.setIntensity === "function")
      .map(([trackId, controller]) => [trackId, controller.track.intensity ?? 0]));
  }

  async setTrackIntensity(trackId, intensity) {
    const controller = this.controllers.get(trackId);
    if (!controller?.setIntensity) return false;
    await controller.setIntensity(intensity);
    return true;
  }

  getStateSelections() {
    return Object.fromEntries(this.stateSelections);
  }

  getStateSelectionsByKey() {
    return selectionsByKey(this.ambience, this.stateSelections);
  }

  getStateOwners() {
    const out = {};
    for (const group of this.ambience.stateGroups ?? []) {
      if (this.stateOwners.has(group.id)) out[group.key] = this.stateOwners.get(group.id);
    }
    return out;
  }

  async setState(groupRef, stateRef, { owner = null, durationMs = null } = {}) {
    const group = findStateGroup(this.ambience, groupRef);
    if (!group) throw new Error(`Unknown Ambience Forge state group: ${groupRef}`);
    const state = findAmbienceState(group, stateRef);
    if (!state) throw new Error(`Unknown Ambience Forge state: ${stateRef}`);
    this.stateSelections.set(group.id, state.id);
    if (owner) this.stateOwners.set(group.id, String(owner));
    const transitionMs = durationMs == null ? transitionForState(this.ambience, group, state) : Math.max(0, Number(durationMs) || 0);
    await this.#applyResolvedState(transitionMs);
    return state.key;
  }

  async clearState(groupRef, { owner = null, durationMs = null } = {}) {
    const group = findStateGroup(this.ambience, groupRef);
    if (!group) throw new Error(`Unknown Ambience Forge state group: ${groupRef}`);
    if (owner && this.stateOwners.has(group.id) && this.stateOwners.get(group.id) !== String(owner)) return false;
    this.stateSelections.set(group.id, null);
    this.stateOwners.delete(group.id);
    const transitionMs = durationMs == null ? Math.max(0, Number(group.transitionMs ?? this.ambience.transitionMs ?? 0) || 0) : Math.max(0, Number(durationMs) || 0);
    await this.#applyResolvedState(transitionMs);
    return true;
  }

  async #applyResolvedState(durationMs) {
    if (!this.running) return;
    const resolved = this.#resolvedTracks();
    for (const [trackId, controller] of this.controllers) {
      const target = resolved.get(trackId);
      if (!target) continue;
      if (target.active) {
        if (!controller.running) {
          controller.track.volume = target.volume;
          await controller.start({ fadeInMs: durationMs });
        } else await controller.setVolume(target.volume, { durationMs });
      } else if (controller.running) {
        await controller.stop({ fadeOutMs: durationMs });
      } else controller.track.volume = target.volume;
    }
  }
}
