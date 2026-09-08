import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(new URL("../scripts/ui/ambience-manager.js", import.meta.url), "utf8");
const controls = fs.readFileSync(new URL("../scripts/ui/scene-controls.js", import.meta.url), "utf8");

test("ambience manager and ambience editor use one persistent ApplicationV2 instead of DialogV2 submit routing", () => {
  assert.match(source, /const ApplicationV2 = foundry\.applications\.api\.ApplicationV2/);
  assert.match(source, /class AmbienceForgeManagerApp extends ApplicationV2/);
  assert.match(source, /showManager\(/);
  assert.match(source, /showEditor\(/);
  const beforeAudioEditor = source.slice(0, source.indexOf("function audioSourceControl"));
  assert.doesNotMatch(beforeAudioEditor, /new DialogV2\(/);
});

test("ApplicationV2 rendering replaces its content with generated DOM", () => {
  assert.match(source, /async _renderHTML\(\)/);
  assert.match(source, /_replaceHTML\(result, content\)/);
  assert.match(source, /content\.replaceChildren\(result\)/);
});

test("audio track editor has an inline audio picker icon and updates the source field directly", () => {
  assert.match(source, /data-af-audio-browse/);
  assert.match(source, /fa-solid fa-folder-open/);
  assert.match(source, /field: source/);
  assert.match(source, /callback: \(path\) => \{[\s\S]*source\.value = String\(path/);
  assert.match(source, /this\.api\.previewAudio\(track\)/);
  assert.match(source, /name="repeat"|checkbox\("repeat"/);
});

test("audio track preview stays inside the persistent ApplicationV2 and does not recreate the editor", () => {
  assert.match(source, /this\.mode = "audio-track"/);
  assert.match(source, /#audioTrackAction\(action\)/);
  const audioAction = source.slice(source.indexOf("async #audioTrackAction"), source.indexOf("#bindEditor"));
  assert.doesNotMatch(audioAction, /openAudioTrackEditor/);
  assert.doesNotMatch(audioAction, /render\(true\)/);
});

test("scene controls expose the current manager", () => {
  assert.match(controls, /ambience-manager\.js/);
  assert.match(controls, /manager: \{/);
  assert.match(controls, /onChange: \(\) => openAmbienceManager\(api\)/);
});

test("random track editor runs inside the persistent ApplicationV2", () => {
  assert.match(source, /this\.mode = "random-track"/);
  assert.match(source, /showRandomTrack\(/);
  assert.match(source, /#bindRandomTrack\(\)/);
  assert.match(source, /#randomTrackAction\(action\)/);
  assert.match(source, /data-af-random-action/);
  assert.match(source, /this\.api\.previewRandom\(track\)/);
});

test("random source picking and preview preserve the current editor instead of recreating it", () => {
  const start = source.indexOf("async #randomTrackAction");
  const randomAction = source.slice(start, source.indexOf("#bindEditor", start));
  assert.match(randomAction, /new FilePicker\(\{[\s\S]*type: "audio"/);
  assert.match(randomAction, /this\.trackDraft = cloneData\(\{ \.\.\.this\.trackDraft, sources \}\)/);
  assert.match(randomAction, /list\.append\(option\)/);
  assert.doesNotMatch(randomAction, /openRandomTrackEditor/);
  assert.doesNotMatch(randomAction, /this\.render\(true\)/);
  assert.doesNotMatch(randomAction, /this\.close\(/);
});


test("sequence track editor runs inside the persistent ApplicationV2", () => {
  assert.match(source, /this\.mode = "sequence-track"/);
  assert.match(source, /showSequenceTrack\(/);
  assert.match(source, /#bindSequenceTrack\(\)/);
  assert.match(source, /#sequenceTrackAction\(action\)/);
  assert.match(source, /data-af-sequence-action/);
  assert.match(source, /this\.api\.previewSequence\(track\)/);
  assert.match(source, /editorActionButton\("add-sequence"/);
});

test("sequence file picking and preview do not rebuild the editor", () => {
  const start = source.indexOf("async #sequenceTrackAction");
  const sequenceAction = source.slice(start, source.indexOf("#bindEditor", start));
  assert.match(sequenceAction, /new FilePicker\(\{[\s\S]*type: "audio"/);
  assert.doesNotMatch(sequenceAction, /this\.render\(true\)/);
  assert.doesNotMatch(sequenceAction, /this\.close\(/);
});


test("volume controls are sliders and the manager exposes live master volume", () => {
  assert.match(source, /type: "range"/);
  assert.match(source, /data-af-volume-slider/);
  assert.match(source, /masterVolumePercent/);
  assert.match(source, /liveMasterVolumePercent/);
  assert.match(source, /this\.api\.setMasterVolume/);
});


test("intensity track editor and live runtime controls are exposed", () => {
  assert.match(source, /this\.mode = "intensity-track"/);
  assert.match(source, /showIntensityTrack\(/);
  assert.match(source, /#bindIntensityTrack\(\)/);
  assert.match(source, /#intensityTrackAction\(action\)/);
  assert.match(source, /data-af-intensity-action/);
  assert.match(source, /editorActionButton\("add-intensity"/);
  assert.match(source, /this\.api\.previewIntensity\(track\)/);
  assert.match(source, /this\.api\.setPreviewIntensity/);
  assert.match(source, /data-af-live-intensity-track/);
  assert.match(source, /this\.api\.setTrackIntensity/);
});

test("ambience editor exposes the state manager as a focused composition tool", () => {
  assert.match(source, /openStateManager/);
  assert.match(source, /editorActionButton\("states"/);
  assert.match(source, /action === "states"/);
});
