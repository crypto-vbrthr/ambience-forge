export const MODULE_ID = "ambience-forge";
export const MODULE_TITLE = "Ambience Forge";
export const API_VERSION = "1.4";
export const SCHEMA_VERSION = 5;
export const SOCKET_NAME = `module.${MODULE_ID}`;
export const SETTING_AMBIENCES = "ambiences";

export const TRACK_TYPES = Object.freeze({
  AUDIO: "audio",
  RANDOM: "random",
  SEQUENCE: "sequence",
  INTENSITY: "intensity"
});

export const STATE_ACTIVITY = Object.freeze({
  INHERIT: "inherit",
  ON: "on",
  OFF: "off"
});
