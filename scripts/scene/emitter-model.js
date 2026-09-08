import { MODULE_ID } from "../constants.js";

export const EMITTER_FLAG = "emitter";
export const EMITTER_SCHEMA_VERSION = 2;
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
  return {
    id: String(input.id ?? input._id ?? ""),
    ambienceId: String(input.ambienceId ?? ""),
    name: String(input.name ?? ""),
    x: Number(input.x) || 0,
    y: Number(input.y) || 0,
    radius: Math.max(0, Number(input.radius) || 0),
    volume: clamp01(input.volume ?? 1),
    easing: input.easing !== false,
    enabled: input.enabled !== false
  };
}

export function emitterDataFromDocument(document) {
  const flag = getEmitterFlag(document);
  if (!flag?.ambienceId) return null;
  return normalizeEmitterData({
    id: document.id ?? document._id,
    ambienceId: flag.ambienceId,
    name: flag.name ?? "",
    x: document.x,
    y: document.y,
    radius: document.radius,
    volume: document.volume,
    easing: document.easing,
    enabled: flag.enabled !== false
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
