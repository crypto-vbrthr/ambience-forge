import test from "node:test";
import assert from "node:assert/strict";
import { STATE_ACTIVITY } from "../../scripts/constants.js";
import { normalizeAmbience } from "../../scripts/data/schema.js";
import { defaultStateSelections, resolveTrackStates } from "../../scripts/core/state-resolver.js";

test("state groups combine activation and volume factors", () => {
  const ambience = normalizeAmbience({
    name: "Forest",
    tracks: [
      { id: "wind", name: "Wind", type: "audio", source: "wind.ogg", volume: 0.5, enabled: true },
      { id: "rain", name: "Rain", type: "audio", source: "rain.ogg", volume: 0.8, enabled: false }
    ],
    stateGroups: [
      {
        id: "time", key: "time", name: "Time", defaultStateId: "night",
        states: [{ id: "night", key: "night", name: "Night", trackOverrides: [{ trackId: "wind", volumeFactor: 0.5 }] }]
      },
      {
        id: "weather", key: "weather", name: "Weather", defaultStateId: "storm",
        states: [{
          id: "storm", key: "storm", name: "Storm",
          trackOverrides: [
            { trackId: "wind", volumeFactor: 2 },
            { trackId: "rain", active: STATE_ACTIVITY.ON, volumeFactor: 0.75 }
          ]
        }]
      }
    ]
  });
  const selections = defaultStateSelections(ambience);
  const resolved = resolveTrackStates(ambience, { selections });
  assert.equal(resolved.get("wind").volume, 0.5); // .5 base × .5 night × 2 storm
  assert.equal(resolved.get("rain").active, true);
  assert.ok(Math.abs(resolved.get("rain").volume - 0.6) < 1e-9);
});

test("live activation override wins over composition states", () => {
  const ambience = normalizeAmbience({
    name: "Forest",
    tracks: [{ id: "owl", name: "Owl", type: "audio", source: "owl.ogg", enabled: true }],
    stateGroups: [{
      id: "weather", key: "weather", name: "Weather", defaultStateId: "storm",
      states: [{ id: "storm", key: "storm", name: "Storm", trackOverrides: [{ trackId: "owl", active: STATE_ACTIVITY.OFF }] }]
    }]
  });
  const resolved = resolveTrackStates(ambience, {
    selections: defaultStateSelections(ambience),
    liveActiveOverrides: new Map([["owl", true]])
  });
  assert.equal(resolved.get("owl").active, true);
});
