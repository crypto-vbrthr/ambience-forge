import { TRACK_TYPES } from "../constants.js";
import { cloneData, normalizeTrack } from "../data/schema.js";

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

function field(labelKey, control, hintKey = null) {
  const wrapper = element("div", { className: "ambience-forge-field" });
  const label = element("label", { text: game.i18n.localize(labelKey) });
  wrapper.append(label, control);
  if (hintKey) wrapper.append(element("p", { className: "hint", text: game.i18n.localize(hintKey) }));
  return wrapper;
}

function input(name, value, { type = "text", min = null, max = null, step = null, placeholder = null } = {}) {
  const control = element("input", { attrs: { name, type, min, max, step, placeholder } });
  control.value = value ?? "";
  return control;
}

function textarea(name, value) {
  const control = element("textarea", { attrs: { name, rows: 3 } });
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
  for (const optionData of options) {
    const option = element("option", { text: optionData.label, attrs: { value: optionData.value } });
    option.selected = optionData.value === selectedValue;
    control.append(option);
  }
  return control;
}

function seconds(ms) {
  return Math.max(0, Number(ms) || 0) / 1000;
}

function milliseconds(value) {
  return Math.max(0, (Number(value) || 0) * 1000);
}

function numberOrNull(value) {
  const text = String(value ?? "").trim();
  if (!text) return null;
  const number = Number(text);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

function localizeTrackType(type) {
  return game.i18n.localize(`AMBIENCE_FORGE.TrackType.${type}`);
}

function requireSelection(value) {
  if (value) return true;
  ui.notifications.warn(game.i18n.localize("AMBIENCE_FORGE.Notifications.SelectAmbience"));
  return false;
}

function requireTrackSelection(value) {
  if (value) return true;
  ui.notifications.warn(game.i18n.localize("AMBIENCE_FORGE.Notifications.SelectTrack"));
  return false;
}

function managerActionButton(action, labelKey, iconClass) {
  const button = element("button", { attrs: { type: "button", "data-af-manager-action": action } });
  const icon = element("i", { className: iconClass });
  icon.setAttribute("aria-hidden", "true");
  button.append(icon, document.createTextNode(` ${game.i18n.localize(labelKey)}`));
  return button;
}

function editorActionButton(action, labelKey, iconClass) {
  const button = element("button", { attrs: { type: "button", "data-af-editor-action": action } });
  const icon = element("i", { className: iconClass });
  icon.setAttribute("aria-hidden", "true");
  button.append(icon, document.createTextNode(` ${game.i18n.localize(labelKey)}`));
  return button;
}

function managerContent(api, selectedId = "") {
  const root = element("div");
  const wrapper = element("div", { className: "ambience-forge-manager" });
  root.append(wrapper);

  const ambiences = api.getAmbiences();
  const active = new Set(api.getState().activeAmbienceIds);
  wrapper.append(element("p", { className: "hint", text: game.i18n.localize("AMBIENCE_FORGE.Manager.Hint") }));

  if (!ambiences.length) {
    wrapper.append(element("div", { className: "ambience-forge-empty", text: game.i18n.localize("AMBIENCE_FORGE.Manager.Empty") }));
  } else {
    const options = ambiences.slice().sort((a, b) => a.name.localeCompare(b.name)).map((ambience) => ({
      value: ambience.id,
      label: `${active.has(ambience.id) ? "▶ " : ""}${ambience.name} (${ambience.tracks.length})`
    }));
    const effectiveSelection = options.some((o) => o.value === selectedId) ? selectedId : options[0]?.value;
    wrapper.append(field("AMBIENCE_FORGE.Manager.Composition", select("ambienceId", options, effectiveSelection)));
  }

  const actions = element("div", { className: "ambience-forge-manager-actions" });
  actions.append(
    managerActionButton("new", "AMBIENCE_FORGE.Common.New", "fa-solid fa-plus"),
    managerActionButton("edit", "AMBIENCE_FORGE.Common.Edit", "fa-solid fa-pen"),
    managerActionButton("play", "AMBIENCE_FORGE.Common.Play", "fa-solid fa-play"),
    managerActionButton("stop", "AMBIENCE_FORGE.Common.Stop", "fa-solid fa-stop"),
    managerActionButton("duplicate", "AMBIENCE_FORGE.Common.Duplicate", "fa-solid fa-copy"),
    managerActionButton("delete", "AMBIENCE_FORGE.Common.Delete", "fa-solid fa-trash")
  );
  wrapper.append(actions);
  return root;
}

function editorContent(ambience) {
  const root = element("div");
  const wrapper = element("div", { className: "ambience-forge-editor" });
  root.append(wrapper);

  wrapper.append(field("AMBIENCE_FORGE.Editor.Name", input("name", ambience?.name ?? "", { placeholder: game.i18n.localize("AMBIENCE_FORGE.Editor.NamePlaceholder") })));
  wrapper.append(field("AMBIENCE_FORGE.Editor.Description", textarea("description", ambience?.description ?? "")));
  wrapper.append(field(
    "AMBIENCE_FORGE.Editor.DefaultTransition",
    input("transitionSeconds", seconds(ambience?.transitionMs ?? 3000), { type: "number", min: 0, step: 0.1 }),
    "AMBIENCE_FORGE.Editor.DefaultTransitionHint"
  ));

  const tracks = ambience?.tracks ?? [];
  if (!tracks.length) {
    wrapper.append(element("div", { className: "ambience-forge-empty", text: game.i18n.localize("AMBIENCE_FORGE.Editor.NoTracks") }));
  } else {
    const trackOptions = tracks.map((track) => ({
      value: track.id,
      label: `${track.name || game.i18n.localize("AMBIENCE_FORGE.Editor.UnnamedTrack")} · ${localizeTrackType(track.type)}`
    }));
    wrapper.append(field("AMBIENCE_FORGE.Editor.Tracks", select("trackId", trackOptions, trackOptions[0]?.value)));
  }

  const actions = element("div", { className: "ambience-forge-manager-actions" });
  actions.append(
    editorActionButton("save", "AMBIENCE_FORGE.Common.Save", "fa-solid fa-floppy-disk"),
    editorActionButton("add-loop", "AMBIENCE_FORGE.Editor.AddLoop", "fa-solid fa-repeat"),
    editorActionButton("edit-track", "AMBIENCE_FORGE.Editor.EditTrack", "fa-solid fa-pen-to-square"),
    editorActionButton("delete-track", "AMBIENCE_FORGE.Editor.DeleteTrack", "fa-solid fa-trash"),
    editorActionButton("back", "AMBIENCE_FORGE.Common.Back", "fa-solid fa-arrow-left")
  );
  wrapper.append(actions);
  return root;
}

function readEditorFromRoot(root, existing) {
  const value = (name) => root.querySelector?.(`[name="${name}"]`)?.value;
  return {
    ...(existing ?? {}),
    name: String(value("name") ?? "").trim(),
    description: String(value("description") ?? ""),
    transitionMs: milliseconds(value("transitionSeconds") ?? 3),
    tracks: cloneData(existing?.tracks ?? [])
  };
}

export function resolveEditorTarget(api, ambienceId) {
  const id = String(ambienceId ?? "").trim();
  if (!id) return { id: null, ambience: { name: "", description: "", transitionMs: 3000, tracks: [] }, isNew: true };
  const ambience = api.getAmbience(id);
  if (!ambience) return null;
  return { id, ambience, isNew: false };
}

async function saveAmbienceDraft(api, ambienceId, data) {
  if (!data.name) {
    ui.notifications.warn(game.i18n.localize("AMBIENCE_FORGE.Notifications.NameRequired"));
    return null;
  }
  return api.upsertAmbience({ ...(data ?? {}), ...(ambienceId ? { id: ambienceId } : {}) });
}

let managerApp = null;
let ManagerAppClass = null;

function getManagerAppClass() {
  if (ManagerAppClass) return ManagerAppClass;
  const ApplicationV2 = foundry.applications.api.ApplicationV2;

  ManagerAppClass = class AmbienceForgeManagerApp extends ApplicationV2 {
    static DEFAULT_OPTIONS = {
      id: "ambience-forge-manager",
      classes: ["ambience-forge", "ambience-forge-manager-window"],
      position: { width: 680 },
      window: { frame: true, resizable: true }
    };

    constructor(api, options = {}) {
      super(options);
      this.api = api;
      this.mode = "manager";
      this.selectedId = "";
      this.ambienceId = null;
      this.draft = null;
    }

    get title() {
      if (this.mode === "editor") {
        const target = resolveEditorTarget(this.api, this.ambienceId);
        if (target && !target.isNew) return game.i18n.format("AMBIENCE_FORGE.Editor.TitleEdit", { name: target.ambience.name });
        return game.i18n.localize("AMBIENCE_FORGE.Editor.TitleNew");
      }
      return game.i18n.localize("AMBIENCE_FORGE.Manager.Title");
    }

    showManager(selectedId = "") {
      this.mode = "manager";
      this.selectedId = String(selectedId ?? "").trim();
      this.ambienceId = null;
      this.draft = null;
      return this.render(true);
    }

    showEditor(ambienceId = null, draft = null) {
      const target = resolveEditorTarget(this.api, ambienceId);
      if (!target) {
        ui.notifications.error(game.i18n.localize("AMBIENCE_FORGE.Notifications.AmbienceNotFound"));
        return this.showManager();
      }
      this.mode = "editor";
      this.ambienceId = target.id;
      this.draft = draft ? cloneData(draft) : cloneData(target.ambience);
      return this.render(true);
    }

    async _renderHTML() {
      if (this.mode === "editor") return editorContent(this.draft ?? resolveEditorTarget(this.api, this.ambienceId)?.ambience);
      return managerContent(this.api, this.selectedId);
    }

    _replaceHTML(result, content) {
      content.replaceChildren(result);
    }

    async _onRender(context, options) {
      await super._onRender(context, options);
      if (this.mode === "editor") this.#bindEditor();
      else this.#bindManager();
    }

    #bindManager() {
      const root = this.element;
      const selection = root.querySelector('select[name="ambienceId"]');
      if (selection) {
        this.selectedId = String(selection.value ?? "").trim();
        selection.addEventListener("change", () => { this.selectedId = String(selection.value ?? "").trim(); });
      }
      for (const button of root.querySelectorAll("[data-af-manager-action]")) {
        button.addEventListener("click", async (event) => {
          event.preventDefault();
          const action = String(button.dataset.afManagerAction ?? "");
          const selectedId = String(selection?.value ?? this.selectedId ?? "").trim();
          await this.#managerAction(action, selectedId);
        });
      }
    }

    async #managerAction(action, selectedId) {
      if (action === "new") return this.showEditor(null);
      if (!["edit", "play", "stop", "duplicate", "delete"].includes(action)) return;
      if (!requireSelection(selectedId)) return;

      if (action === "edit") return this.showEditor(selectedId);
      if (action === "play") {
        try { await this.api.playAmbience(selectedId); }
        catch (error) { console.error("ambience-forge | play failed", error); ui.notifications.error(error.message); }
        return this.showManager(selectedId);
      }
      if (action === "stop") {
        await this.api.stopAmbience(selectedId);
        return this.showManager(selectedId);
      }
      if (action === "duplicate") {
        const ambience = this.api.getAmbience(selectedId);
        if (!ambience) return this.showManager();
        const copy = cloneData(ambience);
        delete copy.id;
        copy.name = game.i18n.format("AMBIENCE_FORGE.Manager.CopyName", { name: ambience.name });
        for (const track of copy.tracks ?? []) delete track.id;
        const saved = await this.api.upsertAmbience(copy);
        return this.showEditor(saved.id);
      }
      if (action === "delete") {
        const ambience = this.api.getAmbience(selectedId);
        if (!ambience) return this.showManager();
        const confirmed = await foundry.applications.api.DialogV2.confirm({
          window: { title: game.i18n.localize("AMBIENCE_FORGE.Common.Delete") },
          content: `<p>${game.i18n.format("AMBIENCE_FORGE.Manager.DeleteConfirm", { name: ambience.name })}</p>`,
          yes: { label: game.i18n.localize("AMBIENCE_FORGE.Common.Delete"), icon: "fa-solid fa-trash" },
          no: { label: game.i18n.localize("AMBIENCE_FORGE.Common.Cancel"), icon: "fa-solid fa-xmark" },
          rejectClose: false,
          modal: true
        });
        if (confirmed) await this.api.deleteAmbience(selectedId);
        return this.showManager();
      }
    }

    #bindEditor() {
      const root = this.element;
      for (const button of root.querySelectorAll("[data-af-editor-action]")) {
        button.addEventListener("click", async (event) => {
          event.preventDefault();
          const action = String(button.dataset.afEditorAction ?? "");
          await this.#editorAction(action);
        });
      }
    }

    async #editorAction(action) {
      if (action === "back") return this.showManager(this.ambienceId ?? "");
      const existing = this.ambienceId ? this.api.getAmbience(this.ambienceId) : this.draft;
      const data = readEditorFromRoot(this.element, existing ?? this.draft);
      const trackId = String(this.element.querySelector('[name="trackId"]')?.value ?? "").trim();
      const saved = await saveAmbienceDraft(this.api, this.ambienceId, data);
      if (!saved) {
        this.draft = data;
        return this.render(true);
      }
      this.ambienceId = saved.id;
      this.draft = cloneData(saved);

      if (action === "save") {
        ui.notifications.info(game.i18n.localize("AMBIENCE_FORGE.Notifications.Saved"));
        return this.showManager(saved.id);
      }
      if (action === "add-loop") {
        await this.close();
        managerApp = null;
        return openLoopTrackEditor(this.api, saved.id, null);
      }
      if (action === "edit-track") {
        if (!requireTrackSelection(trackId)) return this.render(true);
        const track = saved.tracks.find((candidate) => candidate.id === trackId);
        if (!track) return this.render(true);
        if (track.type !== TRACK_TYPES.LOOP) {
          ui.notifications.warn(game.i18n.localize("AMBIENCE_FORGE.Notifications.TrackEditorNotAvailable"));
          return this.render(true);
        }
        await this.close();
        managerApp = null;
        return openLoopTrackEditor(this.api, saved.id, track.id);
      }
      if (action === "delete-track") {
        if (!requireTrackSelection(trackId)) return this.render(true);
        saved.tracks = saved.tracks.filter((track) => track.id !== trackId);
        const updated = await this.api.upsertAmbience(saved);
        this.draft = cloneData(updated);
        return this.render(true);
      }
      return this.render(true);
    }
  };

  return ManagerAppClass;
}

