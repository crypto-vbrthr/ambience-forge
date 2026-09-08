import { openEmitterEditor } from "./emitter-manager-alpha22.js";

const MARKER_RADIUS = 16;
const ACTION_RADIUS = 12;

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

function makeCircleButton({ radius, x = 0, y = 0, alpha = 1 }) {
  const PIXI = globalThis.PIXI;
  const button = new PIXI.Container();
  button.position.set(x, y);
  button.interactive = true;
  button.buttonMode = true;

  const circle = new PIXI.Graphics();
  circle.lineStyle(2, 0xd8c8a8, 0.95);
  circle.beginFill(0x171717, 0.92);
  circle.drawCircle(0, 0, radius);
  circle.endFill();
  circle.alpha = alpha;
  button.addChild(circle);
  button.hitArea = new PIXI.Circle(0, 0, radius + 2);
  return { button, circle };
}

function drawSpeakerIcon(enabled) {
  const PIXI = globalThis.PIXI;
  const icon = new PIXI.Graphics();
  const color = 0xf4eee2;
  icon.beginFill(color, enabled ? 1 : 0.65);
  icon.drawRect(-9, -4, 5, 8);
  icon.drawPolygon([-4, -4, 3, -10, 3, 10, -4, 4]);
  icon.endFill();

  icon.lineStyle(2, color, enabled ? 1 : 0.65);
  if (enabled) {
    icon.arc(3, 0, 7, -0.72, 0.72);
    icon.arc(3, 0, 11, -0.72, 0.72);
  } else {
    icon.moveTo(7, -7);
    icon.lineTo(15, 7);
    icon.moveTo(15, -7);
    icon.lineTo(7, 7);
  }
  return icon;
}

function makeActionButton({ x, glyph, label }) {
  const PIXI = globalThis.PIXI;
  const { button } = makeCircleButton({ radius: ACTION_RADIUS, x });
  button.accessible = true;
  button.accessibleTitle = label;
  button.cursor = "pointer";

  const text = new PIXI.Text(glyph, new PIXI.TextStyle({
    fontFamily: "Arial, sans-serif",
    fontSize: 15,
    fill: 0xf4eee2,
    fontWeight: "bold",
    align: "center"
  }));
  text.anchor.set(0.5);
  text.y = -1;
  button.addChild(text);
  return button;
}

function makeLabel(text) {
  const PIXI = globalThis.PIXI;
  const container = new PIXI.Container();
  const label = new PIXI.Text(text, new PIXI.TextStyle({
    fontFamily: "Arial, sans-serif",
    fontSize: 12,
    fill: 0xffffff,
    align: "center"
  }));
  label.anchor.set(0.5, 0);
  label.position.set(0, MARKER_RADIUS + 7);

  const paddingX = 7;
  const paddingY = 4;
  const bg = new PIXI.Graphics();
  bg.beginFill(0x000000, 0.76);
  bg.drawRoundedRect(
    -(label.width / 2) - paddingX,
    MARKER_RADIUS + 4,
    label.width + (paddingX * 2),
    label.height + (paddingY * 2),
    3
  );
  bg.endFill();
  container.addChild(bg, label);
  return container;
}

