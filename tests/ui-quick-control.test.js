import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(new URL("../scripts/ui/quick-control.js", import.meta.url), "utf8");
const controls = fs.readFileSync(new URL("../scripts/ui/scene-controls.js", import.meta.url), "utf8");
const css = fs.readFileSync(new URL("../styles/ambience-forge.css", import.meta.url), "utf8");

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

test("Quick Control exposes combinable state groups for live switching", () => {
  assert.match(source, /data-af-quick-state-group/);
  assert.match(source, /AMBIENCE_FORGE\.Quick\.States/);
  assert.match(source, /this\.api\.setState/);
  assert.match(source, /this\.api\.clearState/);
});


test("Quick Control shows persistent external context and provider ownership", () => {
  assert.match(source, /state\.contextStates/);
  assert.match(source, /AMBIENCE_FORGE\.Quick\.ExternalControl/);
  assert.match(source, /providerDisplayName/);
  assert.match(source, /ambienceStateOwners/);
  assert.match(source, /AMBIENCE_FORGE\.Quick\.ControlledBy/);
});


test("Quick Control keeps externally controlled state metadata inside its own row", () => {
  assert.match(source, /ambience-forge-quick-state-group/);
  assert.match(css, /\.ambience-forge-quick-state-list\s*\{[^}]*grid-template-columns:\s*1fr/s);
  assert.match(css, /\.ambience-forge-quick-state-group[^}]*grid-template-columns:\s*minmax\(8\.5rem, 0\.38fr\) minmax\(0, 1fr\)/s);
  assert.match(css, /ambience-forge-provider-hint[^}]*grid-column:\s*2/s);
});


test("Quick Control groups multiple external context values by provider", () => {
  assert.match(source, /const providers = new Map\(\)/);
  assert.match(source, /ambience-forge-external-provider/);
  assert.match(source, /ambience-forge-external-provider-states/);
  assert.match(css, /\.ambience-forge-external-provider\s*\{/);
});

test("Quick Control renders read-only runtime status and progress for tracks", () => {
  assert.match(source, /data-af-runtime-status/);
  assert.match(source, /data-af-runtime-label/);
  assert.match(source, /data-af-runtime-progress/);
  assert.match(source, /element\("progress"/);
  assert.match(source, /state\.trackRuntimeStatuses/);
});

test("Quick Control refreshes runtime snapshots locally without full rerenders", () => {
  assert.match(source, /this\.api\.getTrackRuntimeStatus\?\.\(ambienceId, trackId\)/);
  assert.match(source, /setInterval\(\(\) => this\._refreshRuntimeStatuses\(\), 500\)/);
  assert.match(source, /clearInterval\(this\.runtimeRefreshTimer\)/);
  assert.match(source, /async close\(options = \{\}\)/);
});

test("Quick Control runtime presentation covers Random, Sequence, loop and Intensity phases", () => {
  assert.match(source, /RuntimeRandomWaiting/);
  assert.match(source, /RuntimeRandomPlayingMultiple/);
  assert.match(source, /RuntimeSequenceWaiting/);
  assert.match(source, /RuntimeSequencePlaying/);
  assert.match(source, /RuntimeLoopPlaying/);
  assert.match(source, /RuntimeIntensityPlaying/);
  assert.match(source, /RuntimeCrossfade/);
});

test("Quick Control shortens source paths for display while preserving the full path as a tooltip", () => {
  assert.match(source, /function sourceDisplayName\(source\)/);
  assert.match(source, /split\("\/"\)/);
  assert.match(source, /label\.title = presentation\.source \? String\(status\?\.source/);
});

test("Quick Control progress styling is compact and non-interactive", () => {
  assert.match(css, /\.ambience-forge-track-runtime-progress\s*\{/);
  assert.match(css, /pointer-events:\s*none/);
  assert.match(css, /height:\s*0\.45rem/);
});
