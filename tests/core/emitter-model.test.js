import test from "node:test";
import assert from "node:assert/strict";
import { computeEmitterGain, radiusToPixels } from "../../scripts/scene/emitter-model.js";

const scene = { grid: { size: 100, distance: 5 } };

test("scene emitter radius uses scene distance units", () => {
  assert.equal(radiusToPixels(10, scene), 200);
});

test("scene emitter easing attenuates linearly with distance", () => {
  const emitter = { x: 0, y: 0, radius: 10, volume: 0.8, easing: true };
  assert.equal(computeEmitterGain({ emitter, listener: { x: 0, y: 0 }, scene }), 0.8);
  assert.equal(computeEmitterGain({ emitter, listener: { x: 100, y: 0 }, scene }), 0.4);
  assert.equal(computeEmitterGain({ emitter, listener: { x: 201, y: 0 }, scene }), 0);
});

test("scene emitter can keep constant volume inside its radius", () => {
  const emitter = { x: 0, y: 0, radius: 10, volume: 0.65, easing: false };
  assert.equal(computeEmitterGain({ emitter, listener: { x: 199, y: 0 }, scene }), 0.65);
});


test("disabled scene emitter produces no gain", () => {
  const emitter = { x: 0, y: 0, radius: 10, volume: 1, easing: true, enabled: false };
  assert.equal(computeEmitterGain({ emitter, listener: { x: 0, y: 0 }, scene }), 0);
});