class EmitterCanvasOverlay {
  constructor(api) {
    this.api = api;
    this.root = null;
    this.markers = new Map();
    this.drag = null;
    this._dragMove = (event) => this.#dragMove(event);
    this._dragEnd = (event) => { void this.#dragEnd(event); };
  }

  mount() {
    if (!globalThis.game?.user?.isGM || !globalThis.canvas?.ready || !globalThis.PIXI) return;
    const canvasInterface = globalThis.canvas?.interface;
    if (!canvasInterface) return;

    if (!this.root || this.root.destroyed || this.root.parent !== canvasInterface) {
      this.unmount();
      this.root = new globalThis.PIXI.Container();
      this.root.name = "AmbienceForgeEmitterOverlay";
      this.root.sortableChildren = true;
      this.root.zIndex = 999999;
      canvasInterface.sortableChildren = true;
      canvasInterface.addChild(this.root);
    }
    this.refresh();
  }

  unmount() {
    this.#removeDragListeners();
    this.drag = null;
    if (this.root && !this.root.destroyed) {
      this.root.parent?.removeChild?.(this.root);
      this.root.destroy({ children: true });
    }
    this.root = null;
    this.markers.clear();
  }

  refresh() {
    if (!globalThis.game?.user?.isGM || !globalThis.canvas?.ready || !globalThis.canvas?.scene) {
      this.unmount();
      return;
    }
    if (!this.root || this.root.destroyed || this.root.parent !== globalThis.canvas?.interface) {
      this.mount();
      return;
    }

    const emitters = this.api.getSceneEmitters?.() ?? [];
    const present = new Set(emitters.map((emitter) => emitter.id));
    for (const [id, marker] of this.markers) {
      if (!present.has(id)) {
        marker.parent?.removeChild?.(marker);
        marker.destroy({ children: true });
        this.markers.delete(id);
      }
    }

    for (const emitter of emitters) {
      let marker = this.markers.get(emitter.id);
      if (!marker) {
        marker = this.#createMarker(emitter);
        this.markers.set(emitter.id, marker);
        this.root.addChild(marker);
      }
      this.#updateMarker(marker, emitter);
    }
    this.refreshPositions();
  }

  refreshPositions() {
    if (!this.root || this.root.destroyed) return;
    const byId = new Map((this.api.getSceneEmitters?.() ?? []).map((emitter) => [emitter.id, emitter]));
    const zoom = Math.max(0.01, Number(globalThis.canvas?.stage?.scale?.x) || 1);
    const inverseZoom = 1 / zoom;

    for (const [id, marker] of this.markers) {
      const emitter = byId.get(id);
      if (!emitter) continue;
      if (this.drag?.emitterId !== id) {
        marker.position.set(Number(emitter.x) || 0, Number(emitter.y) || 0);
      }
      // The marker is a real child of Foundry's InterfaceCanvasGroup, so its position
      // follows the Scene transform automatically. Only its visual size is compensated.
      marker.scale.set(inverseZoom);
    }
  }

  #createMarker(emitter) {
    const PIXI = globalThis.PIXI;
    const marker = new PIXI.Container();
    marker.name = `AmbienceForgeEmitter:${emitter.id}`;
    marker.zIndex = 999999;
    marker.interactiveChildren = true;
    marker._afEmitterId = emitter.id;
    marker._afSuppressClick = false;
    marker._afHovered = false;

    marker.on("pointerover", () => {
      marker._afHovered = true;
      this.#setExpanded(marker, true);
    });
    marker.on("pointerout", () => {
      marker._afHovered = false;
      if (!this.drag || this.drag.emitterId !== emitter.id) this.#setExpanded(marker, false);
    });

    return marker;
  }

  #updateMarker(marker, emitter) {
    marker.removeChildren().forEach((child) => child.destroy?.({ children: true }));
    marker._afEmitterId = emitter.id;

    const enabled = emitter.enabled !== false;
    const name = emitter.name || emitter.ambienceId;
    const editLabel = game.i18n.format("AMBIENCE_FORGE.Emitter.MarkerEdit", { name });
    const mainLabel = game.i18n.format("AMBIENCE_FORGE.Emitter.MarkerMain", { name });
    const toggleLabel = game.i18n.format(
      enabled ? "AMBIENCE_FORGE.Emitter.MarkerDisable" : "AMBIENCE_FORGE.Emitter.MarkerEnable",
      { name }
    );

