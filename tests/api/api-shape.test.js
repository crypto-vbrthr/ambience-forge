import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const source = fs.readFileSync(path.resolve(here, "../../scripts/api/public-api.js"), "utf8");

test("public API keeps the agreed integration surface", () => {
  for (const method of [
    "isReady", "getAmbiences", "getAmbience", "getState", "exportAmbience", "importAmbience", "playAmbience", "stopAmbience",
    "requestAmbience", "releaseAmbience", "setMasterVolume", "setTrackVolume", "setTrackActive", "setTrackIntensity", "setState", "clearState", "getAmbiencesByKey", "getStateCatalog", "setStateByKey", "clearStateByKey", "setStateForActiveAmbiences", "clearStateForActiveAmbiences", "previewAudio", "previewLoop", "previewRandom", "previewSequence", "previewIntensity", "setPreviewIntensity", "stopPreview", "getSceneEmitters", "getSceneEmitter", "createSceneEmitter", "updateSceneEmitter", "setSceneEmitterEnabled", "deleteSceneEmitter", "previewSceneEmitter", "stopSceneEmitterPreview", "stopAll"
  ]) {
    assert.match(source, new RegExp(`\\b${method}\\b`));
  }
});


test("semantic state discovery capabilities are advertised", () => {
  assert.match(source, /state-discovery-v1/);
  assert.match(source, /semantic-state-control-v1/);
});
