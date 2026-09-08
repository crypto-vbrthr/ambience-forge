import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(new URL("../scripts/ui/state-manager.js", import.meta.url), "utf8");

test("state manager uses persistent ApplicationV2 and supports groups and states", () => {
  assert.match(source, /class AmbienceForgeStateManager extends ApplicationV2/);
  assert.match(source, /new-group/);
  assert.match(source, /new-state/);
  assert.match(source, /save-group/);
  assert.match(source, /save-state/);
});

test("state editor exposes tri-state activation and relative volume factors", () => {
  assert.match(source, /STATE_ACTIVITY\.INHERIT/);
  assert.match(source, /STATE_ACTIVITY\.ON/);
  assert.match(source, /STATE_ACTIVITY\.OFF/);
  assert.match(source, /max: 300/);
  assert.match(source, /volumeFactor/);
});

test("state editor keeps the track matrix compact and shows multiplication guidance once", () => {
  assert.match(source, /ambience-forge-state-override-header/);
  assert.match(source, /AMBIENCE_FORGE\.States\.Track/);
  assert.doesNotMatch(source, /AMBIENCE_FORGE\.States\.VolumeFactorHint/);
  const overrideHintUses = source.match(/AMBIENCE_FORGE\.States\.OverrideHint/g) ?? [];
  assert.equal(overrideHintUses.length, 1);
});

test("API keys are optional and auto-derived for new state entries", () => {
  assert.match(source, /AMBIENCE_FORGE\.States\.KeyOptional/);
  assert.match(source, /function keyField\(/);
  assert.match(source, /slugifyKey\(nameControl\.value, fallback\)/);
});