function getManagerApp(api) {
  if (managerApp?.api === api) return managerApp;
  const Class = getManagerAppClass();
  managerApp = new Class(api);
  managerApp.addEventListener("close", () => { managerApp = null; });
  return managerApp;
}

export async function openAmbienceManager(api, selectedId = "") {
  return getManagerApp(api).showManager(selectedId);
}

export async function openAmbienceEditor(api, ambienceId = null, draft = null) {
  return getManagerApp(api).showEditor(ambienceId, draft);
}

function loopTrackContent(track) {
  const root = element("div");
  const wrapper = element("div", { className: "ambience-forge-editor" });
  root.append(wrapper);

  wrapper.append(field("AMBIENCE_FORGE.Loop.Name", input("name", track.name ?? "")));
  wrapper.append(field("AMBIENCE_FORGE.Loop.Source", input("source", track.source ?? ""), "AMBIENCE_FORGE.Loop.SourceHint"));
  wrapper.append(field("AMBIENCE_FORGE.Loop.Enabled", checkbox("enabled", track.enabled !== false)));
  wrapper.append(field("AMBIENCE_FORGE.Loop.Volume", input("volumePercent", Math.round((track.volume ?? 1) * 100), { type: "number", min: 0, max: 100, step: 1 })));
  wrapper.append(field("AMBIENCE_FORGE.Loop.FadeIn", input("fadeInSeconds", seconds(track.fadeInMs ?? 1500), { type: "number", min: 0, step: 0.1 })));
  wrapper.append(field("AMBIENCE_FORGE.Loop.FadeOut", input("fadeOutSeconds", seconds(track.fadeOutMs ?? 1500), { type: "number", min: 0, step: 0.1 })));
  wrapper.append(field("AMBIENCE_FORGE.Loop.LoopStart", input("loopStart", track.loopStart ?? "", { type: "number", min: 0, step: 0.001 }), "AMBIENCE_FORGE.Loop.LoopPointsHint"));
  wrapper.append(field("AMBIENCE_FORGE.Loop.LoopEnd", input("loopEnd", track.loopEnd ?? "", { type: "number", min: 0, step: 0.001 })));
  return root;
}

