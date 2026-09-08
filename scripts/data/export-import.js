import { MODULE_ID, SCHEMA_VERSION } from "../constants.js";
import { cloneData, createId, normalizeAmbience, validateAmbience } from "./schema.js";

export function exportAmbienceEnvelope(ambience, moduleVersion = "0.0.0") {
  return {
    format: MODULE_ID,
    schemaVersion: SCHEMA_VERSION,
    moduleVersion,
    ambience: cloneData(ambience)
  };
}

export function importAmbienceEnvelope(envelope, { idFactory = createId } = {}) {
  if (!envelope || envelope.format !== MODULE_ID) throw new Error("Ambience Forge import format mismatch");
  if (Number(envelope.schemaVersion) > SCHEMA_VERSION) throw new Error("Ambience Forge import schema is newer than this module");
  if (!envelope.ambience || typeof envelope.ambience !== "object") throw new Error("Ambience Forge import contains no ambience");

  const imported = normalizeAmbience(envelope.ambience, { idFactory });
  imported.id = idFactory("ambience");
  imported.tracks = imported.tracks.map((track) => ({
    ...track,
    id: idFactory("track"),
    ...(track.variants
      ? { variants: track.variants.map((variant) => ({ ...variant, id: idFactory("variant") })) }
      : {})
  }));

  const errors = validateAmbience(imported);
  if (errors.length) throw new Error(`Invalid Ambience Forge import: ${errors.join(", ")}`);
  return imported;
}

export function collectAmbienceAudioSources(ambience) {
  const sources = new Set();
  for (const track of ambience?.tracks ?? []) {
    if (track?.source) sources.add(String(track.source));
    for (const source of track?.sources ?? []) if (source) sources.add(String(source));
    for (const variant of track?.variants ?? []) if (variant?.source) sources.add(String(variant.source));
  }
  return [...sources];
}
