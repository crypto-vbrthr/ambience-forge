import test from "node:test";
import assert from "node:assert/strict";
import { OwnerRegistry } from "../../scripts/core/owner-registry.js";

test("owner registry only becomes empty after the final owner releases", () => {
  const registry = new OwnerRegistry();
  assert.deepEqual(registry.request("rain", "weather-forge"), { wasEmpty: true, count: 1 });
  assert.deepEqual(registry.request("rain", "region-forge"), { wasEmpty: false, count: 2 });
  assert.deepEqual(registry.release("rain", "weather-forge"), { becameEmpty: false, count: 1 });
  assert.deepEqual(registry.release("rain", "region-forge"), { becameEmpty: true, count: 0 });
});
