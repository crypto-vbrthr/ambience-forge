import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(new URL("../scripts/ui/quick-control.js", import.meta.url), "utf8");
const controls = fs.readFileSync(new URL("../scripts/ui/scene-controls.js", import.meta.url), "utf8");

test("Quick Control is a persistent ApplicationV2 and is exposed in Scene Controls", () => {
  assert.match(source, /const ApplicationV2 = foundry\.applications\.api\.ApplicationV2/);
  assert.match(source, /class AmbienceForgeQuickControlApp extends ApplicationV2/);
  assert.match(controls, /quick-control\.js/);
  assert.match(controls, /quick: \{/);
  assert.match(controls, /onChange: \(\) => openQuickControl\(api\)/);
});

test("Quick Control exposes start, stop, master, per-track volume, per-track toggle and intensity controls", () => {
  assert.match(source, /play-selected/);
  assert.match(source, /stop-one/);
  assert.match(source, /stop-active/);
  assert.match(source, /toggle-track/);
  assert.match(source, /data-af-quick-master/);
  assert.match(source, /data-af-quick-track-volume/);
  assert.match(source, /data-af-quick-intensity/);
  assert.match(source, /this\.api\.setMasterVolume/);
  assert.match(source, /this\.api\.setTrackVolume/);
  assert.match(source, /this\.api\.setTrackActive/);
  assert.match(source, /this\.api\.setTrackIntensity/);
});

test("Quick Control does not persist edited composition data", () => {
  assert.doesNotMatch(source, /upsertAmbience/);
  assert.doesNotMatch(source, /deleteAmbience/);
});


test("Quick Control shows the temporary-playback note only once at the top", () => {
  assert.match(source, /AMBIENCE_FORGE\.Quick\.Hint/);
  assert.doesNotMatch(source, /AMBIENCE_FORGE\.Quick\.MasterVolumeHint/);
  assert.doesNotMatch(source, /AMBIENCE_FORGE\.Quick\.TrackVolumeHint/);
});
