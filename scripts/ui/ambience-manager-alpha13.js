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

function audioActionButton(action, labelKey, iconClass) {
  const button = element("button", { attrs: { type: "button", "data-af-audio-action": action } });
  const icon = element("i", { className: iconClass });
  icon.setAttribute("aria-hidden", "true");
  button.append(icon, document.createTextNode(` ${game.i18n.localize(labelKey)}`));
  return button;
}

function randomActionButton(action, labelKey, iconClass) {
  const button = element("button", { attrs: { type: "button", "data-af-random-action": action } });
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
    editorActionButton("add-audio", "AMBIENCE_FORGE.Editor.AddAudio", "fa-solid fa-volume-high"),
    editorActionButton("add-random", "AMBIENCE_FORGE.Editor.AddRandom", "fa-solid fa-dice"),
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
      this.trackId = null;
      this.trackDraft = null;
    }

    get title() {
      if (this.mode === "random-track") {
        const ambience = this.ambienceId ? this.api.getAmbience(this.ambienceId) : null;
        const existing = this.trackId ? ambience?.tracks?.find((track) => track.id === this.trackId) : null;
        return existing
          ? game.i18n.format("AMBIENCE_FORGE.Random.TitleEdit", { name: existing.name })
          : game.i18n.localize("AMBIENCE_FORGE.Random.TitleNew");
      }
      if (this.mode === "audio-track") {
        const ambience = this.ambienceId ? this.api.getAmbience(this.ambienceId) : null;
        const existing = this.trackId ? ambience?.tracks?.find((track) => track.id === this.trackId) : null;
        return existing
          ? game.i18n.format("AMBIENCE_FORGE.Audio.TitleEdit", { name: existing.name })
          : game.i18n.localize("AMBIENCE_FORGE.Audio.TitleNew");
      }
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
      this.trackId = null;
      this.trackDraft = null;
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

    showAudioTrack(ambienceId, trackId = null, draft = null) {
      const ambience = this.api.getAmbience(ambienceId);
      if (!ambience) {
        ui.notifications.error(game.i18n.localize("AMBIENCE_FORGE.Notifications.AmbienceNotFound"));
        return this.showManager();
      }
      const existing = trackId ? ambience.tracks.find((track) => track.id === trackId) : null;
      if (trackId && !existing) {
        ui.notifications.error(game.i18n.localize("AMBIENCE_FORGE.Notifications.TrackNotFound"));
        return this.showEditor(ambienceId);
      }
      this.mode = "audio-track";
      this.ambienceId = ambienceId;
      this.trackId = existing?.id ?? null;
      this.trackDraft = cloneData(draft ?? existing ?? normalizeTrack({
        type: TRACK_TYPES.AUDIO,
        name: game.i18n.localize("AMBIENCE_FORGE.Audio.DefaultName"),
        repeat: true
      }));
      return this.render(true);
    }

    showRandomTrack(ambienceId, trackId = null, draft = null) {
      const ambience = this.api.getAmbience(ambienceId);
      if (!ambience) {
        ui.notifications.error(game.i18n.localize("AMBIENCE_FORGE.Notifications.AmbienceNotFound"));
        return this.showManager();
      }
      const existing = trackId ? ambience.tracks.find((track) => track.id === trackId) : null;
      if (trackId && !existing) {
        ui.notifications.error(game.i18n.localize("AMBIENCE_FORGE.Notifications.TrackNotFound"));
        return this.showEditor(ambienceId);
      }
      this.mode = "random-track";
      this.ambienceId = ambienceId;
      this.trackId = existing?.id ?? null;
      this.trackDraft = cloneData(draft ?? existing ?? normalizeTrack({
        type: TRACK_TYPES.RANDOM,
        name: game.i18n.localize("AMBIENCE_FORGE.Random.DefaultName")
      }));
      return this.render(true);
    }

    async _renderHTML() {
      if (this.mode === "random-track") return randomTrackContent(this.trackDraft);
      if (this.mode === "audio-track") return audioTrackContent(this.trackDraft);
      if (this.mode === "editor") return editorContent(this.draft ?? resolveEditorTarget(this.api, this.ambienceId)?.ambience);
      return managerContent(this.api, this.selectedId);
    }

    _replaceHTML(result, content) {
      content.replaceChildren(result);
    }

    async _onRender(context, options) {
      await super._onRender(context, options);
      if (this.mode === "random-track") this.#bindRandomTrack();
      else if (this.mode === "audio-track") this.#bindAudioTrack();
      else if (this.mode === "editor") this.#bindEditor();
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

    #bindAudioTrack() {
      const root = this.element;
      bindAudioSourcePicker(root);
      for (const button of root.querySelectorAll("[data-af-audio-action]")) {
        button.addEventListener("click", async (event) => {
          event.preventDefault();
          const action = String(button.dataset.afAudioAction ?? "");
          await this.#audioTrackAction(action);
        });
      }
    }

    async #audioTrackAction(action) {
      const track = readAudioTrackFromRoot(this.element, this.trackDraft);
      this.trackDraft = cloneData(track);

      if (action === "preview") {
        if (!track.source) {
          ui.notifications.warn(game.i18n.localize("AMBIENCE_FORGE.Notifications.SourceRequired"));
          return;
        }
        try { await this.api.previewAudio(track); }
        catch (error) {
          console.error("ambience-forge | audio preview failed", error);
          ui.notifications.error(error.message);
        }
        return;
      }

      if (action === "stop-preview") {
        await this.api.stopPreview();
        return;
      }

      if (action === "back") {
        await this.api.stopPreview();
        return this.showEditor(this.ambienceId);
      }

      if (action !== "save") return;
      await this.api.stopPreview();
      if (!track.name) {
        ui.notifications.warn(game.i18n.localize("AMBIENCE_FORGE.Notifications.TrackNameRequired"));
        return;
      }
      if (!track.source) {
        ui.notifications.warn(game.i18n.localize("AMBIENCE_FORGE.Notifications.SourceRequired"));
        return;
      }
      const ambience = this.api.getAmbience(this.ambienceId);
      if (!ambience) return this.showManager();
      const tracks = ambience.tracks.filter((candidate) => candidate.id !== track.id);
      tracks.push(track);
      ambience.tracks = tracks;
      await this.api.upsertAmbience(ambience);
      ui.notifications.info(game.i18n.localize("AMBIENCE_FORGE.Notifications.Saved"));
      return this.showEditor(this.ambienceId);
    }

    #bindRandomTrack() {
      const root = this.element;
      for (const button of root.querySelectorAll("[data-af-random-action]")) {
        button.addEventListener("click", async (event) => {
          event.preventDefault();
          const action = String(button.dataset.afRandomAction ?? "");
          await this.#randomTrackAction(action);
        });
      }
    }

    async #randomTrackAction(action) {
      const track = readRandomTrackFromRoot(this.element, this.trackDraft);
      this.trackDraft = cloneData(track);

      if (action === "add-source") {
        const list = this.element.querySelector('select[name="sourceList"]');
        const FilePicker = foundry.applications.apps.FilePicker;
        const picker = new FilePicker({
          type: "audio",
          current: "",
          callback: (path) => {
            const source = String(path ?? "").trim();
            if (!source) return;
            const sources = [...(this.trackDraft.sources ?? []), source];
            this.trackDraft = cloneData({ ...this.trackDraft, sources });
            if (list) {
              const option = element("option", { text: source, attrs: { value: String(sources.length - 1), "data-source": source } });
              list.append(option);
              list.selectedIndex = list.options.length - 1;
              list.size = Math.min(10, Math.max(4, list.options.length || 4));
            }
          }
        });
        return picker.render(true);
      }

      if (action === "remove-source") {
        const list = this.element.querySelector('select[name="sourceList"]');
        const sourceIndex = Number(list?.value ?? -1);
        const sources = [...(track.sources ?? [])];
        if (Number.isInteger(sourceIndex) && sourceIndex >= 0 && sourceIndex < sources.length) sources.splice(sourceIndex, 1);
        this.trackDraft = cloneData({ ...track, sources });
        if (list) {
          list.replaceChildren();
          sources.forEach((source, index) => {
            list.append(element("option", { text: source, attrs: { value: String(index), "data-source": source } }));
          });
          if (list.options.length) list.selectedIndex = Math.min(sourceIndex, list.options.length - 1);
          list.size = Math.min(10, Math.max(4, list.options.length || 4));
        }
        return;
      }

      if (action === "preview") {
        if (!track.sources?.length) {
          ui.notifications.warn(game.i18n.localize("AMBIENCE_FORGE.Notifications.SourcesRequired"));
          return;
        }
        try { await this.api.previewRandom(track); }
        catch (error) {
          console.error("ambience-forge | random preview failed", error);
          ui.notifications.error(error.message);
        }
        return;
      }

      if (action === "stop-preview") {
        await this.api.stopPreview();
        return;
      }

      if (action === "back") {
        await this.api.stopPreview();
        return this.showEditor(this.ambienceId);
      }

      if (action !== "save") return;
      await this.api.stopPreview();
      if (!track.name) {
        ui.notifications.warn(game.i18n.localize("AMBIENCE_FORGE.Notifications.TrackNameRequired"));
        return;
      }
      if (!track.sources?.length) {
        ui.notifications.warn(game.i18n.localize("AMBIENCE_FORGE.Notifications.SourcesRequired"));
        return;
      }
      const ambience = this.api.getAmbience(this.ambienceId);
      if (!ambience) return this.showManager();
      const tracks = ambience.tracks.filter((candidate) => candidate.id !== track.id);
      tracks.push(track);
      ambience.tracks = tracks;
      await this.api.upsertAmbience(ambience);
      ui.notifications.info(game.i18n.localize("AMBIENCE_FORGE.Notifications.Saved"));
      return this.showEditor(this.ambienceId);
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
      if (action === "add-audio") return this.showAudioTrack(saved.id, null);
      if (action === "add-random") return this.showRandomTrack(saved.id, null);
      if (action === "edit-track") {
        if (!requireTrackSelection(trackId)) return this.render(true);
        const track = saved.tracks.find((candidate) => candidate.id === trackId);
        if (!track) return this.render(true);
        if (![TRACK_TYPES.AUDIO, TRACK_TYPES.RANDOM].includes(track.type)) {
          ui.notifications.warn(game.i18n.localize("AMBIENCE_FORGE.Notifications.TrackEditorNotAvailable"));
          return this.render(true);
        }
        if (track.type === TRACK_TYPES.RANDOM) return this.showRandomTrack(saved.id, track.id);
        return this.showAudioTrack(saved.id, track.id);
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

function audioSourceControl(track) {
  const wrapper = element("div", { className: "ambience-forge-path-control" });
  const source = input("source", track.source ?? "");
  const browse = element("button", {
    attrs: {
      type: "button",
      title: game.i18n.localize("AMBIENCE_FORGE.Audio.Browse"),
      "aria-label": game.i18n.localize("AMBIENCE_FORGE.Audio.Browse"),
      "data-af-audio-browse": ""
    }
  });
  const icon = element("i", { className: "fa-solid fa-folder-open" });
  icon.setAttribute("aria-hidden", "true");
  browse.append(icon);
  wrapper.append(source, browse);
  return wrapper;
}

function audioTrackContent(track) {
  const root = element("div");
  const wrapper = element("div", { className: "ambience-forge-editor" });
  root.append(wrapper);

  wrapper.append(field("AMBIENCE_FORGE.Audio.Name", input("name", track.name ?? "")));
  wrapper.append(field("AMBIENCE_FORGE.Audio.Source", audioSourceControl(track), "AMBIENCE_FORGE.Audio.SourceHint"));
  wrapper.append(field("AMBIENCE_FORGE.Audio.Enabled", checkbox("enabled", track.enabled !== false)));
  wrapper.append(field("AMBIENCE_FORGE.Audio.Repeat", checkbox("repeat", track.repeat !== false), "AMBIENCE_FORGE.Audio.RepeatHint"));
  wrapper.append(field("AMBIENCE_FORGE.Audio.Volume", input("volumePercent", Math.round((track.volume ?? 1) * 100), { type: "number", min: 0, max: 100, step: 1 })));
  wrapper.append(field("AMBIENCE_FORGE.Audio.FadeIn", input("fadeInSeconds", seconds(track.fadeInMs ?? 1500), { type: "number", min: 0, step: 0.1 })));
  wrapper.append(field("AMBIENCE_FORGE.Audio.FadeOut", input("fadeOutSeconds", seconds(track.fadeOutMs ?? 1500), { type: "number", min: 0, step: 0.1 })));
  wrapper.append(field("AMBIENCE_FORGE.Audio.LoopStart", input("loopStart", track.loopStart ?? "", { type: "number", min: 0, step: 0.001 }), "AMBIENCE_FORGE.Audio.LoopPointsHint"));
  wrapper.append(field("AMBIENCE_FORGE.Audio.LoopEnd", input("loopEnd", track.loopEnd ?? "", { type: "number", min: 0, step: 0.001 })));

  const actions = element("div", { className: "ambience-forge-manager-actions" });
  actions.append(
    audioActionButton("preview", "AMBIENCE_FORGE.Common.Preview", "fa-solid fa-headphones"),
    audioActionButton("stop-preview", "AMBIENCE_FORGE.Audio.StopPreview", "fa-solid fa-stop"),
    audioActionButton("save", "AMBIENCE_FORGE.Common.Save", "fa-solid fa-floppy-disk"),
    audioActionButton("back", "AMBIENCE_FORGE.Common.Back", "fa-solid fa-arrow-left")
  );
  wrapper.append(actions);
  return root;
}

function readAudioTrackForm(form, existing) {
  return normalizeTrack({
    ...(existing ?? {}),
    type: TRACK_TYPES.AUDIO,
    name: String(form.elements.name?.value ?? "").trim(),
    source: String(form.elements.source?.value ?? "").trim(),
    enabled: Boolean(form.elements.enabled?.checked),
    repeat: Boolean(form.elements.repeat?.checked),
    volume: Math.min(100, Math.max(0, Number(form.elements.volumePercent?.value ?? 100) || 0)) / 100,
    fadeInMs: milliseconds(form.elements.fadeInSeconds?.value ?? 1.5),
    fadeOutMs: milliseconds(form.elements.fadeOutSeconds?.value ?? 1.5),
    loopStart: numberOrNull(form.elements.loopStart?.value),
    loopEnd: numberOrNull(form.elements.loopEnd?.value)
  });
}

function readAudioTrackFromRoot(root, existing) {
  const control = (name) => root.querySelector?.(`[name="${name}"]`);
  return normalizeTrack({
    ...(existing ?? {}),
    type: TRACK_TYPES.AUDIO,
    name: String(control("name")?.value ?? "").trim(),
    source: String(control("source")?.value ?? "").trim(),
    enabled: Boolean(control("enabled")?.checked),
    repeat: Boolean(control("repeat")?.checked),
    volume: Math.min(100, Math.max(0, Number(control("volumePercent")?.value ?? 100) || 0)) / 100,
    fadeInMs: milliseconds(control("fadeInSeconds")?.value ?? 1.5),
    fadeOutMs: milliseconds(control("fadeOutSeconds")?.value ?? 1.5),
    loopStart: numberOrNull(control("loopStart")?.value),
    loopEnd: numberOrNull(control("loopEnd")?.value)
  });
}

function bindAudioSourcePicker(root) {
  const browse = root?.querySelector?.("[data-af-audio-browse]");
  const source = root?.querySelector?.('input[name="source"]');
  if (!browse || !source) return;
  browse.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    const FilePicker = foundry.applications.apps.FilePicker;
    const picker = new FilePicker({
      type: "audio",
      current: String(source.value ?? ""),
      field: source,
      callback: (path) => {
        source.value = String(path ?? "");
        source.dispatchEvent(new Event("change", { bubbles: true }));
      }
    });
    void picker.render(true);
  });
}

