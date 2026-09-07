import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { registerSceneControls } from "../scripts/ui/scene-controls-alpha13.js";

const controlsSource = fs.readFileSync(new URL("../scripts/ui/scene-controls-alpha13.js", import.meta.url), "utf8");

test("scene control tool record keys match their names", () => {
  globalThis.game = { user: { isGM: true } };
  const controls = {};
  registerSceneControls(controls, {});
  const tools = controls["ambience-forge"].tools;
  for (const [key, tool] of Object.entries(tools)) assert.equal(key, tool.name);
  delete globalThis.game;
});

test("scene controls keep a hidden active anchor for Foundry V14 button controls", () => {
  assert.match(controlsSource, /activeTool: ANCHOR_TOOL/);
  assert.match(controlsSource, /visible: false/);
  assert.match(controlsSource, /button: false/);
});
