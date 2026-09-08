function element(tag, { className = "", text = "", attrs = {} } = {}) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  for (const [key, value] of Object.entries(attrs)) {
    if (value == null || value === false) continue;
    if (value === true) node.setAttribute(key, "");
    else node.setAttribute(key, String(value));
  }
  return node;
}

function input(name, value, { type = "text", min = null, max = null, step = null, readonly = false } = {}) {
  const control = element("input", { attrs: { name, type, min, max, step, readonly } });
  control.value = value ?? "";
  return control;
}

function checkbox(name, checked) {
  const control = input(name, "on", { type: "checkbox" });
  control.checked = Boolean(checked);
  return control;
}

function select(name, options, selectedValue = "") {
  const control = element("select", { attrs: { name } });
  for (const item of options) {
    const option = element("option", { text: item.label, attrs: { value: item.value } });
    option.selected = item.value === selectedValue;
    control.append(option);
  }
  return control;
}

function field(labelText, control, hintText = "") {
  const wrapper = element("div", { className: "ambience-forge-field" });
  wrapper.append(element("label", { text: labelText }), control);
  if (hintText) wrapper.append(element("p", { className: "hint", text: hintText }));
  return wrapper;
}

function volumeSlider(name, value) {
  const percent = Math.min(100, Math.max(0, Number(value) || 0));
  const wrapper = element("div", { className: "ambience-forge-volume-control" });
  const slider = input(name, Math.round(percent), { type: "range", min: 0, max: 100, step: 1 });
  slider.dataset.afVolumeSlider = "";
  const output = element("output", { text: `${Math.round(percent)} %`, attrs: { "data-af-volume-output": name } });
  wrapper.append(slider, output);
  return wrapper;
}

function bindVolumeSliders(root) {
  for (const slider of root.querySelectorAll?.('input[type="range"][data-af-volume-slider]') ?? []) {
    const update = () => {
      const output = root.querySelector(`[data-af-volume-output="${slider.name}"]`);
      if (output) output.textContent = `${Math.round(Number(slider.value) || 0)} %`;
    };
    slider.addEventListener("input", update);
    update();
  }
}

function actionButton(action, labelKey, iconClass, attrs = {}) {
  const button = element("button", { attrs: { type: "button", "data-af-emitter-action": action, ...attrs } });
  const icon = element("i", { className: iconClass });
  icon.setAttribute("aria-hidden", "true");
  button.append(icon, document.createTextNode(` ${game.i18n.localize(labelKey)}`));
  return button;
}

function currentSceneUnit() {
  return canvas?.scene?.grid?.units || game.i18n.localize("AMBIENCE_FORGE.Emitter.UnitsFallback");
}

function managerContent(api, selectedId = "") {
  const root = element("div");
  const wrapper = element("div", { className: "ambience-forge-emitter-manager" });
  root.append(wrapper);
  wrapper.append(element("p", { className: "hint", text: game.i18n.localize("AMBIENCE_FORGE.Emitter.ManagerHint") }));

  const emitters = api.getSceneEmitters();
  if (!emitters.length) {
    wrapper.append(element("div", { className: "ambience-forge-empty", text: game.i18n.localize("AMBIENCE_FORGE.Emitter.Empty") }));
  } else {
    const ambienceById = new Map(api.getAmbiences().map((ambience) => [ambience.id, ambience]));
    const options = emitters.map((emitter) => ({
      value: emitter.id,
      label: `${emitter.name || ambienceById.get(emitter.ambienceId)?.name || emitter.ambienceId} · ${Math.round(emitter.radius * 10) / 10} ${currentSceneUnit()}`
    }));
    const effective = options.some((option) => option.value === selectedId) ? selectedId : options[0]?.value;
    wrapper.append(field(
      game.i18n.localize("AMBIENCE_FORGE.Emitter.Emitter"),
      select("emitterId", options, effective)
    ));
  }

  const actions = element("div", { className: "ambience-forge-manager-actions" });
  actions.append(
    actionButton("new", "AMBIENCE_FORGE.Common.New", "fa-solid fa-plus"),
    actionButton("edit", "AMBIENCE_FORGE.Common.Edit", "fa-solid fa-pen"),
    actionButton("focus", "AMBIENCE_FORGE.Emitter.Focus", "fa-solid fa-crosshairs"),
    actionButton("preview", "AMBIENCE_FORGE.Common.Preview", "fa-solid fa-play"),
    actionButton("stop-preview", "AMBIENCE_FORGE.Common.StopPreview", "fa-solid fa-stop"),
    actionButton("delete", "AMBIENCE_FORGE.Common.Delete", "fa-solid fa-trash")
  );
  wrapper.append(actions);
  return root;
}

