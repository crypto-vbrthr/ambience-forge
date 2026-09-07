import test from "node:test";
import assert from "node:assert/strict";
import { chooseIndex, randomBetween } from "../../scripts/core/random.js";

test("randomBetween respects the requested range", () => {
  assert.equal(randomBetween(10, 20, () => 0), 10);
  assert.equal(randomBetween(10, 20, () => 0.5), 15);
  assert.equal(randomBetween(10, 20, () => 1), 20);
});

test("chooseIndex avoids immediate repeats when alternatives exist", () => {
  assert.equal(chooseIndex(3, { previous: 1, random: () => 0.4 }), 2);
});
