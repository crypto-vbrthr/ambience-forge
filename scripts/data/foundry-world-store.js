import { MODULE_ID, SCHEMA_VERSION, SETTING_AMBIENCES } from "../constants.js";
import { cloneData, normalizeAmbience } from "./schema.js";

export class FoundryWorldStore {
  async loadAll() {
    const data = game.settings.get(MODULE_ID, SETTING_AMBIENCES) ?? {};
    const items = Array.isArray(data.items) ? data.items : [];
    return items.map((item) => normalizeAmbience(item));
  }

  async saveAll(ambiences) {
    await game.settings.set(MODULE_ID, SETTING_AMBIENCES, {
      schemaVersion: SCHEMA_VERSION,
      items: cloneData(ambiences)
    });
  }
}
