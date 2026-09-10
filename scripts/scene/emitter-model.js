import { MODULE_ID } from "../constants.js";
import { slugifyKey } from "../data/schema.js";

export const EMITTER_FLAG = "emitter";
export const EMITTER_SCHEMA_VERSION = 4;
export const EMITTER_OBSTRUCTION_MODES = Object.freeze({
  IGNORE: "ignore",
  ATTENUATE: "attenuate",
  BLOCK: "block"
});
export const SILENCE_PATH = `modules/${MODULE_ID}/assets/silence.ogg`;

function clamp01(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.min(1, Math.max(0, number));
}

export function getEmitterFlag(document) {
  if (!document) return null;
  try {
    return document.getFlag?.(MODULE_ID, EMITTER_FLAG) ?? document.flags?.[MODULE_ID]?.[EMITTER_FLAG] ?? null;
  } catch {
    return document.flags?.[MODULE_ID]?.[EMITTER_FLAG] ?? null;
  }
}

export function isAmbienceEmitter(document) {
  return Boolean(getEmitterFlag(document)?.ambienceId);
}

export function normalizeEmitterData(input = {}) {
  const requestedMode = String(input.obstructionMode ?? input.obstruction?.mode ?? EMITTER_OBSTRUCTION_MODES.IGNORE);
  const obstructionMode = Object.values(EMITTER_OBSTRUCTION_MODES).includes(requestedMode)
    ? requestedMode
    : EMITTER_OBSTRUCTION_MODES.IGNORE;
  return {
    id: String(input.id ?? input._id ?? ""),
    ambienceId: String(input.ambienceId ?? ""),
    name: String(input.name ?? ""),
    key: slugifyKey(input.key || input.name || input.ambienceId, "emitter"),
    x: Number(input.x) || 0,
    y: Number(input.y) || 0,
    radius: Math.max(0, Number(input.radius) || 0),
    volume: clamp01(input.volume ?? 1),
    easing: input.easing !== false,
    enabled: input.enabled !== false,
    obstructionMode,
    obstructionAttenuation: clamp01(input.obstructionAttenuation ?? input.obstruction?.attenuation ?? 0.7)
  };
}

export function emitterDataFromDocument(document) {
  const flag = getEmitterFlag(document);
  if (!flag?.ambienceId) return null;
  return normalizeEmitterData({
    id: document.id ?? document._id,
    ambienceId: flag.ambienceId,
    name: flag.name ?? "",
    key: flag.key ?? flag.name ?? flag.ambienceId,
    x: document.x,
    y: document.y,
    radius: document.radius,
    volume: document.volume,
    easing: document.easing,
    enabled: flag.enabled !== false,
    obstructionMode: flag.obstructionMode ?? EMITTER_OBSTRUCTION_MODES.IGNORE,
    obstructionAttenuation: flag.obstructionAttenuation ?? 0.7
  });
}

export function radiusToPixels(radius, scene) {
  const gridSize = Number(scene?.grid?.size ?? scene?.grid?.sizeX ?? 100) || 100;
  const gridDistance = Number(scene?.grid?.distance ?? 5) || 5;
  return Math.max(0, Number(radius) || 0) * (gridSize / gridDistance);
}

export function computeEmitterGain({ emitter, listener, scene }) {
  if (!emitter || !listener || emitter.enabled === false) return 0;
  const radiusPx = radiusToPixels(emitter.radius, scene);
  if (!(radiusPx > 0)) return 0;
  const dx = (Number(listener.x) || 0) - (Number(emitter.x) || 0);
  const dy = (Number(listener.y) || 0) - (Number(emitter.y) || 0);
  const distance = Math.hypot(dx, dy);
  if (distance > radiusPx) return 0;
  const attenuation = emitter.easing === false ? 1 : Math.max(0, 1 - (distance / radiusPx));
  return clamp01((emitter.volume ?? 1) * attenuation);
}

export function applyEmitterObstruction(gain, emitter, obstructed) {
  const base = clamp01(gain);
  if (!(base > 0) || !obstructed) return base;
  const mode = emitter?.obstructionMode ?? EMITTER_OBSTRUCTION_MODES.IGNORE;
  if (mode === EMITTER_OBSTRUCTION_MODES.BLOCK) return 0;
  if (mode === EMITTER_OBSTRUCTION_MODES.ATTENUATE) {
    const reduction = clamp01(emitter?.obstructionAttenuation ?? 0.7);
    return base * (1 - reduction);
  }
  return base;
}