    const { button: main, circle } = makeCircleButton({ radius: MARKER_RADIUS, alpha: enabled ? 1 : 0.58 });
    main.name = "main";
    main.accessible = true;
    main.accessibleTitle = mainLabel;
    main.cursor = "grab";
    circle.alpha = enabled ? 1 : 0.58;
    main.addChild(drawSpeakerIcon(enabled));
    main.on("pointerdown", (event) => {
      event.stopPropagation?.();
      const native = event?.data?.originalEvent ?? event?.nativeEvent;
      if ((native?.button ?? 0) !== 0) return;
      this.#dragStart(native ?? event, emitter.id, marker);
    });
    main.on("pointertap", (event) => {
      event.stopPropagation?.();
      if (marker._afSuppressClick) return;
      openEmitterEditor(this.api, emitter.id);
    });

    const edit = makeActionButton({ x: 31, glyph: "✎", label: editLabel });
    edit.name = "edit";
    edit.on("pointertap", (event) => {
      event.stopPropagation?.();
      openEmitterEditor(this.api, emitter.id);
    });

    const toggle = makeActionButton({ x: 59, glyph: enabled ? "⏻" : "▶", label: toggleLabel });
    toggle.name = "toggle";
    toggle.on("pointertap", (event) => {
      event.stopPropagation?.();
      void this.#toggle(emitter.id);
    });

    const labelText = enabled
      ? name
      : game.i18n.format("AMBIENCE_FORGE.Emitter.MarkerDisabledName", { name });
    const label = makeLabel(labelText);
    label.name = "label";

    marker.addChild(main, edit, toggle, label);
    this.#setExpanded(marker, marker._afHovered);
  }

  #setExpanded(marker, expanded) {
    const dragging = this.drag?.emitterId === marker._afEmitterId;
    for (const name of ["edit", "toggle", "label"]) {
      const child = marker.getChildByName?.(name);
      if (child) child.visible = Boolean(expanded && !dragging);
    }
  }

  #dragStart(event, emitterId, marker) {
    const emitter = this.api.getSceneEmitter?.(emitterId);
    const clientX = Number(event?.clientX);
    const clientY = Number(event?.clientY);
    const pointer = clientToScene(clientX, clientY);
    if (!emitter || !pointer) return;

    event.preventDefault?.();
    const pointerId = event.pointerId;
    this.drag = {
      emitterId,
      marker,
      pointerId,
      startClientX: clientX,
      startClientY: clientY,
      offsetX: Number(emitter.x) - pointer.x,
      offsetY: Number(emitter.y) - pointer.y,
      x: Number(emitter.x),
      y: Number(emitter.y),
      moved: false
    };
    marker.cursor = "grabbing";
    marker.getChildByName?.("main") && (marker.getChildByName("main").cursor = "grabbing");
    this.#setExpanded(marker, false);

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
    event.preventDefault?.();

    drag.x = pointer.x + drag.offsetX;
    drag.y = pointer.y + drag.offsetY;
    drag.marker.position.set(drag.x, drag.y);
  }

  async #dragEnd(event) {
    const drag = this.drag;
    if (!drag || (drag.pointerId != null && event.pointerId !== drag.pointerId)) return;
    this.#removeDragListeners();
    this.drag = null;
    const main = drag.marker.getChildByName?.("main");
    if (main) main.cursor = "grab";

    if (!drag.moved) {
      this.#setExpanded(drag.marker, drag.marker._afHovered);
      return;
    }

    event.preventDefault?.();
    drag.marker._afSuppressClick = true;
    globalThis.setTimeout?.(() => {
      if (drag.marker && !drag.marker.destroyed) drag.marker._afSuppressClick = false;
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

  async #toggle(emitterId) {
    const emitter = this.api.getSceneEmitter?.(emitterId);
    if (!emitter) return;
    await this.api.setSceneEmitterEnabled(emitterId, emitter.enabled === false);
    this.refresh();
  }
}

let overlay = null;

export function registerEmitterOverlay(api) {
  overlay = new EmitterCanvasOverlay(api);

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
