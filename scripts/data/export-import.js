import { MODULE_ID, SCHEMA_VERSION } from "../constants.js";
import { cloneData, normalizeAmbience, validateAmbience } from "./schema.js";

export function exportAmbienceEnvelope(ambience, moduleVersion = "0.0.0") {
  return {
    format: MODULE_ID,
    schemaVersion: SCHEMA_VERSION,
    moduleVersion,
    ambience: cloneData(ambience)
  };
}

export function importAmbienceEnvelope(envelope, { idFactory } = {}) {
  if (!envelope || envelope.format !== MODULE_ID) throw new Error("AMBience Forge import format mismatch");
  if (Number(envelope.schemaVersion) > SCHEMA_VERSION) throw new Error("Ambience Forge import schema is newer than this module");

  const imported = normalizeAmbience(envelope.ambience, { idFactory });
  imported.id = idFactory ? idFactory("ambience") : imported.id;
  imported.tracks = imported.tracks.map((track) => ({
    ...track,
    id: idFactory ? idFactory("track") : track.id,
    ...(track.variants
      ? { variants: track.variants.map((variant) => ({ ...variant, id: idFactory ? idFactory("variant") : variant.id })) }
      : {})
  }));

  const errors = validateAmbience(imported);
  if (errors.length) throw new Error(`Invalid Ambience Forge import: ${errors.join(", ")}`);
  return imported;
}
