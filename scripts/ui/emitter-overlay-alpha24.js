import { MODULE_ID } from "../constants.js";
import { openEmitterEditor } from "./emitter-manager-alpha22.js";

function sceneToClient(x, y) {
  const foundryCanvas = globalThis.canvas;
  if (!foundryCanvas?.ready || typeof foundryCanvas.clientCoordinatesFromCanvas !== "function") return null;
  try {
    const point = foundryCanvas.clientCoordinatesFromCanvas({
      x: Number(x) || 0,
      y: Number(y) || 0
    });
    if (!Number.isFinite(point?.x) || !Number.isFinite(point?.y)) return null;
    return {
      x: point.x,
      y: point.y,
      visible: point.x >= 0 && point.y >= 0
        && point.x <= globalThis.innerWidth
        && point.y <= globalThis.innerHeight
    };
  } catch {
    return null;
  }
}

function clientToScene(clientX, clientY) {
  const foundryCanvas = globalThis.canvas;
  if (!foundryCanvas?.ready || typeof foundryCanvas.canvasCoordinatesFromClient !== "function") return null;
  try {
    const point = foundryCanvas.canvasCoordinatesFromClient({
      x: Number(clientX) || 0,
      y: Number(clientY) || 0
    });
    if (!Number.isFinite(point?.x) || !Number.isFinite(point?.y)) return null;
    return { x: point.x, y: point.y };
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
    this.drag = null;
    this._resize = () => this.refreshPositions();
    this._dragMove = (event) => this.#dragMove(event);
    this._dragEnd = (event) => { void this.#dragEnd(event); };
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
    this.#removeDragListeners();
    this.drag = null;
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

    marker.addEventListener("pointerdown", (event) => {
      const main = event.target.closest?.(".ambience-forge-emitter-marker-main");
      if (!main || event.button !== 0) return;
      this.#dragStart(event, emitter.id, marker);
    });

    marker.addEventListener("click", (event) => {
      if (marker.dataset.suppressClick === "true") {
        event.preventDefault();
        return;
      }
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
    const mainLabel = game.i18n.format("AMBIENCE_FORGE.Emitter.MarkerMain", { name });
    const toggleLabel = game.i18n.format(
      enabled ? "AMBIENCE_FORGE.Emitter.MarkerDisable" : "AMBIENCE_FORGE.Emitter.MarkerEnable",
      { name }
    );

    const main = iconButton({
      action: "edit",
      emitterId: emitter.id,
      icon: enabled ? "fa-solid fa-volume-high" : "fa-solid fa-volume-xmark",
      label: mainLabel
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

  #dragStart(event, emitterId, marker) {
    const emitter = this.api.getSceneEmitter?.(emitterId);
    const pointer = clientToScene(event.clientX, event.clientY);
    if (!emitter || !pointer) return;

    event.preventDefault();
    const pointerId = event.pointerId;
    try { event.currentTarget?.setPointerCapture?.(pointerId); } catch {}

    this.drag = {
      emitterId,
      marker,
      pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      offsetX: Number(emitter.x) - pointer.x,
      offsetY: Number(emitter.y) - pointer.y,
      x: Number(emitter.x),
      y: Number(emitter.y),
      moved: false
    };
    marker.dataset.dragging = "true";
    globalThis.addEventListener?.("pointermove", this._dragMove, { passive: false });
    globalThis.addEventListener?.("pointerup", this._dragEnd, { passive: false });
    globalThis.addEventListener?.("pointercancel", this._dragEnd, { passive: false });
  }

  #dragMove(event) {
    const drag = this.drag;
    if (!drag || (drag.pointerId != null && event.pointerId !== drag.pointerId)) return;
    const pointer = clientToScene(event.clientX, event.clientY);
    if (!pointer) return;

    const distance = Math.hypot(event.clientX - drag.startClientX, event.clientY - drag.startClientY);
    if (!drag.moved && distance < 4) return;
    drag.moved = true;
    event.preventDefault();

    drag.x = pointer.x + drag.offsetX;
    drag.y = pointer.y + drag.offsetY;
    const point = sceneToClient(drag.x, drag.y);
    if (point) {
      drag.marker.hidden = false;
      drag.marker.style.left = `${Math.round(point.x)}px`;
      drag.marker.style.top = `${Math.round(point.y)}px`;
    }
  }

  async #dragEnd(event) {
    const drag = this.drag;
    if (!drag || (drag.pointerId != null && event.pointerId !== drag.pointerId)) return;
    this.#removeDragListeners();
    this.drag = null;
    delete drag.marker.dataset.dragging;

    if (!drag.moved) return;
    event.preventDefault();
    drag.marker.dataset.suppressClick = "true";
    globalThis.setTimeout?.(() => {
      if (drag.marker?.dataset) delete drag.marker.dataset.suppressClick;
    }, 0);

    try {
      await this.api.updateSceneEmitter(drag.emitterId, { x: drag.x, y: drag.y });
    } finally {
      this.refresh();
    }
  }

  #removeDragListeners() {
    globalThis.removeEventListener?.("pointermove", this._dragMove);
    globalThis.removeEventListener?.("pointerup", this._dragEnd);
    globalThis.removeEventListener?.("pointercancel", this._dragEnd);
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
