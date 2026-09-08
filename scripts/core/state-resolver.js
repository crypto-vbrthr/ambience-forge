import { STATE_ACTIVITY } from "../constants.js";

function clamp01(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

export function findStateGroup(ambience, ref) {
  const value = String(ref ?? "").trim();
  if (!value) return null;
  return (ambience?.stateGroups ?? []).find((group) => group.id === value || group.key === value) ?? null;
}

export function findAmbienceState(group, ref) {
  if (ref == null || ref === "") return null;
  const value = String(ref).trim();
  return (group?.states ?? []).find((state) => state.id === value || state.key === value) ?? null;
}

export function defaultStateSelections(ambience, overrides = {}) {
  const selections = new Map();
  const entries = overrides instanceof Map ? overrides : new Map(Object.entries(overrides ?? {}));
  for (const group of ambience?.stateGroups ?? []) {
    let selected = group.defaultStateId ?? null;
    if (entries.has(group.id)) selected = entries.get(group.id);
    else if (entries.has(group.key)) selected = entries.get(group.key);
    const state = findAmbienceState(group, selected);
    selections.set(group.id, state?.id ?? null);
  }
  return selections;
}

export function resolveTrackStates(ambience, {
  selections = null,
  liveVolumes = null,
  liveActiveOverrides = null
} = {}) {
  const selected = selections instanceof Map ? selections : defaultStateSelections(ambience, selections ?? {});
  const volumes = liveVolumes instanceof Map ? liveVolumes : new Map(Object.entries(liveVolumes ?? {}));
  const activeOverrides = liveActiveOverrides instanceof Map ? liveActiveOverrides : new Map(Object.entries(liveActiveOverrides ?? {}));
  const result = new Map();

  for (const track of ambience?.tracks ?? []) {
    let active = track.enabled !== false;
    let volumeFactor = 1;
    for (const group of ambience?.stateGroups ?? []) {
      const stateId = selected.get(group.id) ?? null;
      const state = findAmbienceState(group, stateId);
      const override = state?.trackOverrides?.find((entry) => entry.trackId === track.id);
      if (!override) continue;
      if (override.active === STATE_ACTIVITY.ON) active = true;
      else if (override.active === STATE_ACTIVITY.OFF) active = false;
      volumeFactor *= Number(override.volumeFactor ?? 1) || 0;
    }
    if (activeOverrides.has(track.id)) active = Boolean(activeOverrides.get(track.id));
    const baseVolume = volumes.has(track.id) ? Number(volumes.get(track.id)) : Number(track.volume ?? 1);
    result.set(track.id, {
      active,
      volumeFactor,
      volume: clamp01(baseVolume * volumeFactor)
    });
  }
  return result;
}

export function transitionForState(ambience, group, state) {
  if (state?.transitionMs != null) return Math.max(0, Number(state.transitionMs) || 0);
  if (group?.transitionMs != null) return Math.max(0, Number(group.transitionMs) || 0);
  return Math.max(0, Number(ambience?.transitionMs ?? 0) || 0);
}

export function selectionsByKey(ambience, selections) {
  const map = selections instanceof Map ? selections : defaultStateSelections(ambience, selections ?? {});
  const out = {};
  for (const group of ambience?.stateGroups ?? []) {
    const state = findAmbienceState(group, map.get(group.id));
    out[group.key] = state?.key ?? null;
  }
  return out;
}
