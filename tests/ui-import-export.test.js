import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const manager = fs.readFileSync(new URL("../scripts/ui/ambience-manager-alpha30.js", import.meta.url), "utf8");
const controls = fs.readFileSync(new URL("../scripts/ui/scene-controls-alpha30.js", import.meta.url), "utf8");
const main = fs.readFileSync(new URL("../scripts/main-alpha30.js", import.meta.url), "utf8");

test("manager exposes import and export as ordinary persistent ApplicationV2 actions", () => {
  assert.match(manager, /managerActionButton\("import"/);
  assert.match(manager, /managerActionButton\("export"/);
  assert.match(manager, /this\.api\.importAmbience\(envelope\)/);
  assert.match(manager, /this\.api\.exportAmbience\(selectedId\)/);
  assert.match(manager, /type = "file"/);
  assert.match(manager, /accept = "\.json,application\/json"/);
  assert.match(manager, /foundry\?\.utils\?\.saveDataToFile/);
  assert.doesNotMatch(manager, /new Blob\(/);
  assert.doesNotMatch(manager, /URL\.createObjectURL/);
});

test("import does not require a selected ambience while export does", () => {
  const actionStart = manager.indexOf("async #managerAction");
  const action = manager.slice(actionStart, manager.indexOf("#bindAudioTrack", actionStart));
  assert.ok(action.indexOf('action === "import"') < action.indexOf("requireSelection(selectedId)"));
  assert.ok(action.indexOf('action === "export"') > action.indexOf("requireSelection(selectedId)"));
});

test("current scene controls and main entry point use alpha.30 manager path", () => {
  assert.match(controls, /ambience-manager-alpha30\.js/);
  assert.match(main, /scene-controls-alpha30\.js/);
});
