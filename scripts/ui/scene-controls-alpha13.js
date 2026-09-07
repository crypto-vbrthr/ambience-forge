import { MODULE_ID } from "../constants.js";
import { openAmbienceManager } from "./ambience-manager-alpha13.js";
import { notifyStopped, openStatusDialog } from "./status-dialog.js";

const ANCHOR_TOOL = "__ambience-forge-anchor";

/**
 * Foundry's SceneControls expects a control with button-only tools to still
 * have a valid activeTool when it processes a button click. A hidden,
 * non-interactive anchor keeps that state valid without adding UI clutter.
 */
function anchorTool() {
  return {
    name: ANCHOR_TOOL,
    title: "AMBIENCE_FORGE.Controls.Title",
    icon: "fa-solid fa-wave-square",
    order: -1000,
    visible: false,
    active: true,
    button: false,
    interaction: false,
    control: false,
    creation: false,
    onChange: () => {}
  };
}

export function registerSceneControls(controls, api) {
  if (!game.user?.isGM) return;

  controls[MODULE_ID] = {
    name: MODULE_ID,
    title: "AMBIENCE_FORGE.Controls.Title",
    icon: "fa-solid fa-wave-square",
    order: 85,
    visible: true,
    activeTool: ANCHOR_TOOL,
    tools: {
      [ANCHOR_TOOL]: anchorTool(),
      manager: {
        name: "manager",
        title: "AMBIENCE_FORGE.Controls.Manager",
        icon: "fa-solid fa-sliders",
        order: 0,
        button: true,
        onChange: () => openAmbienceManager(api)
      },
      status: {
        name: "status",
        title: "AMBIENCE_FORGE.Controls.Status",
        icon: "fa-solid fa-circle-info",
        order: 5,
        button: true,
        onChange: () => openStatusDialog(api)
      },
      ["stop-active"]: {
        name: "stop-active",
        title: "AMBIENCE_FORGE.Controls.StopActive",
        icon: "fa-solid fa-stop",
        order: 10,
        button: true,
        onChange: async () => {
          const active = api.getState().activeAmbienceIds;
          for (const ambienceId of active) await api.stopAmbience(ambienceId);
          notifyStopped();
        }
      },
      ["stop-all"]: {
        name: "stop-all",
        title: "AMBIENCE_FORGE.Controls.StopAll",
        icon: "fa-solid fa-ban",
        order: 20,
        button: true,
        onChange: async () => {
          await api.stopAll();
          notifyStopped();
        }
      }
    }
  };
}