function readLoopTrackForm(form, existing) {
  return normalizeTrack({
    ...(existing ?? {}),
    type: TRACK_TYPES.LOOP,
    name: String(form.elements.name?.value ?? "").trim(),
    source: String(form.elements.source?.value ?? "").trim(),
    enabled: Boolean(form.elements.enabled?.checked),
    volume: Math.min(100, Math.max(0, Number(form.elements.volumePercent?.value ?? 100) || 0)) / 100,
    fadeInMs: milliseconds(form.elements.fadeInSeconds?.value ?? 1.5),
    fadeOutMs: milliseconds(form.elements.fadeOutSeconds?.value ?? 1.5),
    loopStart: numberOrNull(form.elements.loopStart?.value),
    loopEnd: numberOrNull(form.elements.loopEnd?.value)
  });
}

export async function openLoopTrackEditor(api, ambienceId, trackId = null, draft = null) {
  const ambience = api.getAmbience(ambienceId);
  if (!ambience) return openAmbienceManager(api);
  const existing = trackId ? ambience.tracks.find((track) => track.id === trackId) : null;
  const track = draft ?? existing ?? normalizeTrack({ type: TRACK_TYPES.LOOP, name: game.i18n.localize("AMBIENCE_FORGE.Loop.DefaultName") });
  const DialogV2 = foundry.applications.api.DialogV2;
  const dialog = new DialogV2({
    window: { title: existing ? game.i18n.format("AMBIENCE_FORGE.Loop.TitleEdit", { name: existing.name }) : game.i18n.localize("AMBIENCE_FORGE.Loop.TitleNew") },
    position: { width: 660 },
    content: loopTrackContent(track),
    buttons: [
      {
        action: "browse",
        label: game.i18n.localize("AMBIENCE_FORGE.Loop.Browse"),
        icon: "fa-solid fa-folder-open",
        callback: (event, button) => ({ action: "browse", track: readLoopTrackForm(button.form, track) })
      },
      {
        action: "preview",
        label: game.i18n.localize("AMBIENCE_FORGE.Common.Preview"),
        icon: "fa-solid fa-headphones",
        callback: (event, button) => ({ action: "preview", track: readLoopTrackForm(button.form, track) })
      },
      {
        action: "stop-preview",
        label: game.i18n.localize("AMBIENCE_FORGE.Loop.StopPreview"),
        icon: "fa-solid fa-stop",
        callback: (event, button) => ({ action: "stop-preview", track: readLoopTrackForm(button.form, track) })
      },
      {
        action: "save",
        label: game.i18n.localize("AMBIENCE_FORGE.Common.Save"),
        icon: "fa-solid fa-floppy-disk",
        default: true,
        callback: (event, button) => ({ action: "save", track: readLoopTrackForm(button.form, track) })
      },
      {
        action: "back",
        label: game.i18n.localize("AMBIENCE_FORGE.Common.Back"),
        icon: "fa-solid fa-arrow-left",
        callback: (event, button) => ({ action: "back", track: readLoopTrackForm(button.form, track) })
      }
    ],
    submit: (result) => void handleLoopResult(api, ambienceId, trackId, result)
  });
  return dialog.render(true);
}

