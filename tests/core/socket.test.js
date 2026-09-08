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
