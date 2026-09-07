import { MODULE_ID, SCHEMA_VERSION, SETTING_AMBIENCES } from "./constants.js";

export function registerSettings() {
  game.settings.register(MODULE_ID, SETTING_AMBIENCES, {
    scope: "world",
    config: false,
    type: Object,
    default: {
      schemaVersion: SCHEMA_VERSION,
      items: []
    }
  });
}
