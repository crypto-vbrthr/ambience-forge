import { API_VERSION } from "../constants.js";
import { COMMANDS, executeSynchronized } from "../socket.js";

export function createPublicApi({ getService, getModuleVersion }) {
  const service = () => {
    const value = getService();
    if (!value) throw new Error("Ambience Forge is not ready yet");
    return value;
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
      "track-live-control-v1"
    ]),

    isReady: () => Boolean(getService()),
    getModuleVersion: () => getModuleVersion(),
    getAmbiences: () => service().getAmbiences(),
    getAmbience: (id) => service().getAmbience(id),
    getState: () => service().getState(),
    upsertAmbience: (ambience) => service().upsertAmbience(ambience),
    deleteAmbience: (id) => service().deleteAmbience(id),

    playAmbience: (ambienceId, options = {}) => executeSynchronized(service(), {
      command: COMMANDS.PLAY,
      ambienceId
    }, options),

    stopAmbience: (ambienceId, options = {}) => executeSynchronized(service(), {
      command: COMMANDS.STOP,
      ambienceId
    }, options),

    requestAmbience: (ambienceId, { owner, broadcast = true } = {}) => executeSynchronized(service(), {
      command: COMMANDS.REQUEST,
      ambienceId,
      owner
    }, { broadcast }),

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

    previewAudio: (track) => service().previewAudio(track),
    previewLoop: (track) => service().previewLoop(track),
    previewRandom: (track) => service().previewRandom(track),
    previewSequence: (track) => service().previewSequence(track),
    previewIntensity: (track) => service().previewIntensity(track),
    setPreviewIntensity: (intensity) => service().setPreviewIntensity(intensity),
    stopPreview: () => service().stopPreview(),

    stopAll: (options = {}) => executeSynchronized(service(), {
      command: COMMANDS.STOP_ALL
    }, options)
  });
}