async function handleLoopResult(api, ambienceId, trackId, result) {
  if (!result) return;
  if (result.action === "back") {
    await api.stopPreview();
    return openAmbienceEditor(api, ambienceId);
  }
  if (result.action === "browse") {
    await api.stopPreview();
    return openAudioPicker(api, ambienceId, trackId, result.track);
  }
  if (result.action === "stop-preview") {
    await api.stopPreview();
    return openLoopTrackEditor(api, ambienceId, trackId, result.track);
  }
  if (result.action === "preview") {
    if (!result.track.source) {
      ui.notifications.warn(game.i18n.localize("AMBIENCE_FORGE.Notifications.SourceRequired"));
    } else {
      try {
        await api.previewLoop(result.track);
      } catch (error) {
        console.error("ambience-forge | preview failed", error);
        ui.notifications.error(error.message);
      }
    }
    return openLoopTrackEditor(api, ambienceId, trackId, result.track);
  }
  if (result.action === "save") {
    await api.stopPreview();
    if (!result.track.name) {
      ui.notifications.warn(game.i18n.localize("AMBIENCE_FORGE.Notifications.TrackNameRequired"));
      return openLoopTrackEditor(api, ambienceId, trackId, result.track);
    }
    if (!result.track.source) {
      ui.notifications.warn(game.i18n.localize("AMBIENCE_FORGE.Notifications.SourceRequired"));
      return openLoopTrackEditor(api, ambienceId, trackId, result.track);
    }
    const ambience = api.getAmbience(ambienceId);
    if (!ambience) return openAmbienceManager(api);
    const tracks = ambience.tracks.filter((track) => track.id !== result.track.id);
    tracks.push(result.track);
    ambience.tracks = tracks;
    await api.upsertAmbience(ambience);
    ui.notifications.info(game.i18n.localize("AMBIENCE_FORGE.Notifications.Saved"));
    return openAmbienceEditor(api, ambienceId);
  }
}

async function openAudioPicker(api, ambienceId, trackId, draft) {
  const FilePicker = foundry.applications.apps.FilePicker;
  let selected = false;
  const picker = new FilePicker({
    type: "audio",
    current: draft.source || "",
    callback: (path) => {
      selected = true;
      void openLoopTrackEditor(api, ambienceId, trackId, { ...draft, source: path });
    }
  });
  picker.addEventListener("close", () => {
    if (!selected) void openLoopTrackEditor(api, ambienceId, trackId, draft);
  }, { once: true });
  return picker.render(true);
}
