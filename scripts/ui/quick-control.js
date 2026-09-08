import { TRACK_TYPES } from "../constants.js";

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

function select(name, options, selectedValue = "") {
  const control = element("select", { attrs: { name } });
  for (const optionData of options) {
    const option = element("option", { text: optionData.label, attrs: { value: optionData.value } });
    option.selected = optionData.value === selectedValue;
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

function volumeSlider(name, value, extraData = {}) {
  const percent = Math.min(100, Math.max(0, Number(value) || 0));
  const wrapper = element("div", { className: "ambience-forge-volume-control" });
  const attrs = { name, type: "range", min: 0, max: 100, step: 1, "data-af-volume-slider": "" };
  for (const [key, item] of Object.entries(extraData)) attrs[`data-${key}`] = item;
  const slider = element("input", { attrs });
  slider.value = String(Math.round(percent));
  const output = element("output", { text: `${Math.round(percent)} %`, attrs: { "data-af-volume-output": name } });
  wrapper.append(slider, output);
  return wrapper;
}

function bindSliderOutput(root, slider) {
  const update = () => {
    const output = root.querySelector(`[data-af-volume-output="${slider.name}"]`);
    if (output) output.textContent = `${Math.round(Number(slider.value) || 0)} %`;
  };
  slider.addEventListener("input", update);
  update();
}

function iconButton(action, labelKey, iconClass, extraAttrs = {}) {
  const button = element("button", {
    attrs: { type: "button", "data-af-quick-action": action, ...extraAttrs }
  });
  const icon = element("i", { className: iconClass });
  icon.setAttribute("aria-hidden", "true");
  button.append(icon, document.createTextNode(` ${game.i18n.localize(labelKey)}`));
  return button;
}

function activeTrackControl(ambience, track, state) {
  const trackId = track.id;
  const liveVolume = state.trackVolumes?.[ambience.id]?.[trackId] ?? track.volume ?? 1;
  const isActive = state.trackActiveStates?.[ambience.id]?.[trackId] ?? true;
  const trackName = track.name || game.i18n.localize("AMBIENCE_FORGE.Editor.UnnamedTrack");

  const section = element("section", {
    className: `ambience-forge-quick-track${isActive ? "" : " is-stopped"}`,
    attrs: { "data-af-quick-track": trackId }
  });
  const header = element("div", { className: "ambience-forge-quick-track-header" });
  const heading = element("div", { className: "ambience-forge-quick-track-title" });
  heading.append(
    element("strong", { text: trackName }),
    element("span", {
      className: "ambience-forge-quick-track-type",
      text: game.i18n.localize(`AMBIENCE_FORGE.TrackType.${track.type}`)
    })
  );
  header.append(
    heading,
    iconButton(
      "toggle-track",
      isActive ? "AMBIENCE_FORGE.Quick.StopTrack" : "AMBIENCE_FORGE.Quick.StartTrack",
      isActive ? "fa-solid fa-stop" : "fa-solid fa-play",
      {
        "data-ambience-id": ambience.id,
        "data-track-id": trackId,
        "data-track-active": String(isActive)
      }
    )
  );
  section.append(header);

  section.append(field(
    game.i18n.localize("AMBIENCE_FORGE.Quick.TrackVolume"),
    volumeSlider(`quickTrackVolume-${ambience.id}-${trackId}`, Math.round(liveVolume * 100), {
      "af-quick-track-volume": trackId,
      "ambience-id": ambience.id
    }),
  ));

  if (track.type === TRACK_TYPES.INTENSITY) {
    const intensity = state.trackIntensities?.[ambience.id]?.[trackId] ?? track.intensity ?? 0;
    section.append(field(
      game.i18n.localize("AMBIENCE_FORGE.Quick.TrackIntensity"),
      volumeSlider(`quickIntensity-${ambience.id}-${trackId}`, Math.round(intensity * 100), {
        "af-quick-intensity": trackId,
        "ambience-id": ambience.id
      })
    ));
  }

  return section;
}


function stateGroupControl(ambience, group, state) {
  const selected = state.ambienceStates?.[ambience.id]?.[group.key] ?? null;
  const options = [
    { value: "", label: game.i18n.localize("AMBIENCE_FORGE.Quick.StateNone") },
    ...(group.states ?? []).map((entry) => ({ value: entry.key, label: entry.name }))
  ];
  const control = select(`quickState-${ambience.id}-${group.id}`, options, selected ?? "");
  control.dataset.afQuickStateGroup = group.key;
  control.dataset.ambienceId = ambience.id;
  return field(group.name, control);
}

function activeCard(api, ambience, state) {
  const card = element("section", { className: "ambience-forge-quick-card", attrs: { "data-af-active-ambience": ambience.id } });
  const header = element("div", { className: "ambience-forge-quick-card-header" });
  header.append(
    element("h3", { text: ambience.name }),
    iconButton("stop-one", "AMBIENCE_FORGE.Common.Stop", "fa-solid fa-stop", { "data-ambience-id": ambience.id })
  );
  card.append(header);

  const master = state.masterVolumes?.[ambience.id] ?? ambience.masterVolume ?? 1;
  card.append(field(
    game.i18n.localize("AMBIENCE_FORGE.Quick.MasterVolume"),
    volumeSlider(`quickMaster-${ambience.id}`, Math.round(master * 100), { "af-quick-master": ambience.id }),
  ));

  if (ambience.stateGroups?.length) {
    card.append(element("h4", { className: "ambience-forge-quick-tracks-heading", text: game.i18n.localize("AMBIENCE_FORGE.Quick.States") }));
    const states = element("div", { className: "ambience-forge-quick-state-list" });
    for (const group of ambience.stateGroups) states.append(stateGroupControl(ambience, group, state));
    card.append(states);
  }

  const enabledTracks = ambience.tracks ?? [];
  if (enabledTracks.length) {
    card.append(element("h4", { className: "ambience-forge-quick-tracks-heading", text: game.i18n.localize("AMBIENCE_FORGE.Quick.Channels") }));
    const tracks = element("div", { className: "ambience-forge-quick-track-list" });
    for (const track of enabledTracks) tracks.append(activeTrackControl(ambience, track, state));
    card.append(tracks);
  }

  return card;
}

function quickContent(api, selectedId = "") {
  const root = element("div");
  const wrapper = element("div", { className: "ambience-forge-quick" });
  root.append(wrapper);
  wrapper.append(element("p", { className: "hint", text: game.i18n.localize("AMBIENCE_FORGE.Quick.Hint") }));

  const ambiences = api.getAmbiences().slice().sort((a, b) => a.name.localeCompare(b.name));
  if (ambiences.length) {
    const options = ambiences.map((ambience) => ({ value: ambience.id, label: ambience.name }));
    const effective = options.some((option) => option.value === selectedId) ? selectedId : options[0].value;
    wrapper.append(field(
      game.i18n.localize("AMBIENCE_FORGE.Quick.Composition"),
      select("quickAmbienceId", options, effective)
    ));
    const actions = element("div", { className: "ambience-forge-quick-actions" });
    actions.append(
      iconButton("play-selected", "AMBIENCE_FORGE.Quick.Start", "fa-solid fa-play"),
      iconButton("stop-active", "AMBIENCE_FORGE.Quick.StopActive", "fa-solid fa-stop")
    );
    wrapper.append(actions);
  } else {
    wrapper.append(element("div", { className: "ambience-forge-empty", text: game.i18n.localize("AMBIENCE_FORGE.Quick.NoCompositions") }));
  }

  const state = api.getState();
  const active = state.activeAmbienceIds
    .map((id) => api.getAmbience(id))
    .filter(Boolean)
    .sort((a, b) => a.name.localeCompare(b.name));

  wrapper.append(element("h2", { text: game.i18n.localize("AMBIENCE_FORGE.Quick.Active") }));
  if (!active.length) {
    wrapper.append(element("div", { className: "ambience-forge-empty", text: game.i18n.localize("AMBIENCE_FORGE.Quick.NoActive") }));
  } else {
    const cards = element("div", { className: "ambience-forge-quick-cards" });
    for (const ambience of active) cards.append(activeCard(api, ambience, state));
    wrapper.append(cards);
  }
  return root;
}

let quickApp = null;
let QuickAppClass = null;

function getQuickAppClass() {
  if (QuickAppClass) return QuickAppClass;
  const ApplicationV2 = foundry.applications.api.ApplicationV2;

  QuickAppClass = class AmbienceForgeQuickControlApp extends ApplicationV2 {
    static DEFAULT_OPTIONS = {
      id: "ambience-forge-quick-control",
      classes: ["ambience-forge", "ambience-forge-quick-window"],
      position: { width: 520 },
      window: { frame: true, resizable: true }
    };

    constructor(api, options = {}) {
      super(options);
      this.api = api;
      this.selectedId = "";
    }

    get title() {
      return game.i18n.localize("AMBIENCE_FORGE.Quick.Title");
    }

    async _renderHTML() {
      return quickContent(this.api, this.selectedId);
    }

    _replaceHTML(result, content) {
      content.replaceChildren(result);
    }

    async _onRender(context, options) {
      await super._onRender(context, options);
      const root = this.element;
      const selection = root.querySelector('select[name="quickAmbienceId"]');
      if (selection) {
        this.selectedId = String(selection.value ?? "").trim();
        selection.addEventListener("change", () => {
          this.selectedId = String(selection.value ?? "").trim();
        });
      }

      for (const slider of root.querySelectorAll('input[type="range"][data-af-volume-slider]')) bindSliderOutput(root, slider);

      for (const slider of root.querySelectorAll("[data-af-quick-master]")) {
        slider.addEventListener("change", async () => {
          const ambienceId = String(slider.dataset.afQuickMaster ?? "").trim();
          if (!ambienceId) return;
          const volume = Math.min(100, Math.max(0, Number(slider.value) || 0)) / 100;
          await this.api.setMasterVolume(ambienceId, volume, { durationMs: 150 });
        });
      }

      for (const control of root.querySelectorAll("[data-af-quick-state-group]")) {
        control.addEventListener("change", async () => {
          const ambienceId = String(control.dataset.ambienceId ?? "").trim();
          const group = String(control.dataset.afQuickStateGroup ?? "").trim();
          if (!ambienceId || !group) return;
          const stateKey = String(control.value ?? "").trim();
          try {
            if (stateKey) await this.api.setState(ambienceId, group, stateKey, { owner: "ambience-forge-ui" });
            else await this.api.clearState(ambienceId, group);
          } catch (error) {
            console.error("ambience-forge | quick state change failed", error);
            ui.notifications.error(error.message);
          }
          return this.render(true);
        });
      }

      for (const slider of root.querySelectorAll("[data-af-quick-track-volume]")) {
        slider.addEventListener("change", async () => {
          const ambienceId = String(slider.dataset.ambienceId ?? "").trim();
          const trackId = String(slider.dataset.afQuickTrackVolume ?? "").trim();
          if (!ambienceId || !trackId) return;
          const volume = Math.min(100, Math.max(0, Number(slider.value) || 0)) / 100;
          await this.api.setTrackVolume(ambienceId, trackId, volume, { durationMs: 150 });
        });
      }

      for (const slider of root.querySelectorAll("[data-af-quick-intensity]")) {
        slider.addEventListener("change", async () => {
          const ambienceId = String(slider.dataset.ambienceId ?? "").trim();
          const trackId = String(slider.dataset.afQuickIntensity ?? "").trim();
          if (!ambienceId || !trackId) return;
          const intensity = Math.min(100, Math.max(0, Number(slider.value) || 0)) / 100;
          await this.api.setTrackIntensity(ambienceId, trackId, intensity);
        });
      }

      for (const button of root.querySelectorAll("[data-af-quick-action]")) {
        button.addEventListener("click", async (event) => {
          event.preventDefault();
          const action = String(button.dataset.afQuickAction ?? "");
          if (action === "play-selected") {
            const id = String(selection?.value ?? this.selectedId ?? "").trim();
            if (!id) return;
            try { await this.api.playAmbience(id); }
            catch (error) { console.error("ambience-forge | quick play failed", error); ui.notifications.error(error.message); }
            this.selectedId = id;
            return this.render(true);
          }
          if (action === "stop-one") {
            const id = String(button.dataset.ambienceId ?? "").trim();
            if (id) await this.api.stopAmbience(id);
            return this.render(true);
          }
          if (action === "toggle-track") {
            const ambienceId = String(button.dataset.ambienceId ?? "").trim();
            const trackId = String(button.dataset.trackId ?? "").trim();
            if (!ambienceId || !trackId) return;
            const isActive = button.dataset.trackActive === "true";
            await this.api.setTrackActive(ambienceId, trackId, !isActive);
            return this.render(true);
          }
          if (action === "stop-active") {
            const activeIds = [...this.api.getState().activeAmbienceIds];
            for (const id of activeIds) await this.api.stopAmbience(id);
            return this.render(true);
          }
        });
      }
    }
  };

  return QuickAppClass;
}

function getQuickApp(api) {
  const App = getQuickAppClass();
  if (!quickApp || quickApp.api !== api) quickApp = new App(api);
  return quickApp;
}

export function openQuickControl(api) {
  return getQuickApp(api).render(true);
}
