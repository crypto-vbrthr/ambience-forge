import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const manager = fs.readFileSync(new URL("../scripts/ui/emitter-manager-alpha22.js", import.meta.url), "utf8");
const controls = fs.readFileSync(new URL("../scripts/ui/scene-controls-alpha22.js", import.meta.url), "utf8");
const service = fs.readFileSync(new URL("../scripts/scene/scene-emitter-service-alpha22.js", import.meta.url), "utf8");
const overlay = fs.readFileSync(new URL("../scripts/ui/emitter-overlay-alpha28.js", import.meta.url), "utf8");

test("Scene Controls expose the Scene Emitter manager", () => {
  assert.match(controls, /emitter-manager-alpha22\.js/);
  assert.match(controls, /emitters: \{/);
  assert.match(controls, /onChange: \(\) => openEmitterManager\(api\)/);
});

test("Emitter manager is persistent ApplicationV2 with placement and live preview", () => {
  assert.match(manager, /class AmbienceForgeEmitterManager extends ApplicationV2/);
  assert.match(manager, /pick-position/);
  assert.match(manager, /canvasPositionFromEvent/);
  assert.match(manager, /previewSceneEmitter/);
  assert.match(manager, /deleteSceneEmitter/);
});

test("Scene emitters use Foundry AmbientSound documents as silent spatial proxies", () => {
  assert.match(service, /createEmbeddedDocuments\("AmbientSound"/);
  assert.match(service, /SILENCE_PATH/);
  assert.match(service, /radius: emitter\.radius/);
  assert.match(service, /easing: emitter\.easing/);
  assert.match(service, /walls: false/);
});


test("Emitter overlay dedicates the main marker to left-button dragging and keeps editing on its explicit button", () => {
  const mainStart = overlay.indexOf('main.on("pointerdown"');
  const editStart = overlay.indexOf('const edit = makeActionButton');
  const mainBlock = overlay.slice(mainStart, editStart);
  assert.match(mainBlock, /#dragStart/);
  assert.doesNotMatch(mainBlock, /pointertap/);
  assert.doesNotMatch(mainBlock, /openEmitterEditor/);
  assert.match(overlay, /edit\.on\("pointertap"/);
  assert.match(overlay, /Math\.hypot/);
  assert.match(overlay, /distance < 4/);
  assert.match(overlay, /updateSceneEmitter\(drag\.emitterId, \{ x: drag\.x, y: drag\.y \}\)/);
});
