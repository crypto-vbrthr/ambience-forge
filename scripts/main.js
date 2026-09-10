import { MODULE_ID } from "./constants.js";
import { registerSettings } from "./settings.js";
import { FoundryWorldStore } from "./data/foundry-world-store.js";
import { FoundryAudioBackend } from "./audio/foundry-audio-backend.js";
import { AmbienceService } from "./core/ambience-service.js";
import { createPublicApi } from "./api/public-api.js";
import { registerSocketListener } from "./socket.js";
import { SceneEmitterService, registerEmitterHooks } from "./scene/scene-emitter-service.js";
import { registerSceneControls } from "./ui/scene-controls.js";
import { registerEmitterOverlay } from "./ui/emitter-overlay.js";

let service = null;
let emitterService = null;
let api = null;

Hooks.once("init", () => {
  registerSettings({
    onAmbiencesChanged: async () => {
      if (!service) return;
      await service.reloadFromStore();
    }
  });

  const module = game.modules.get(MODULE_ID);
  api = createPublicApi({
    getService: () => service,
    getEmitterService: () => emitterService,
    getModuleVersion: () => module?.version ?? "0.0.0"
  });
  if (module) module.api = api;

  Hooks.on("getSceneControlButtons", (controls) => registerSceneControls(controls, api));
  registerEmitterHooks(() => emitterService);
});

Hooks.once("ready", async () => {
  const moduleVersion = game.modules.get(MODULE_ID)?.version ?? "0.0.0";
  const backend = new FoundryAudioBackend();
  service = new AmbienceService({
    store: new FoundryWorldStore(),
    backend,
    moduleVersion,
    onLibraryChanged: async () => {
      if (emitterService) await emitterService.tick();
    }
  });
  await service.initialize();

  emitterService = new SceneEmitterService({
    getAmbienceService: () => service,
    backend
  });
  if (canvas?.ready && canvas?.scene) await emitterService.activateScene(canvas.scene);
  registerEmitterOverlay(api);

  registerSocketListener(() => service, () => emitterService);
  Hooks.callAll("ambienceForgeReady", api);
  console.info(`${MODULE_ID} | ${game.i18n.localize("AMBIENCE_FORGE.Console.Ready")}`);
});
