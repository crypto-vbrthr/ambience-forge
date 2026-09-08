import { STATE_ACTIVITY } from "../constants.js";
import { cloneData, normalizeAmbienceState, normalizeStateGroup, slugifyKey } from "../data/schema.js";

function el(tag, { className = "", text = "", attrs = {} } = {}) {
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

function field(label, control, hint = "") {
  const wrap = el("div", { className: "ambience-forge-field" });
  wrap.append(el("label", { text: label }), control);
  if (hint) wrap.append(el("p", { className: "hint", text: hint }));
  return wrap;
}

function keyField(nameControl, keyControl, fallback = "state") {
  const wrap = field(
    game.i18n.localize("AMBIENCE_FORGE.States.KeyOptional"),
    keyControl,
    game.i18n.localize("AMBIENCE_FORGE.States.KeyHint")
  );

  let automatic = !String(keyControl.value ?? "").trim();
  const updateAutomaticKey = () => {
    if (!automatic) return;
    keyControl.value = slugifyKey(nameControl.value, fallback);
  };

  nameControl.addEventListener("input", updateAutomaticKey);
  keyControl.addEventListener("input", () => {
    automatic = !String(keyControl.value ?? "").trim();
    if (automatic) updateAutomaticKey();
  });

  return wrap;
}

function input(name, value = "", { type = "text", min = null, max = null, step = null, placeholder = null } = {}) {
  const node = el("input", { attrs: { name, type, min, max, step, placeholder } });
  node.value = value ?? "";
  return node;
}

function select(name, options, selected = "") {
  const node = el("select", { attrs: { name } });
  for (const option of options) {
    const item = el("option", { text: option.label, attrs: { value: option.value } });
    if (String(option.value) === String(selected ?? "")) item.selected = true;
    node.append(item);
  }
  return node;
}

function button(action, labelKey, icon) {
  const node = el("button", { attrs: { type: "button", "data-af-state-action": action } });
  node.append(el("i", { className: icon, attrs: { "aria-hidden": "true" } }), document.createTextNode(` ${game.i18n.localize(labelKey)}`));
  return node;
}

function volumeFactor(name, value = 1) {
  const percent = Math.round(Math.min(3, Math.max(0, Number(value) || 0)) * 100);
  const wrap = el("div", { className: "ambience-forge-volume-control" });
  const slider = input(name, percent, { type: "range", min: 0, max: 300, step: 5 });
  slider.dataset.afStateVolume = "";
  const output = el("output", { text: `${percent} %` });
  slider.addEventListener("input", () => { output.textContent = `${slider.value} %`; });
  wrap.append(slider, output);
  return wrap;
}

function groupListContent(ambience) {
  const root = el("div");
  const wrap = el("div", { className: "ambience-forge-state-manager" });
  root.append(wrap);
  wrap.append(el("p", { className: "hint", text: game.i18n.localize("AMBIENCE_FORGE.States.ManagerHint") }));
  const groups = ambience.stateGroups ?? [];
  if (!groups.length) wrap.append(el("div", { className: "ambience-forge-empty", text: game.i18n.localize("AMBIENCE_FORGE.States.NoGroups") }));
  else wrap.append(field(
    game.i18n.localize("AMBIENCE_FORGE.States.Group"),
    select("stateGroupId", groups.map((group) => ({ value: group.id, label: `${group.name} · ${group.key}` })), groups[0]?.id)
  ));
  const actions = el("div", { className: "ambience-forge-manager-actions" });
  actions.append(
    button("new-group", "AMBIENCE_FORGE.States.NewGroup", "fa-solid fa-plus"),
    button("edit-group", "AMBIENCE_FORGE.Common.Edit", "fa-solid fa-pen"),
    button("delete-group", "AMBIENCE_FORGE.Common.Delete", "fa-solid fa-trash"),
    button("close", "AMBIENCE_FORGE.Common.Close", "fa-solid fa-xmark")
  );
  wrap.append(actions);
  return root;
}

function groupEditorContent(group) {
  const root = el("div");
  const wrap = el("div", { className: "ambience-forge-state-manager" });
  root.append(wrap);
  const groupName = input("groupName", group.name);
  const groupKey = input("groupKey", group.key);
  wrap.append(field(game.i18n.localize("AMBIENCE_FORGE.States.Name"), groupName));
  wrap.append(keyField(groupName, groupKey, "group"));
  wrap.append(field(
    game.i18n.localize("AMBIENCE_FORGE.States.Transition"),
    input("groupTransition", (group.transitionMs ?? 3000) / 1000, { type: "number", min: 0, step: 0.1 })
  ));
  const states = group.states ?? [];
  const defaultOptions = [{ value: "", label: game.i18n.localize("AMBIENCE_FORGE.States.NoDefault") }, ...states.map((state) => ({ value: state.id, label: state.name }))];
  wrap.append(field(game.i18n.localize("AMBIENCE_FORGE.States.DefaultState"), select("defaultStateId", defaultOptions, group.defaultStateId ?? "")));
  if (states.length) wrap.append(field(
    game.i18n.localize("AMBIENCE_FORGE.States.State"),
    select("stateId", states.map((state) => ({ value: state.id, label: `${state.name} · ${state.key}` })), states[0]?.id)
  ));
  else wrap.append(el("div", { className: "ambience-forge-empty", text: game.i18n.localize("AMBIENCE_FORGE.States.NoStates") }));

  const actions = el("div", { className: "ambience-forge-manager-actions" });
  actions.append(
    button("save-group", "AMBIENCE_FORGE.Common.Save", "fa-solid fa-floppy-disk"),
    button("new-state", "AMBIENCE_FORGE.States.NewState", "fa-solid fa-plus"),
    button("edit-state", "AMBIENCE_FORGE.Common.Edit", "fa-solid fa-pen"),
    button("delete-state", "AMBIENCE_FORGE.Common.Delete", "fa-solid fa-trash"),
    button("back-groups", "AMBIENCE_FORGE.Common.Back", "fa-solid fa-arrow-left")
  );
  wrap.append(actions);
  return root;
}

function stateEditorContent(ambience, group, state) {
  const root = el("div");
  const wrap = el("div", { className: "ambience-forge-state-manager" });
  root.append(wrap);
  const stateName = input("stateName", state.name);
  const stateKey = input("stateKey", state.key);
  wrap.append(field(game.i18n.localize("AMBIENCE_FORGE.States.Name"), stateName));
  wrap.append(keyField(stateName, stateKey));
  wrap.append(field(
    game.i18n.localize("AMBIENCE_FORGE.States.StateTransition"),
    input("stateTransition", state.transitionMs == null ? "" : state.transitionMs / 1000, { type: "number", min: 0, step: 0.1, placeholder: game.i18n.localize("AMBIENCE_FORGE.States.UseGroupTransition") }),
    game.i18n.localize("AMBIENCE_FORGE.States.StateTransitionHint")
  ));
  wrap.append(el("p", { className: "hint", text: game.i18n.localize("AMBIENCE_FORGE.States.OverrideHint") }));

  const overrideByTrack = new Map((state.trackOverrides ?? []).map((override) => [override.trackId, override]));
  const list = el("div", { className: "ambience-forge-state-overrides" });
  if ((ambience.tracks ?? []).length) {
    const header = el("div", { className: "ambience-forge-state-override ambience-forge-state-override-header" });
    header.append(
      el("strong", { text: game.i18n.localize("AMBIENCE_FORGE.States.Track") }),
      el("strong", { text: game.i18n.localize("AMBIENCE_FORGE.States.Activity") }),
      el("strong", { text: game.i18n.localize("AMBIENCE_FORGE.States.VolumeFactor") })
    );
    list.append(header);
  }
  for (const track of ambience.tracks ?? []) {
    const override = overrideByTrack.get(track.id) ?? { active: STATE_ACTIVITY.INHERIT, volumeFactor: 1 };
    const card = el("section", { className: "ambience-forge-state-override", attrs: { "data-track-id": track.id } });
    card.append(
      el("strong", { className: "ambience-forge-state-track-name", text: track.name || game.i18n.localize("AMBIENCE_FORGE.Editor.UnnamedTrack") }),
      select(`activity-${track.id}`, [
        { value: STATE_ACTIVITY.INHERIT, label: game.i18n.localize("AMBIENCE_FORGE.States.ActivityInherit") },
        { value: STATE_ACTIVITY.ON, label: game.i18n.localize("AMBIENCE_FORGE.States.ActivityOn") },
        { value: STATE_ACTIVITY.OFF, label: game.i18n.localize("AMBIENCE_FORGE.States.ActivityOff") }
      ], override.active),
      volumeFactor(`factor-${track.id}`, override.volumeFactor)
    );
    list.append(card);
  }
  wrap.append(list);

  const actions = el("div", { className: "ambience-forge-manager-actions" });
  actions.append(
    button("save-state", "AMBIENCE_FORGE.Common.Save", "fa-solid fa-floppy-disk"),
    button("back-group", "AMBIENCE_FORGE.Common.Back", "fa-solid fa-arrow-left")
  );
  wrap.append(actions);
  return root;
}

function readGroup(root, existing) {
  const name = String(root.querySelector('[name="groupName"]')?.value ?? "").trim();
  const key = slugifyKey(root.querySelector('[name="groupKey"]')?.value || name, "group");
  return normalizeStateGroup({
    ...existing,
    name,
    key,
    transitionMs: Math.max(0, Number(root.querySelector('[name="groupTransition"]')?.value ?? 3) || 0) * 1000,
    defaultStateId: String(root.querySelector('[name="defaultStateId"]')?.value ?? "") || null,
    states: cloneData(existing?.states ?? [])
  });
}

function readState(root, ambience, existing) {
  const name = String(root.querySelector('[name="stateName"]')?.value ?? "").trim();
  const key = slugifyKey(root.querySelector('[name="stateKey"]')?.value || name, "state");
  const transitionRaw = String(root.querySelector('[name="stateTransition"]')?.value ?? "").trim();
  const trackOverrides = (ambience.tracks ?? []).map((track) => ({
    trackId: track.id,
    active: String(root.querySelector(`[name="activity-${track.id}"]`)?.value ?? STATE_ACTIVITY.INHERIT),
    volumeFactor: Math.min(300, Math.max(0, Number(root.querySelector(`[name="factor-${track.id}"]`)?.value ?? 100) || 0)) / 100
  }));
  return normalizeAmbienceState({
    ...existing,
    name,
    key,
    transitionMs: transitionRaw === "" ? null : Math.max(0, Number(transitionRaw) || 0) * 1000,
    trackOverrides
  }, { validTrackIds: new Set((ambience.tracks ?? []).map((track) => track.id)) });
}

let stateManagerApp = null;
let StateManagerClass = null;

function getStateManagerClass() {
  if (StateManagerClass) return StateManagerClass;
  const ApplicationV2 = foundry.applications.api.ApplicationV2;
  StateManagerClass = class AmbienceForgeStateManager extends ApplicationV2 {
    static DEFAULT_OPTIONS = {
      id: "ambience-forge-state-manager",
      classes: ["ambience-forge", "ambience-forge-state-window"],
      position: { width: 820 },
      window: { frame: true, resizable: true }
    };

    constructor(api, ambienceId, options = {}) {
      super(options);
      this.api = api;
      this.ambienceId = ambienceId;
      this.mode = "groups";
      this.groupId = null;
      this.stateId = null;
    }

    get ambience() { return this.api.getAmbience(this.ambienceId); }

    get title() {
      const ambience = this.ambience;
      if (this.mode === "state") return game.i18n.localize("AMBIENCE_FORGE.States.StateTitle");
      if (this.mode === "group") return game.i18n.localize("AMBIENCE_FORGE.States.GroupTitle");
      return game.i18n.format("AMBIENCE_FORGE.States.Title", { name: ambience?.name ?? "" });
    }

    showGroups() { this.mode = "groups"; this.groupId = null; this.stateId = null; return this.render(true); }
    showGroup(groupId = null) { this.mode = "group"; this.groupId = groupId; this.stateId = null; return this.render(true); }
    showState(groupId, stateId = null) { this.mode = "state"; this.groupId = groupId; this.stateId = stateId; return this.render(true); }

    async _renderHTML() {
      const ambience = this.ambience;
      if (!ambience) return el("div", { text: game.i18n.localize("AMBIENCE_FORGE.Notifications.AmbienceNotFound") });
      if (this.mode === "group") {
        const group = this.groupId ? ambience.stateGroups?.find((candidate) => candidate.id === this.groupId) : null;
        return groupEditorContent(group ?? { id: null, name: "", key: "", states: [], defaultStateId: null, transitionMs: ambience.transitionMs });
      }
      if (this.mode === "state") {
        const group = ambience.stateGroups?.find((candidate) => candidate.id === this.groupId);
        if (!group) return groupListContent(ambience);
        const state = this.stateId ? group.states?.find((candidate) => candidate.id === this.stateId) : null;
        return stateEditorContent(ambience, group, state ?? { id: null, name: "", key: "", transitionMs: null, trackOverrides: [] });
      }
      return groupListContent(ambience);
    }

    _replaceHTML(result, content) { content.replaceChildren(result); }

    async _onRender(context, options) {
      await super._onRender(context, options);
      for (const node of this.element.querySelectorAll("[data-af-state-action]")) {
        node.addEventListener("click", async (event) => {
          event.preventDefault();
          await this.#action(String(node.dataset.afStateAction ?? ""));
        });
      }
    }

    async #action(action) {
      const ambience = this.ambience;
      if (!ambience) return this.close();
      if (this.mode === "groups") {
        if (action === "close") return this.close();
        if (action === "new-group") return this.showGroup(null);
        const groupId = String(this.element.querySelector('[name="stateGroupId"]')?.value ?? "");
        if (!groupId) return;
        if (action === "edit-group") return this.showGroup(groupId);
        if (action === "delete-group") {
          ambience.stateGroups = (ambience.stateGroups ?? []).filter((group) => group.id !== groupId);
          await this.api.upsertAmbience(ambience);
          return this.showGroups();
        }
        return;
      }

      if (this.mode === "group") {
        if (action === "back-groups") return this.showGroups();
        const existing = this.groupId ? ambience.stateGroups?.find((candidate) => candidate.id === this.groupId) : null;
        const draft = readGroup(this.element, existing);
        if (!draft.name) return ui.notifications.warn(game.i18n.localize("AMBIENCE_FORGE.States.NameRequired"));
        const duplicate = (ambience.stateGroups ?? []).some((group) => group.id !== existing?.id && group.key === draft.key);
        if (duplicate) return ui.notifications.warn(game.i18n.localize("AMBIENCE_FORGE.States.DuplicateGroupKey"));
        const groups = cloneData(ambience.stateGroups ?? []);
        const groupIndex = existing ? groups.findIndex((group) => group.id === existing.id) : -1;
        if (groupIndex >= 0) groups[groupIndex] = draft;
        else groups.push(draft);
        ambience.stateGroups = groups;
        const savedAmbience = await this.api.upsertAmbience(ambience);
        this.groupId = draft.id;
        if (action === "save-group") return this.showGroups();
        if (action === "new-state") return this.showState(draft.id, null);
        const savedGroup = savedAmbience.stateGroups.find((group) => group.id === draft.id);
        const selectedStateId = String(this.element.querySelector('[name="stateId"]')?.value ?? "");
        if (!selectedStateId) return this.showGroup(draft.id);
        if (action === "edit-state") return this.showState(draft.id, selectedStateId);
        if (action === "delete-state") {
          savedGroup.states = savedGroup.states.filter((state) => state.id !== selectedStateId);
          if (savedGroup.defaultStateId === selectedStateId) savedGroup.defaultStateId = null;
          await this.api.upsertAmbience(savedAmbience);
          return this.showGroup(draft.id);
        }
        return;
      }

      if (this.mode === "state") {
        if (action === "back-group") return this.showGroup(this.groupId);
        if (action !== "save-state") return;
        const group = ambience.stateGroups?.find((candidate) => candidate.id === this.groupId);
        if (!group) return this.showGroups();
        const existing = this.stateId ? group.states?.find((candidate) => candidate.id === this.stateId) : null;
        const draft = readState(this.element, ambience, existing);
        if (!draft.name) return ui.notifications.warn(game.i18n.localize("AMBIENCE_FORGE.States.NameRequired"));
        const duplicate = group.states.some((state) => state.id !== existing?.id && state.key === draft.key);
        if (duplicate) return ui.notifications.warn(game.i18n.localize("AMBIENCE_FORGE.States.DuplicateStateKey"));
        const states = cloneData(group.states ?? []);
        const stateIndex = existing ? states.findIndex((state) => state.id === existing.id) : -1;
        if (stateIndex >= 0) states[stateIndex] = draft;
        else states.push(draft);
        group.states = states;
        await this.api.upsertAmbience(ambience);
        return this.showGroup(group.id);
      }
    }
  };
  return StateManagerClass;
}

export function openStateManager(api, ambienceId) {
  const Class = getStateManagerClass();
  if (!stateManagerApp || stateManagerApp.api !== api || stateManagerApp.ambienceId !== ambienceId) {
    stateManagerApp = new Class(api, ambienceId);
    stateManagerApp.addEventListener("close", () => { stateManagerApp = null; });
  }
  return stateManagerApp.showGroups();
}
