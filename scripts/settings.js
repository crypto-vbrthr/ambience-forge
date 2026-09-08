import { MODULE_ID, SCHEMA_VERSION, SETTING_AMBIENCES } from "./constants.js";

export function registerSettings({ onAmbiencesChanged = null } = {}) {
  game.settings.register(MODULE_ID, SETTING_AMBIENCES, {
    scope: "world",
    config: false,
    type: Object,
    default: {
      schemaVersion: SCHEMA_VERSION,
      items: []
    },
    onChange: () => {
      try {
        const result = onAmbiencesChanged?.();
        if (result?.catch) result.catch((error) => console.error(`${MODULE_ID} | failed to reload ambience library`, error));
      } catch (error) {
        console.error(`${MODULE_ID} | failed to reload ambience library`, error);
      }
    }
  });
}
