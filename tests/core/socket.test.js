import test from "node:test";
import assert from "node:assert/strict";
import { COMMANDS, executeCommand } from "../../scripts/socket.js";

test("track-active socket command forwards the live toggle to the service", async () => {
  const calls = [];
  const service = {
    async setTrackActive(ambienceId, trackId, active) {
      calls.push({ ambienceId, trackId, active });
      return true;
    }
  };
  const result = await executeCommand(service, {
    command: COMMANDS.TRACK_ACTIVE,
    ambienceId: "forest",
    trackId: "rain",
    active: false
  });
  assert.equal(result, true);
  assert.deepEqual(calls, [{ ambienceId: "forest", trackId: "rain", active: false }]);
});

test("play socket command synchronizes the embedded ambience definition before playback", async () => {
  const calls = [];
  const ambience = { id: "forest", name: "Forest", tracks: [] };
  const service = {
    async syncAmbienceDefinition(value) { calls.push(["sync", value]); },
    async playAmbience(id) { calls.push(["play", id]); return true; }
  };
  const result = await executeCommand(service, {
    command: COMMANDS.PLAY,
    ambienceId: "forest",
    ambience
  });
  assert.equal(result, true);
  assert.deepEqual(calls, [["sync", ambience], ["play", "forest"]]);
});

test("owner request socket command synchronizes the embedded ambience definition before requesting", async () => {
  const calls = [];
  const ambience = { id: "storm", name: "Storm", tracks: [] };
  const service = {
    async syncAmbienceDefinition(value) { calls.push(["sync", value]); },
    async requestAmbience(id, owner) { calls.push(["request", id, owner]); return 1; }
  };
  const result = await executeCommand(service, {
    command: COMMANDS.REQUEST,
    ambienceId: "storm",
    ambience,
    owner: "weather-forge"
  });
  assert.equal(result, 1);
  assert.deepEqual(calls, [["sync", ambience], ["request", "storm", "weather-forge"]]);
});

test("state socket commands forward group, state, owner, and transition", async () => {
  const calls = [];
  const service = {
    async setState(ambienceId, group, state, options) {
      calls.push(["set", ambienceId, group, state, options]);
      return state;
    },
    async clearState(ambienceId, group, options) {
      calls.push(["clear", ambienceId, group, options]);
      return true;
    }
  };
  assert.equal(await executeCommand(service, {
    command: COMMANDS.STATE,
    ambienceId: "forest",
    group: "weather",
    state: "storm",
    owner: "weather-forge",
    durationMs: 4000
  }), "storm");
  assert.equal(await executeCommand(service, {
    command: COMMANDS.CLEAR_STATE,
    ambienceId: "forest",
    group: "weather",
    owner: "weather-forge",
    durationMs: 1200
  }), true);
  assert.deepEqual(calls, [
    ["set", "forest", "weather", "storm", { owner: "weather-forge", durationMs: 4000 }],
    ["clear", "forest", "weather", { owner: "weather-forge", durationMs: 1200 }]
  ]);
});

test("state socket command synchronizes an embedded ambience definition before applying the state", async () => {
  const calls = [];
  const ambience = { id: "forest", name: "Forest", tracks: [], stateGroups: [] };
  const service = {
    async syncAmbienceDefinition(value) { calls.push(["sync", value]); },
    async setState(id, group, state, options) { calls.push(["state", id, group, state, options]); return state; }
  };
  const result = await executeCommand(service, {
    command: COMMANDS.STATE,
    ambienceId: "forest",
    ambience,
    group: "weather",
    state: "storm",
    owner: "weather-forge"
  });
  assert.equal(result, "storm");
  assert.deepEqual(calls[0], ["sync", ambience]);
  assert.deepEqual(calls[1], ["state", "forest", "weather", "storm", { owner: "weather-forge", durationMs: undefined }]);
});


test("context socket commands persist semantic context through the service", async () => {
  const calls = [];
  const service = {
    async setContextState(group, state, options) { calls.push(["set-context", group, state, options]); return ["forest"]; },
    async clearContextState(group, options) { calls.push(["clear-context", group, options]); return ["forest"]; }
  };
  assert.deepEqual(await executeCommand(service, {
    command: COMMANDS.CONTEXT_STATE, group: "weather", state: "rain", owner: "weather-forge", durationMs: 1500
  }), ["forest"]);
  assert.deepEqual(await executeCommand(service, {
    command: COMMANDS.CLEAR_CONTEXT_STATE, group: "weather", owner: "weather-forge", durationMs: 500
  }), ["forest"]);
  assert.deepEqual(calls, [
    ["set-context", "weather", "rain", { owner: "weather-forge", durationMs: 1500 }],
    ["clear-context", "weather", { owner: "weather-forge", durationMs: 500 }]
  ]);
});

test("scene emitter live socket commands are routed to the emitter service", async () => {
  const { executeEmitterCommand } = await import("../../scripts/socket.js");
  const calls = [];
  const emitterService = {
    async setEmitterLiveVolume(id, volume, sceneId, options) { calls.push(["volume", id, volume, sceneId, options]); return true; },
    async setEmitterLiveActive(id, active, sceneId, options) { calls.push(["active", id, active, sceneId, options]); return true; },
    async resetEmitterLiveState(id, sceneId, options) { calls.push(["reset", id, sceneId, options]); return true; }
  };
  assert.equal(await executeEmitterCommand(emitterService, { command: COMMANDS.EMITTER_LIVE_VOLUME, emitterId: "falls", sceneId: "s1", volume: 0.4, owner: "weather-forge", durationMs: 900 }), true);
  assert.equal(await executeEmitterCommand(emitterService, { command: COMMANDS.EMITTER_LIVE_ACTIVE, emitterId: "falls", sceneId: "s1", active: false, owner: "weather-forge", durationMs: 1200 }), true);
  assert.equal(await executeEmitterCommand(emitterService, { command: COMMANDS.EMITTER_LIVE_RESET, emitterId: "falls", sceneId: "s1", owner: "weather-forge", durationMs: 500 }), true);
  assert.deepEqual(calls, [
    ["volume", "falls", 0.4, "s1", { owner: "weather-forge", durationMs: 900 }],
    ["active", "falls", false, "s1", { owner: "weather-forge", durationMs: 1200 }],
    ["reset", "falls", "s1", { owner: "weather-forge", durationMs: 500 }]
  ]);
});