function editorContent(api, draft, isNew) {
  const root = element("div");
  const wrapper = element("div", { className: "ambience-forge-emitter-editor" });
  root.append(wrapper);

  const ambiences = api.getAmbiences().slice().sort((a, b) => a.name.localeCompare(b.name));
  wrapper.append(field(
    game.i18n.localize("AMBIENCE_FORGE.Emitter.Ambience"),
    select("ambienceId", ambiences.map((ambience) => ({ value: ambience.id, label: ambience.name })), draft.ambienceId || ambiences[0]?.id || ""),
    game.i18n.localize("AMBIENCE_FORGE.Emitter.AmbienceHint")
  ));
  wrapper.append(field(
    game.i18n.localize("AMBIENCE_FORGE.Emitter.Name"),
    input("name", draft.name ?? ""),
    game.i18n.localize("AMBIENCE_FORGE.Emitter.NameHint")
  ));
  wrapper.append(field(
    game.i18n.localize("AMBIENCE_FORGE.Emitter.Enabled"),
    checkbox("enabled", draft.enabled !== false),
    game.i18n.localize("AMBIENCE_FORGE.Emitter.EnabledHint")
  ));
  wrapper.append(field(
    game.i18n.format("AMBIENCE_FORGE.Emitter.Radius", { unit: currentSceneUnit() }),
    input("radius", draft.radius ?? 20, { type: "number", min: 0.1, step: 0.1 }),
    game.i18n.localize("AMBIENCE_FORGE.Emitter.RadiusHint")
  ));
  wrapper.append(field(
    game.i18n.localize("AMBIENCE_FORGE.Emitter.MaxVolume"),
    volumeSlider("volumePercent", Math.round((draft.volume ?? 0.7) * 100)),
    game.i18n.localize("AMBIENCE_FORGE.Emitter.MaxVolumeHint")
  ));
  wrapper.append(field(
    game.i18n.localize("AMBIENCE_FORGE.Emitter.Easing"),
    checkbox("easing", draft.easing !== false),
    game.i18n.localize("AMBIENCE_FORGE.Emitter.EasingHint")
  ));

  const positionText = Number.isFinite(draft.x) && Number.isFinite(draft.y)
    ? `${Math.round(draft.x)}, ${Math.round(draft.y)}`
    : game.i18n.localize("AMBIENCE_FORGE.Emitter.PositionUnset");
  wrapper.append(field(
    game.i18n.localize("AMBIENCE_FORGE.Emitter.Position"),
    input("position", positionText, { readonly: true }),
    game.i18n.localize("AMBIENCE_FORGE.Emitter.PositionHint")
  ));

  const actions = element("div", { className: "ambience-forge-manager-actions" });
  actions.append(
    actionButton("pick-position", "AMBIENCE_FORGE.Emitter.PickPosition", "fa-solid fa-location-dot"),
    actionButton("save", "AMBIENCE_FORGE.Common.Save", "fa-solid fa-floppy-disk"),
    actionButton("cancel", "AMBIENCE_FORGE.Common.Back", "fa-solid fa-arrow-left")
  );
  wrapper.append(actions);
  if (isNew) wrapper.append(element("p", { className: "hint", text: game.i18n.localize("AMBIENCE_FORGE.Emitter.NewHint") }));
  return root;
}

