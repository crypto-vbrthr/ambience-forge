import { MODULE_ID } from "./constants.js";
import { registerSettings } from "./settings.js";
import { FoundryWorldStore } from "./data/foundry-world-store.js";
import { FoundryAudioBackend } from "./audio/foundry-audio-backend.js";
import { AmbienceService } from "./core/ambience-service.js";
import { createPublicApi } from "./api/public-api.js";
import { registerSocketListener } from "./socket.js";
import { registerSceneControls } from "./ui/scene-controls-alpha17.js";

let service = null;
let api = null;

Hooks.once("init", () => {
  registerSettings();
  const module = game.modules.get(MODULE_ID);
  api = createPublicApi({
    getService: () => service,
    getModuleVersion: () => module?.version ?? "0.0.0"
  });
  if (module) module.api = api;

  Hooks.on("getSceneControlButtons", (controls) => registerSceneControls(controls, api));
});

Hooks.once("ready", async () => {
  const moduleVersion = game.modules.get(MODULE_ID)?.version ?? "0.0.0";
  service = new AmbienceService({
    store: new FoundryWorldStore(),
    backend: new FoundryAudioBackend(),
    moduleVersion
  });
  await service.initialize();
  registerSocketListener(() => service);
  Hooks.callAll("ambienceForgeReady", api);
  console.info(`${MODULE_ID} | ${game.i18n.localize("AMBIENCE_FORGE.Console.Ready")}`);
});
