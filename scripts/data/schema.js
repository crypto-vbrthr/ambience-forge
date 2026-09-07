import { SCHEMA_VERSION, TRACK_TYPES } from "../constants.js";

const TRACK_TYPE_SET = new Set(Object.values(TRACK_TYPES));
const LEGACY_LOOP_TYPE = "loop";

function clamp(value, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}

export function createId(prefix = "af") {
  const uuid = globalThis.crypto?.randomUUID?.();
  if (uuid) return `${prefix}-${uuid}`;
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

export function normalizeTrack(input = {}, { idFactory = createId } = {}) {
  const legacyLoop = input.type === LEGACY_LOOP_TYPE;
  const type = legacyLoop ? TRACK_TYPES.AUDIO : (TRACK_TYPE_SET.has(input.type) ? input.type : TRACK_TYPES.AUDIO);
  const base = {
    id: String(input.id || idFactory("track")),
    name: String(input.name || ""),
    type,
    enabled: input.enabled !== false,
    volume: clamp(input.volume ?? 1, 0, 1),
    fadeInMs: Math.max(0, Number(input.fadeInMs ?? 1500) || 0),
    fadeOutMs: Math.max(0, Number(input.fadeOutMs ?? 1500) || 0)
  };

  if (type === TRACK_TYPES.AUDIO) {
    return {
      ...base,
      source: String(input.source || ""),
      repeat: legacyLoop ? true : input.repeat !== false,
      loopStart: input.loopStart == null ? null : Math.max(0, Number(input.loopStart) || 0),
      loopEnd: input.loopEnd == null ? null : Math.max(0, Number(input.loopEnd) || 0)
    };
  }

  if (type === TRACK_TYPES.RANDOM) {
    const minDelayMs = Math.max(0, Number(input.minDelayMs ?? 30000) || 0);
    const maxDelayMs = Math.max(minDelayMs, Number(input.maxDelayMs ?? 120000) || minDelayMs);
    return {
      ...base,
      sources: Array.isArray(input.sources) ? input.sources.map(String).filter(Boolean) : [],
      minDelayMs,
      maxDelayMs,
      avoidImmediateRepeat: input.avoidImmediateRepeat !== false,
      allowOverlap: input.allowOverlap !== false
    };
  }

  if (type === TRACK_TYPES.SEQUENCE) {
    const minDelayMs = Math.max(0, Number(input.minDelayMs ?? 0) || 0);
    const maxDelayMs = Math.max(minDelayMs, Number(input.maxDelayMs ?? 0) || minDelayMs);
    return {
      ...base,
      sources: Array.isArray(input.sources) ? input.sources.map(String).filter(Boolean) : [],
      order: input.order === "random" ? "random" : "sequential",
      minDelayMs,
      maxDelayMs,
      avoidImmediateRepeat: input.avoidImmediateRepeat !== false
    };
  }

  const variants = Array.isArray(input.variants)
    ? input.variants
        .map((variant) => ({
          id: String(variant.id || idFactory("variant")),
          name: String(variant.name || ""),
          source: String(variant.source || "")
        }))
        .filter((variant) => variant.source)
    : [];

  return {
    ...base,
    intensity: clamp(input.intensity ?? 0, 0, 1),
    transitionMs: Math.max(0, Number(input.transitionMs ?? 3000) || 0),
    variants
  };
}

export function normalizeAmbience(input = {}, { idFactory = createId } = {}) {
  return {
    id: String(input.id || idFactory("ambience")),
    schemaVersion: SCHEMA_VERSION,
    name: String(input.name || ""),
    description: String(input.description || ""),
    transitionMs: Math.max(0, Number(input.transitionMs ?? 3000) || 0),
    tracks: Array.isArray(input.tracks)
      ? input.tracks.map((track) => normalizeTrack(track, { idFactory }))
      : []
  };
}

export function validateAmbience(input) {
  const errors = [];
  if (!input || typeof input !== "object") return ["ambience.invalid"];
  if (!String(input.name || "").trim()) errors.push("ambience.nameRequired");
  if (!Array.isArray(input.tracks)) errors.push("ambience.tracksInvalid");

  for (const track of Array.isArray(input.tracks) ? input.tracks : []) {
    if (!TRACK_TYPE_SET.has(track.type)) errors.push(`track.typeInvalid:${track.id ?? "unknown"}`);
    if (track.type === TRACK_TYPES.AUDIO && !track.source) errors.push(`track.sourceRequired:${track.id ?? "unknown"}`);
    if ([TRACK_TYPES.RANDOM, TRACK_TYPES.SEQUENCE].includes(track.type) && !track.sources?.length) {
      errors.push(`track.sourcesRequired:${track.id ?? "unknown"}`);
    }
    if (track.type === TRACK_TYPES.INTENSITY && !track.variants?.length) {
      errors.push(`track.variantsRequired:${track.id ?? "unknown"}`);
    }
  }
  return errors;
}

export function cloneData(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}