function readEditor(root, draft = {}) {
  const value = (name) => root.querySelector?.(`[name="${name}"]`)?.value;
  const checked = (name) => Boolean(root.querySelector?.(`[name="${name}"]`)?.checked);
  return {
    ...draft,
    ambienceId: String(value("ambienceId") ?? draft.ambienceId ?? ""),
    name: String(value("name") ?? draft.name ?? "").trim(),
    radius: Math.max(0.1, Number(value("radius") ?? draft.radius ?? 20) || 20),
    volume: Math.min(100, Math.max(0, Number(value("volumePercent") ?? Math.round((draft.volume ?? 0.7) * 100)) || 0)) / 100,
    easing: checked("easing"),
    enabled: checked("enabled")
  };
}

function canvasPositionFromEvent(event) {
  const stage = canvas?.stage;
  if (!stage) return null;
  try {
    const local = event?.getLocalPosition?.(stage);
    if (local && Number.isFinite(local.x) && Number.isFinite(local.y)) return { x: local.x, y: local.y };
  } catch {}
  try {
    const global = event?.global ?? event?.data?.global;
    const local = global ? stage.toLocal?.(global) : null;
    if (local && Number.isFinite(local.x) && Number.isFinite(local.y)) return { x: local.x, y: local.y };
  } catch {}
  return null;
}

let EmitterManagerClass = null;
let emitterManager = null;

