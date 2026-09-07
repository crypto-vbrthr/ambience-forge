import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(new URL("../scripts/ui/quick-control-alpha17.js", import.meta.url), "utf8");
const controls = fs.readFileSync(new URL("../scripts/ui/scene-controls-alpha17.js", import.meta.url), "utf8");

test("Quick Control is a persistent ApplicationV2 and is exposed in Scene Controls", () => {
  assert.match(source, /const ApplicationV2 = foundry\.applications\.api\.ApplicationV2/);
  assert.match(source, /class AmbienceForgeQuickControlApp extends ApplicationV2/);
  assert.match(controls, /quick-control-alpha17\.js/);
  assert.match(controls, /quick: \{/);
  assert.match(controls, /onChange: \(\) => openQuickControl\(api\)/);
});

test("Quick Control exposes start, stop, live master volume and live intensity controls", () => {
  assert.match(source, /play-selected/);
  assert.match(source, /stop-one/);
  assert.match(source, /stop-active/);
  assert.match(source, /data-af-quick-master/);
  assert.match(source, /data-af-quick-intensity/);
  assert.match(source, /this\.api\.setMasterVolume/);
  assert.match(source, /this\.api\.setTrackIntensity/);
});

test("Quick Control does not persist edited composition data", () => {
  assert.doesNotMatch(source, /upsertAmbience/);
  assert.doesNotMatch(source, /deleteAmbience/);
});
