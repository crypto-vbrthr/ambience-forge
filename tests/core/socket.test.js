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