function getEmitterManagerClass() {
  if (EmitterManagerClass) return EmitterManagerClass;
  const ApplicationV2 = foundry.applications.api.ApplicationV2;

  EmitterManagerClass = class AmbienceForgeEmitterManager extends ApplicationV2 {
    static DEFAULT_OPTIONS = {
      id: "ambience-forge-emitter-manager",
      classes: ["ambience-forge", "ambience-forge-emitter-window"],
      position: { width: 620 },
      window: { frame: true, resizable: true }
    };

    constructor(api, options = {}) {
      super(options);
      this.api = api;
      this.mode = "manager";
      this.selectedId = "";
      this.emitterId = null;
      this.draft = null;
      this.root = null;
      this._placementHandler = null;
    }

    get title() {
      if (this.mode === "editor") {
        return this.emitterId
          ? game.i18n.localize("AMBIENCE_FORGE.Emitter.TitleEdit")
          : game.i18n.localize("AMBIENCE_FORGE.Emitter.TitleNew");
      }
      return game.i18n.localize("AMBIENCE_FORGE.Emitter.Title");
    }

    showManager(selectedId = "") {
      this.mode = "manager";
      this.selectedId = String(selectedId ?? "");
      this.emitterId = null;
      this.draft = null;
      return this.render(true);
    }

    showEditor(emitterId = null) {
      const existing = emitterId ? this.api.getSceneEmitter(emitterId) : null;
      if (emitterId && !existing) {
        ui.notifications.error(game.i18n.localize("AMBIENCE_FORGE.Emitter.NotFound"));
        return this.showManager();
      }
      const firstAmbience = this.api.getAmbiences()[0];
      if (!existing && !firstAmbience) {
        ui.notifications.warn(game.i18n.localize("AMBIENCE_FORGE.Emitter.NoAmbiences"));
        return this.showManager();
      }
      this.mode = "editor";
      this.emitterId = existing?.id ?? null;
      this.draft = existing ? structuredClone(existing) : {
        ambienceId: firstAmbience?.id ?? "",
        name: "",
        radius: Math.max(1, Number(canvas?.scene?.grid?.distance ?? 5) * 4),
        volume: 0.7,
        easing: true,
        enabled: true,
        x: null,
        y: null
      };
      return this.render(true);
    }

    async _renderHTML() {
      return this.mode === "editor"
        ? editorContent(this.api, this.draft ?? {}, !this.emitterId)
        : managerContent(this.api, this.selectedId);
    }

    _replaceHTML(result, content) {
      content.replaceChildren(result);
      this.root = result;
      bindVolumeSliders(result);
      this.#bind();
    }

    #selectedId() {
      return String(this.root?.querySelector?.('[name="emitterId"]')?.value ?? this.selectedId ?? "");
    }

    #bind() {
      const selectNode = this.root?.querySelector?.('[name="emitterId"]');
      selectNode?.addEventListener("change", () => { this.selectedId = String(selectNode.value ?? ""); });
      for (const button of this.root?.querySelectorAll?.("[data-af-emitter-action]") ?? []) {
        button.addEventListener("click", () => { void this.#action(button.dataset.afEmitterAction); });
      }
    }

    async #action(action) {
      if (this.mode === "editor") {
        if (action === "cancel") return this.showManager(this.emitterId ?? "");
        if (action === "pick-position") return this.#pickPosition();
        if (action === "save") return this.#save();
        return;
      }

      if (action === "new") return this.showEditor();
      const id = this.#selectedId();
      if (!id) {
        ui.notifications.warn(game.i18n.localize("AMBIENCE_FORGE.Emitter.SelectEmitter"));
        return;
      }
      if (action === "edit") return this.showEditor(id);
      if (action === "focus") {
        const emitter = this.api.getSceneEmitter(id);
        if (emitter) await canvas?.animatePan?.({ x: emitter.x, y: emitter.y });
        return;
      }
      if (action === "preview") return this.api.previewSceneEmitter(id);
      if (action === "stop-preview") return this.api.stopSceneEmitterPreview();
      if (action === "delete") {
        const confirmed = await foundry.applications.api.DialogV2.confirm({
          window: { title: game.i18n.localize("AMBIENCE_FORGE.Emitter.DeleteTitle") },
          content: `<p>${game.i18n.localize("AMBIENCE_FORGE.Emitter.DeleteConfirm")}</p>`,
          rejectClose: false
        });
        if (!confirmed) return;
        await this.api.deleteSceneEmitter(id);
        return this.showManager();
      }
    }

    async #pickPosition() {
      this.draft = readEditor(this.root, this.draft ?? {});
      const stage = canvas?.stage;
      if (!stage?.on || !stage?.off) {
        ui.notifications.error(game.i18n.localize("AMBIENCE_FORGE.Emitter.CanvasUnavailable"));
        return;
      }
      if (this._placementHandler) stage.off("pointerdown", this._placementHandler);
      ui.notifications.info(game.i18n.localize("AMBIENCE_FORGE.Emitter.ClickCanvas"));
      this._placementHandler = (event) => {
        const position = canvasPositionFromEvent(event);
        stage.off("pointerdown", this._placementHandler);
        this._placementHandler = null;
        if (!position) return;
        this.draft = { ...this.draft, ...position };
        void this.render(true);
      };
      stage.on("pointerdown", this._placementHandler);
    }

    async #save() {
      this.draft = readEditor(this.root, this.draft ?? {});
      if (!this.draft.ambienceId) {
        ui.notifications.warn(game.i18n.localize("AMBIENCE_FORGE.Emitter.AmbienceRequired"));
        return;
      }
      if (!Number.isFinite(this.draft.x) || !Number.isFinite(this.draft.y)) {
        ui.notifications.warn(game.i18n.localize("AMBIENCE_FORGE.Emitter.PositionRequired"));
        return;
      }
      const saved = this.emitterId
        ? await this.api.updateSceneEmitter(this.emitterId, this.draft)
        : await this.api.createSceneEmitter(this.draft);
      ui.notifications.info(game.i18n.localize("AMBIENCE_FORGE.Emitter.Saved"));
      return this.showManager(saved?.id ?? this.emitterId ?? "");
    }

    async close(options = {}) {
      if (this._placementHandler && canvas?.stage?.off) canvas.stage.off("pointerdown", this._placementHandler);
      this._placementHandler = null;
      return super.close(options);
    }
  };
  return EmitterManagerClass;
}

function getEmitterManager(api) {
  const Class = getEmitterManagerClass();
  if (!emitterManager) emitterManager = new Class(api);
  emitterManager.api = api;
  return emitterManager;
}

export function openEmitterManager(api) {
  return getEmitterManager(api).showManager();
}

export function openEmitterEditor(api, emitterId) {
  return getEmitterManager(api).showEditor(emitterId);
}
