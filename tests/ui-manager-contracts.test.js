import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(new URL("../scripts/ui/ambience-manager-alpha9.js", import.meta.url), "utf8");
const controls = fs.readFileSync(new URL("../scripts/ui/scene-controls-alpha9.js", import.meta.url), "utf8");

test("ambience manager and ambience editor use one persistent ApplicationV2 instead of DialogV2 submit routing", () => {
  assert.match(source, /const ApplicationV2 = foundry\.applications\.api\.ApplicationV2/);
  assert.match(source, /class AmbienceForgeManagerApp extends ApplicationV2/);
  assert.match(source, /showManager\(/);
  assert.match(source, /showEditor\(/);
  const beforeLoopEditor = source.slice(0, source.indexOf("function loopTrackContent"));
  assert.doesNotMatch(beforeLoopEditor, /new DialogV2\(/);
});

test("ApplicationV2 rendering replaces its content with generated DOM", () => {
  assert.match(source, /async _renderHTML\(\)/);
  assert.match(source, /_replaceHTML\(result, content\)/);
  assert.match(source, /content\.replaceChildren\(result\)/);
});

test("loop editor still uses Foundry V14 audio FilePicker and preview API", () => {
  assert.match(source, /new FilePicker\(\{[\s\S]*type: "audio"/);
  assert.match(source, /api\.previewLoop\(result\.track\)/);
  assert.match(source, /api\.stopPreview\(\)/);
});

test("scene controls expose the alpha9 manager", () => {
  assert.match(controls, /ambience-manager-alpha9\.js/);
  assert.match(controls, /manager: \{/);
  assert.match(controls, /onChange: \(\) => openAmbienceManager\(api\)/);
});