export async function openAudioTrackEditor(api, ambienceId, trackId = null, draft = null) {
  return getManagerApp(api).showAudioTrack(ambienceId, trackId, draft);
}

function randomSourceList(sources = []) {
  const control = element("select", { attrs: { name: "sourceList", size: Math.min(10, Math.max(4, sources.length || 4)) } });
  sources.forEach((source, index) => {
    const option = element("option", { text: source, attrs: { value: String(index), "data-source": source } });
    control.append(option);
  });
  if (control.options.length) control.selectedIndex = 0;
  return control;
}

function randomTrackContent(track) {
  const root = element("div");
  const wrapper = element("div", { className: "ambience-forge-editor" });
  root.append(wrapper);

  wrapper.append(field("AMBIENCE_FORGE.Random.Name", input("name", track.name ?? "")));
  wrapper.append(field("AMBIENCE_FORGE.Random.Enabled", checkbox("enabled", track.enabled !== false)));
  wrapper.append(field("AMBIENCE_FORGE.Random.Volume", input("volumePercent", Math.round((track.volume ?? 1) * 100), { type: "number", min: 0, max: 100, step: 1 })));
  wrapper.append(field("AMBIENCE_FORGE.Random.MinDelay", input("minDelaySeconds", seconds(track.minDelayMs ?? 30000), { type: "number", min: 0, step: 0.1 }), "AMBIENCE_FORGE.Random.DelayHint"));
  wrapper.append(field("AMBIENCE_FORGE.Random.MaxDelay", input("maxDelaySeconds", seconds(track.maxDelayMs ?? 120000), { type: "number", min: 0, step: 0.1 })));
  wrapper.append(field("AMBIENCE_FORGE.Random.AvoidImmediateRepeat", checkbox("avoidImmediateRepeat", track.avoidImmediateRepeat !== false)));
  wrapper.append(field("AMBIENCE_FORGE.Random.AllowOverlap", checkbox("allowOverlap", track.allowOverlap !== false), "AMBIENCE_FORGE.Random.AllowOverlapHint"));
  wrapper.append(field("AMBIENCE_FORGE.Random.Sounds", randomSourceList(track.sources ?? []), "AMBIENCE_FORGE.Random.SoundsHint"));

  const actions = element("div", { className: "ambience-forge-manager-actions" });
  actions.append(
    randomActionButton("add-source", "AMBIENCE_FORGE.Random.AddSound", "fa-solid fa-folder-plus"),
    randomActionButton("remove-source", "AMBIENCE_FORGE.Random.RemoveSound", "fa-solid fa-minus"),
    randomActionButton("preview", "AMBIENCE_FORGE.Common.Preview", "fa-solid fa-headphones"),
    randomActionButton("stop-preview", "AMBIENCE_FORGE.Random.StopPreview", "fa-solid fa-stop"),
    randomActionButton("save", "AMBIENCE_FORGE.Common.Save", "fa-solid fa-floppy-disk"),
    randomActionButton("back", "AMBIENCE_FORGE.Common.Back", "fa-solid fa-arrow-left")
  );
  wrapper.append(actions);
  return root;
}

