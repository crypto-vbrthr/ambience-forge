import test from "node:test";
import assert from "node:assert/strict";
import { registerSettings } from "../../scripts/settings.js";
import { MODULE_ID, SETTING_AMBIENCES } from "../../scripts/constants.js";

test("world ambience setting invokes the reload callback when another client changes it", async () => {
  let registration = null;
  let reloads = 0;
  globalThis.game = {
    settings: {
      register(moduleId, key, config) { registration = { moduleId, key, config }; }
    }
  };
  try {
    registerSettings({ onAmbiencesChanged: async () => { reloads += 1; } });
    assert.equal(registration.moduleId, MODULE_ID);
    assert.equal(registration.key, SETTING_AMBIENCES);
    assert.equal(registration.config.scope, "world");
    registration.config.onChange();
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(reloads, 1);
  } finally {
    delete globalThis.game;
  }
});
