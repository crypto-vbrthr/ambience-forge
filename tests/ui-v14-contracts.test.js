import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { registerSceneControls } from "../scripts/ui/scene-controls.js";

const status = fs.readFileSync(new URL("../scripts/ui/status-dialog.js", import.meta.url), "utf8");
const controlsSource = fs.readFileSync(new URL("../scripts/ui/scene-controls.js", import.meta.url), "utf8");

test("DialogV2 trusted content uses a plain outer div", () => {
  assert.match(status, /const root = element\("div"\);/);
  assert.match(status, /const content = element\("div", \{ className: "ambience-forge-status" \}\);/);
  assert.doesNotMatch(status, /const root = element\("div", \{ className:/);
});

test("custom Scene Control has a valid hidden active tool for button actions", () => {
  assert.match(controlsSource, /activeTool: ANCHOR_TOOL/);
  assert.match(controlsSource, /visible: false/);
  assert.match(controlsSource, /button: false/);
  assert.match(controlsSource, /onChange: \(\) => \{\}/);
});

test("every Scene Control tool record key exactly matches tool.name", () => {
  const previousGame = globalThis.game;
  globalThis.game = { user: { isGM: true } };
  try {
    const controls = {};
    const api = {
      getState: () => ({ activeAmbienceIds: [] }),
      stopAmbience: async () => false,
      stopAll: async () => undefined
    };

    registerSceneControls(controls, api);
    const tools = controls["ambience-forge"].tools;
    for (const [key, tool] of Object.entries(tools)) {
      assert.equal(key, tool.name, `Scene Control tool key '${key}' must match tool.name '${tool.name}'`);
    }
  } finally {
    globalThis.game = previousGame;
  }
});
