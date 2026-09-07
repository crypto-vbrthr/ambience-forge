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
  STOP_ALL: "stop-all"
});

export function registerSocketListener(getService) {
  game.socket.on(SOCKET_NAME, async (message) => {
    const service = getService();
    if (!service || !message?.command) return;
    try {
      await executeCommand(service, message);
    } catch (error) {
      console.error(`${MODULE_ID} | socket command failed`, error);
    }
  });
}

export async function executeCommand(service, message) {
  switch (message.command) {
    case COMMANDS.PLAY:
      return service.playAmbience(message.ambienceId);
    case COMMANDS.STOP:
      return service.stopAmbience(message.ambienceId);
    case COMMANDS.REQUEST:
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
    case COMMANDS.STOP_ALL:
      return service.stopAll();
    default:
      throw new Error(`Unknown Ambience Forge socket command: ${message.command}`);
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
