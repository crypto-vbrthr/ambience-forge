import { API_VERSION } from "../constants.js";
import { COMMANDS, executeSynchronized } from "../socket.js";

export function createPublicApi({ getService, getEmitterService = () => null, getModuleVersion }) {
  const service = () => {
    const value = getService();
    if (!value) throw new Error("Ambience Forge is not ready yet");
    return value;
  };

  const emitterService = () => {
    const value = getEmitterService();
    if (!value) throw new Error("Ambience Forge scene emitters are not ready yet");
    return value;
  };

  const activeCandidateIds = () => {
    const ids = new Set(service().getActiveAmbienceIds?.() ?? service().getState().activeAmbienceIds ?? []);
    const emitters = getEmitterService()?.getEmitters?.() ?? [];
    for (const emitter of emitters) {
      if (emitter?.enabled === false || !emitter?.ambienceId) continue;
      ids.add(String(emitter.ambienceId));
    }
    return [...ids];
  };

  const applyStateToIds = async (ids, group, state, { owner = null, durationMs = null, broadcast = true } = {}) => {
    const value = service();
    const compatible = value.getCompatibleAmbienceIds(group, state, { ambienceIds: ids });
    for (const ambienceId of compatible) {
      await executeSynchronized(value, {
        command: COMMANDS.STATE,
        ambienceId,
        ambience: value.getAmbience(ambienceId),
        group,
        state,
        owner,
        durationMs
      }, { broadcast });
    }
    return compatible;
  };

  const clearStateForIds = async (ids, group, { owner = null, durationMs = null, broadcast = true } = {}) => {
    const value = service();
    const compatible = value.getCompatibleAmbienceIds(group, null, { ambienceIds: ids });
    const cleared = [];
    for (const ambienceId of compatible) {
      const result = await executeSynchronized(value, {
        command: COMMANDS.CLEAR_STATE,
        ambienceId,
        ambience: value.getAmbience(ambienceId),
        group,
        owner,
        durationMs
      }, { broadcast });
      if (result !== false) cleared.push(ambienceId);
    }
    return cleared;
  };

  return Object.freeze({
    version: API_VERSION,
    capabilities: Object.freeze([
      "ambience-v1",
      "tracks-v1",
      "owner-requests-v1",
      "intensity-v1",
      "synchronized-playback-v1",
      "audio-preview-v1",
      "loop-preview-v1",
      "random-preview-v1",
      "sequence-preview-v1",
      "intensity-preview-v1",
      "master-volume-v1",
      "track-live-control-v1",
      "scene-emitters-v1",
      "scene-emitter-markers-v1",
      "scene-emitter-obstruction-v1",
      "import-export-v1",
      "states-v1",
      "state-discovery-v1",
      "semantic-state-control-v1",
      "context-states-v1"
    ]),

    isReady: () => Boolean(getService()),
    getModuleVersion: () => getModuleVersion(),
    getAmbiences: () => service().getAmbiences(),
    getAmbience: (id) => service().getAmbience(id),
    getAmbiencesByKey: (key) => service().getAmbiencesByKey(key),
    getStateCatalog: () => service().getStateCatalog(),
    getContextStates: () => service().getContextStates(),
    getState: () => service().getState(),
    upsertAmbience: (ambience) => service().upsertAmbience(ambience),
    deleteAmbience: (id) => service().deleteAmbience(id),
    exportAmbience: (id) => service().exportAmbience(id),
    importAmbience: (envelope) => service().importAmbience(envelope),

    playAmbience: (ambienceId, options = {}) => {
      const value = service();
      return executeSynchronized(value, {
        command: COMMANDS.PLAY,
        ambienceId,
        ambience: value.getAmbience(ambienceId)
      }, options);
    },

    stopAmbience: (ambienceId, options = {}) => executeSynchronized(service(), {
      command: COMMANDS.STOP,
      ambienceId
    }, options),

    requestAmbience: (ambienceId, { owner, broadcast = true } = {}) => {
      const value = service();
      return executeSynchronized(value, {
        command: COMMANDS.REQUEST,
        ambienceId,
        ambience: value.getAmbience(ambienceId),
        owner
      }, { broadcast });
    },

    releaseAmbience: (ambienceId, { owner, broadcast = true } = {}) => executeSynchronized(service(), {
      command: COMMANDS.RELEASE,
      ambienceId,
      owner
    }, { broadcast }),

    setMasterVolume: (ambienceId, volume, { durationMs = 0, broadcast = true } = {}) => executeSynchronized(service(), {
      command: COMMANDS.MASTER_VOLUME,
      ambienceId,
      volume,
      durationMs
    }, { broadcast }),

    setTrackVolume: (ambienceId, trackId, volume, { durationMs = 0, broadcast = true } = {}) => executeSynchronized(service(), {
      command: COMMANDS.TRACK_VOLUME,
      ambienceId,
      trackId,
      volume,
      durationMs
    }, { broadcast }),

    setTrackActive: (ambienceId, trackId, active, { broadcast = true } = {}) => executeSynchronized(service(), {
      command: COMMANDS.TRACK_ACTIVE,
      ambienceId,
      trackId,
      active: Boolean(active)
    }, { broadcast }),

    setTrackIntensity: (ambienceId, trackId, intensity, { broadcast = true } = {}) => executeSynchronized(service(), {
      command: COMMANDS.TRACK_INTENSITY,
      ambienceId,
      trackId,
      intensity
    }, { broadcast }),

    setState: (ambienceId, group, state, { owner = null, durationMs = null, broadcast = true } = {}) => {
      const value = service();
      return executeSynchronized(value, {
        command: COMMANDS.STATE,
        ambienceId,
        ambience: value.getAmbience(ambienceId),
        group,
        state,
        owner,
        durationMs
      }, { broadcast });
    },

    clearState: (ambienceId, group, { owner = null, durationMs = null, broadcast = true } = {}) => {
      const value = service();
      return executeSynchronized(value, {
        command: COMMANDS.CLEAR_STATE,
        ambienceId,
        ambience: value.getAmbience(ambienceId),
        group,
        owner,
        durationMs
      }, { broadcast });
    },

    setStateByKey: async ({ ambience, group, state, owner = null, durationMs = null, broadcast = true } = {}) => {
      const matches = service().getAmbiencesByKey(ambience);
      if (!matches.length) return [];
      return applyStateToIds(matches.map((entry) => entry.id), group, state, { owner, durationMs, broadcast });
    },

    clearStateByKey: async ({ ambience, group, owner = null, durationMs = null, broadcast = true } = {}) => {
      const matches = service().getAmbiencesByKey(ambience);
      if (!matches.length) return [];
      return clearStateForIds(matches.map((entry) => entry.id), group, { owner, durationMs, broadcast });
    },

    setStateForActiveAmbiences: ({ group, state, owner = null, durationMs = null, broadcast = true } = {}) =>
      applyStateToIds(activeCandidateIds(), group, state, { owner, durationMs, broadcast }),

    clearStateForActiveAmbiences: ({ group, owner = null, durationMs = null, broadcast = true } = {}) =>
      clearStateForIds(activeCandidateIds(), group, { owner, durationMs, broadcast }),

    setContextState: ({ group, state, owner = null, durationMs = null, broadcast = true } = {}) =>
      executeSynchronized(service(), {
        command: COMMANDS.CONTEXT_STATE,
        group,
        state,
        owner,
        durationMs
      }, { broadcast }),

    clearContextState: ({ group, owner = null, durationMs = null, broadcast = true } = {}) =>
      executeSynchronized(service(), {
        command: COMMANDS.CLEAR_CONTEXT_STATE,
        group,
        owner,
        durationMs
      }, { broadcast }),

    previewAudio: (track) => service().previewAudio(track),
    previewLoop: (track) => service().previewLoop(track),
    previewRandom: (track) => service().previewRandom(track),
    previewSequence: (track) => service().previewSequence(track),
    previewIntensity: (track) => service().previewIntensity(track),
    setPreviewIntensity: (intensity) => service().setPreviewIntensity(intensity),
    stopPreview: () => service().stopPreview(),

    getSceneEmitters: () => emitterService().getEmitters(),
    getSceneEmitter: (id) => emitterService().getEmitter(id),
    createSceneEmitter: (data) => emitterService().createEmitter(data),
    updateSceneEmitter: (id, data) => emitterService().updateEmitter(id, data),
    setSceneEmitterEnabled: (id, enabled) => emitterService().setEmitterEnabled(id, enabled),
    deleteSceneEmitter: (id) => emitterService().deleteEmitter(id),
    previewSceneEmitter: (id) => emitterService().previewEmitter(id),
    stopSceneEmitterPreview: () => emitterService().stopPreview(),

    stopAll: (options = {}) => executeSynchronized(service(), {
      command: COMMANDS.STOP_ALL
    }, options)
  });
}