function readRandomTrackFromRoot(root, existing) {
  const control = (name) => root.querySelector?.(`[name="${name}"]`);
  const list = control("sourceList");
  const sources = list
    ? Array.from(list.options).map((option) => String(option.dataset.source ?? option.textContent ?? "").trim()).filter(Boolean)
    : cloneData(existing?.sources ?? []);
  return normalizeTrack({
    ...(existing ?? {}),
    type: TRACK_TYPES.RANDOM,
    name: String(control("name")?.value ?? "").trim(),
    enabled: Boolean(control("enabled")?.checked),
    volume: Math.min(100, Math.max(0, Number(control("volumePercent")?.value ?? 100) || 0)) / 100,
    fadeInMs: 0,
    fadeOutMs: 150,
    minDelayMs: milliseconds(control("minDelaySeconds")?.value ?? 30),
    maxDelayMs: milliseconds(control("maxDelaySeconds")?.value ?? 120),
    avoidImmediateRepeat: Boolean(control("avoidImmediateRepeat")?.checked),
    allowOverlap: Boolean(control("allowOverlap")?.checked),
    sources
  });
}

export async function openRandomTrackEditor(api, ambienceId, trackId = null, draft = null) {
  return getManagerApp(api).showRandomTrack(ambienceId, trackId, draft);
}
