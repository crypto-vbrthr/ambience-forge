import { MODULE_ID, SOCKET_NAME } from "./constants.js";

export const COMMANDS = Object.freeze({
  PLAY: "play",
  STOP: "stop",
  REQUEST: "request",
  RELEASE: "release",
  MASTER_VOLUME: "master-volume",
  TRACK_VOLUME: "track-volume",
  TRACK_ACTIVE: "track-active",
  TRACK_INTENSITY: "track-intensity",
  STATE: "state",
  CLEAR_STATE: "clear-state",
  CONTEXT_STATE: "context-state",
  CLEAR_CONTEXT_STATE: "clear-context-state",
  EMITTER_LIVE_VOLUME: "emitter-live-volume",
  EMITTER_LIVE_ACTIVE: "emitter-live-active",
  EMITTER_LIVE_RESET: "emitter-live-reset",
  STOP_ALL: "stop-all"
});

const EMITTER_COMMANDS = new Set([
  COMMANDS.EMITTER_LIVE_VOLUME,
  COMMANDS.EMITTER_LIVE_ACTIVE,
  COMMANDS.EMITTER_LIVE_RESET
]);

export function registerSocketListener(getService, getEmitterService = () => null) {
  game.socket.on(SOCKET_NAME, async (message) => {
    if (!message?.command) return;
    try {
      if (EMITTER_COMMANDS.has(message.command)) {
        const emitterService = getEmitterService?.();
        if (emitterService) await executeEmitterCommand(emitterService, message);
        return;
      }
      const service = getService?.();
      if (service) await executeCommand(service, message);
    } catch (error) {
      console.error(`${MODULE_ID} | socket command failed`, error);
    }
  });
}

export async function executeCommand(service, message) {
  switch (message.command) {
    case COMMANDS.PLAY:
      if (message.ambience) await service.syncAmbienceDefinition(message.ambience);
      return service.playAmbience(message.ambienceId);
    case COMMANDS.STOP:
      return service.stopAmbience(message.ambienceId);
    case COMMANDS.REQUEST:
      if (message.ambience) await service.syncAmbienceDefinition(message.ambience);
      return service.requestAmbience(message.ambienceId, message.owner);
    case COMMANDS.RELEASE:
      return service.releaseAmbience(message.ambienceId, message.owner);
    case COMMANDS.MASTER_VOLUME:
      return service.setMasterVolume(message.ambienceId, message.volume, { durationMs: message.durationMs ?? 0 });
    case COMMANDS.TRACK_VOLUME:
      return service.setTrackVolume(message.ambienceId, message.trackId, message.volume, { durationMs: message.durationMs ?? 0 });
    case COMMANDS.TRACK_ACTIVE:
      return service.setTrackActive(message.ambienceId, message.trackId, message.active);
    case COMMANDS.TRACK_INTENSITY:
      return service.setTrackIntensity(message.ambienceId, message.trackId, message.intensity);
    case COMMANDS.STATE:
      if (message.ambience) await service.syncAmbienceDefinition(message.ambience);
      return service.setState(message.ambienceId, message.group, message.state, { owner: message.owner, durationMs: message.durationMs });
    case COMMANDS.CLEAR_STATE:
      if (message.ambience) await service.syncAmbienceDefinition(message.ambience);
      return service.clearState(message.ambienceId, message.group, { owner: message.owner, durationMs: message.durationMs });
    case COMMANDS.CONTEXT_STATE:
      return service.setContextState(message.group, message.state, { owner: message.owner, durationMs: message.durationMs });
    case COMMANDS.CLEAR_CONTEXT_STATE:
      return service.clearContextState(message.group, { owner: message.owner, durationMs: message.durationMs });
    case COMMANDS.STOP_ALL:
      return service.stopAll();
    default:
      throw new Error(`Unknown Ambience Forge socket command: ${message.command}`);
  }
}

export async function executeEmitterCommand(service, message) {
  switch (message.command) {
    case COMMANDS.EMITTER_LIVE_VOLUME:
      return service.setEmitterLiveVolume(message.emitterId, message.volume, message.sceneId);
    case COMMANDS.EMITTER_LIVE_ACTIVE:
      return service.setEmitterLiveActive(message.emitterId, message.active, message.sceneId);
    case COMMANDS.EMITTER_LIVE_RESET:
      return service.resetEmitterLiveState(message.emitterId, message.sceneId);
    default:
      throw new Error(`Unknown Ambience Forge scene emitter socket command: ${message.command}`);
  }
}

export async function executeSynchronized(service, message, { broadcast = true } = {}) {
  if (broadcast) {
    if (!game.user?.isGM) return false;
    const result = await executeCommand(service, message);
    game.socket.emit(SOCKET_NAME, message);
    return result;
  }
  return executeCommand(service, message);
}

export async function executeEmitterSynchronized(service, message, { broadcast = true } = {}) {
  if (broadcast) {
    if (!game.user?.isGM) return false;
    const result = await executeEmitterCommand(service, message);
    game.socket.emit(SOCKET_NAME, message);
    return result;
  }
  return executeEmitterCommand(service, message);
}
