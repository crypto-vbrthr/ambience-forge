import { MODULE_ID } from "../constants.js";
import { openEmitterEditor } from "./emitter-manager-alpha22.js";

function canvasView() {
  return globalThis.canvas?.app?.canvas
    ?? globalThis.canvas?.app?.view
    ?? document.querySelector?.("#board canvas")
    ?? null;
}

function sceneToClient(x, y) {
  const stage = globalThis.canvas?.stage;
  const view = canvasView();
  const transform = stage?.worldTransform;
  if (!stage || !view || !transform?.apply) return null;
  try {
    const point = transform.apply({ x: Number(x) || 0, y: Number(y) || 0 }, { x: 0, y: 0 });
    const rect = view.getBoundingClientRect();
    return {
      x: rect.left + point.x,
      y: rect.top + point.y,
      visible: point.x >= 0 && point.y >= 0 && point.x <= rect.width && point.y <= rect.height
    };
  } catch {
    return null;
  }
}

function iconButton({ action, emitterId, icon, label }) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `ambience-forge-emitter-marker-${action}`;
  button.dataset.afEmitterMarkerAction = action;
  button.dataset.emitterId = emitterId;
  button.setAttribute("aria-label", label);
  button.title = label;
  const i = document.createElement("i");
  i.className = icon;
  i.setAttribute("aria-hidden", "true");
  button.append(i);
  return button;
}

class EmitterOverlay {
  constructor(api) {
    this.api = api;
    this.root = null;
    this.markers = new Map();
    this._resize = () => this.refreshPositions();
  }

  mount() {
    if (!globalThis.game?.user?.isGM || !globalThis.canvas?.ready) return;
    if (!this.root?.isConnected) {
      this.root = document.createElement("div");
      this.root.id = "ambience-forge-emitter-overlay";
      this.root.className = "ambience-forge-emitter-overlay";
      this.root.dataset.moduleId = MODULE_ID;
      document.body.append(this.root);
      globalThis.addEventListener?.("resize", this._resize);
    }
    this.refresh();
  }

  unmount() {
    globalThis.removeEventListener?.("resize", this._resize);
    this.root?.remove();
    this.root = null;
    this.markers.clear();
  }

  refresh() {
    if (!globalThis.game?.user?.isGM || !globalThis.canvas?.ready || !globalThis.canvas?.scene) {
      this.unmount();
      return;
    }
    if (!this.root?.isConnected) return this.mount();

    const emitters = this.api.getSceneEmitters?.() ?? [];
    const present = new Set(emitters.map((emitter) => emitter.id));
    for (const [id, marker] of this.markers) {
      if (!present.has(id)) {
        marker.remove();
        this.markers.delete(id);
      }
    }

    for (const emitter of emitters) {
      let marker = this.markers.get(emitter.id);
      if (!marker) {
        marker = this.#createMarker(emitter);
        this.markers.set(emitter.id, marker);
        this.root.append(marker);
      }
      this.#updateMarker(marker, emitter);
    }
    this.refreshPositions();
  }

  refreshPositions() {
    if (!this.root?.isConnected) return;
    const byId = new Map((this.api.getSceneEmitters?.() ?? []).map((emitter) => [emitter.id, emitter]));
    for (const [id, marker] of this.markers) {
      const emitter = byId.get(id);
      if (!emitter) continue;
      const point = sceneToClient(emitter.x, emitter.y);
      if (!point) {
        marker.hidden = true;
        continue;
      }
      marker.hidden = !point.visible;
      marker.style.left = `${Math.round(point.x)}px`;
      marker.style.top = `${Math.round(point.y)}px`;
    }
  }

  #createMarker(emitter) {
    const marker = document.createElement("div");
    marker.className = "ambience-forge-emitter-marker";
    marker.dataset.emitterId = emitter.id;

    for (const eventName of ["pointerdown", "mousedown", "mouseup", "click", "dblclick", "contextmenu"]) {
      marker.addEventListener(eventName, (event) => event.stopPropagation());
    }

    marker.addEventListener("click", (event) => {
      const button = event.target.closest?.("[data-af-emitter-marker-action]");
      if (!button) return;
      void this.#action(button.dataset.afEmitterMarkerAction, button.dataset.emitterId);
    });

    const label = document.createElement("span");
    label.className = "ambience-forge-emitter-marker-label";
    marker.append(label);
    return marker;
  }

  #updateMarker(marker, emitter) {
    marker.dataset.enabled = emitter.enabled === false ? "false" : "true";
    marker.replaceChildren();

    const name = emitter.name || emitter.ambienceId;
    const enabled = emitter.enabled !== false;
    const editLabel = game.i18n.format("AMBIENCE_FORGE.Emitter.MarkerEdit", { name });
    const toggleLabel = game.i18n.format(
      enabled ? "AMBIENCE_FORGE.Emitter.MarkerDisable" : "AMBIENCE_FORGE.Emitter.MarkerEnable",
      { name }
    );

    const main = iconButton({
      action: "edit",
      emitterId: emitter.id,
      icon: enabled ? "fa-solid fa-volume-high" : "fa-solid fa-volume-xmark",
      label: editLabel
    });
    main.classList.add("ambience-forge-emitter-marker-main");

    const actions = document.createElement("span");
    actions.className = "ambience-forge-emitter-marker-actions";
    actions.append(
      iconButton({ action: "edit", emitterId: emitter.id, icon: "fa-solid fa-pen", label: editLabel }),
      iconButton({
        action: "toggle",
        emitterId: emitter.id,
        icon: enabled ? "fa-solid fa-power-off" : "fa-solid fa-play",
        label: toggleLabel
      })
    );

    const label = document.createElement("span");
    label.className = "ambience-forge-emitter-marker-label";
    label.textContent = enabled
      ? name
      : game.i18n.format("AMBIENCE_FORGE.Emitter.MarkerDisabledName", { name });

    marker.append(main, actions, label);
  }

  async #action(action, emitterId) {
    if (!emitterId) return;
    if (action === "edit") {
      openEmitterEditor(this.api, emitterId);
      return;
    }
    if (action === "toggle") {
      const emitter = this.api.getSceneEmitter?.(emitterId);
      if (!emitter) return;
      await this.api.setSceneEmitterEnabled(emitterId, emitter.enabled === false);
      this.refresh();
    }
  }
}

let overlay = null;

export function registerEmitterOverlay(api) {
  overlay = new EmitterOverlay(api);

  Hooks.on("canvasReady", () => overlay?.mount());
  Hooks.on("canvasTearDown", () => overlay?.unmount());
  Hooks.on("canvasPan", () => overlay?.refreshPositions());

  for (const hook of ["createAmbientSound", "updateAmbientSound", "deleteAmbientSound"]) {
    Hooks.on(hook, () => overlay?.refresh());
  }

  if (globalThis.canvas?.ready) overlay.mount();
  return overlay;
}

export function refreshEmitterOverlay() {
  overlay?.refresh();
}
