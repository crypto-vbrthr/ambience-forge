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

export function resolveManagerSelection(button = null, dialog = null, fallbackId = "") {
  // Prefer the live DialogV2 form/DOM. Button.form can be absent or stale in
  // some V14 interaction paths, and a tracked fallback must never override
  // what is currently selected in the rendered dropdown.
  const candidates = [
    dialog?.form?.elements?.ambienceId?.value,
    dialog?.element?.querySelector?.('select[name="ambienceId"]')?.value,
    button?.form?.elements?.ambienceId?.value,
    fallbackId
  ];
  for (const candidate of candidates) {
    const value = String(candidate ?? "").trim();
    if (value) return value;
  }
  return "";
}

function managerActionButton(action, labelKey, iconClass) {
  const button = element("button", {
    attrs: {
      type: "button",
      "data-af-manager-action": action
    }
  });
  if (iconClass) {
    const icon = element("i", { className: iconClass });
    icon.setAttribute("aria-hidden", "true");
    button.append(icon, document.createTextNode(` ${game.i18n.localize(labelKey)}`));
  } else {
    button.textContent = game.i18n.localize(labelKey);
  }
  return button;
}

function managerContent(api) {
  // DialogV2 trusted HTMLElement content requires a plain outer div in V14.
  const root = element("div");
  const wrapper = element("div", { className: "ambience-forge-manager" });
  root.append(wrapper);

  const ambiences = api.getAmbiences();
  const active = new Set(api.getState().activeAmbienceIds);
  wrapper.append(element("p", { className: "hint", text: game.i18n.localize("AMBIENCE_FORGE.Manager.Hint") }));

  if (!ambiences.length) {
    wrapper.append(element("div", {
      className: "ambience-forge-empty",
      text: game.i18n.localize("AMBIENCE_FORGE.Manager.Empty")
    }));
  } else {
    const options = ambiences
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((ambience) => ({
        value: ambience.id,
        label: `${active.has(ambience.id) ? "▶ " : ""}${ambience.name} (${ambience.tracks.length})`
      }));
    wrapper.append(field("AMBIENCE_FORGE.Manager.Composition", select("ambienceId", options, options[0]?.value)));
  }

  // Manager actions deliberately live inside the dialog content instead of
  // DialogV2's submit footer. Foundry 14.361 and later have had subtle
  // differences in DialogV2 submit/callback behaviour. These are ordinary
  // type=button controls, wired after render, so editing can never be
  // interpreted as creating a new composition by the dialog machinery.
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

export function readManagerSelection(root) {
  return String(root?.querySelector?.('select[name="ambienceId"]')?.value ?? "").trim();
}

export async function openAmbienceManager(api) {
  const DialogV2 = foundry.applications.api.DialogV2;
  const dialog = new DialogV2({
    window: { title: game.i18n.localize("AMBIENCE_FORGE.Manager.Title") },
    position: { width: 620 },
    content: managerContent(api),
    buttons: [
      {
        action: "close",
        label: game.i18n.localize("AMBIENCE_FORGE.Common.Close"),
        icon: "fa-solid fa-xmark"
      }
    ]
  });

  dialog.addEventListener("render", () => {
    const root = dialog.element;
    if (!root) return;

    for (const button of root.querySelectorAll?.("[data-af-manager-action]") ?? []) {
      button.addEventListener("click", async (event) => {
        event.preventDefault();
        event.stopPropagation();

        const action = button.dataset.afManagerAction;
        const id = action === "new" ? "" : readManagerSelection(root);

        // Close this manager first so the editor/confirmation dialog opens as
        // an independent application rather than as part of the current form
        // submission lifecycle.
        await dialog.close();
        await handleManagerResult(api, { action, id });
      });
    }
  });

  return dialog.render(true);
}

async function handleManagerResult(api, result) {
  if (!result || result === "close") return;
  if (result.action === "new") {
    return openAmbienceEditor(api, null);
  }
  if (!["edit", "play", "stop", "duplicate", "delete"].includes(result.action)) return;
  if (!requireSelection(result.id)) return openAmbienceManager(api);

  if (result.action === "edit") {
    if (!api.getAmbience(result.id)) {
      ui.notifications.error(game.i18n.localize("AMBIENCE_FORGE.Notifications.AmbienceNotFound"));
      return openAmbienceManager(api);
    }
    return openAmbienceEditor(api, result.id);
  }
  if (result.action === "play") {
    try {
      await api.playAmbience(result.id);
    } catch (error) {
      console.error("ambience-forge | play failed", error);
      ui.notifications.error(error.message);
    }
    return openAmbienceManager(api);
  }
  if (result.action === "stop") {
    await api.stopAmbience(result.id);
    return openAmbienceManager(api);
  }
  if (result.action === "duplicate") {
    const ambience = api.getAmbience(result.id);
    if (ambience) {
      const copy = cloneData(ambience);
      delete copy.id;
      copy.name = game.i18n.format("AMBIENCE_FORGE.Manager.CopyName", { name: ambience.name });
      for (const track of copy.tracks ?? []) delete track.id;
      const saved = await api.upsertAmbience(copy);
      return openAmbienceEditor(api, saved.id);
    }
    return openAmbienceManager(api);
  }
  if (result.action === "delete") {
    const ambience = api.getAmbience(result.id);
    if (!ambience) return openAmbienceManager(api);
    const confirmed = await foundry.applications.api.DialogV2.confirm({
      window: { title: game.i18n.localize("AMBIENCE_FORGE.Common.Delete") },
      content: `<p>${game.i18n.format("AMBIENCE_FORGE.Manager.DeleteConfirm", { name: ambience.name })}</p>`,
      yes: { label: game.i18n.localize("AMBIENCE_FORGE.Common.Delete"), icon: "fa-solid fa-trash" },
      no: { label: game.i18n.localize("AMBIENCE_FORGE.Common.Cancel"), icon: "fa-solid fa-xmark" },
      rejectClose: false,
      modal: true
    });
    if (confirmed) await api.deleteAmbience(result.id);
    return openAmbienceManager(api);
  }
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
  return root;
}

function readAmbienceForm(form, existing) {
  return {
    ...(existing ?? {}),
    name: String(form.elements.name?.value ?? "").trim(),
    description: String(form.elements.description?.value ?? ""),
    transitionMs: milliseconds(form.elements.transitionSeconds?.value ?? 3),
    tracks: cloneData(existing?.tracks ?? [])
  };
}

export async function openAmbienceEditor(api, ambienceId = null, draft = null) {
  const existing = ambienceId ? api.getAmbience(ambienceId) : null;
  if (ambienceId && !existing) {
    ui.notifications.error(game.i18n.localize("AMBIENCE_FORGE.Notifications.AmbienceNotFound"));
    return openAmbienceManager(api);
  }
  const ambience = draft ?? existing ?? { name: "", description: "", transitionMs: 3000, tracks: [] };
  const DialogV2 = foundry.applications.api.DialogV2;
  const dialog = new DialogV2({
    window: { title: existing ? game.i18n.format("AMBIENCE_FORGE.Editor.TitleEdit", { name: existing.name }) : game.i18n.localize("AMBIENCE_FORGE.Editor.TitleNew") },
    position: { width: 680 },
    content: editorContent(ambience),
    buttons: [
      {
        action: "save",
        label: game.i18n.localize("AMBIENCE_FORGE.Common.Save"),
        icon: "fa-solid fa-floppy-disk",
        default: true,
        callback: (event, button) => ({ action: "save", data: readAmbienceForm(button.form, ambience) })
      },
      {
        action: "add-loop",
        label: game.i18n.localize("AMBIENCE_FORGE.Editor.AddLoop"),
        icon: "fa-solid fa-repeat",
        callback: (event, button) => ({ action: "add-loop", data: readAmbienceForm(button.form, ambience) })
      },
      {
        action: "edit-track",
        label: game.i18n.localize("AMBIENCE_FORGE.Editor.EditTrack"),
        icon: "fa-solid fa-pen-to-square",
        callback: (event, button) => ({
          action: "edit-track",
          trackId: button.form.elements.trackId?.value ?? "",
          data: readAmbienceForm(button.form, ambience)
        })
      },
      {
        action: "delete-track",
        label: game.i18n.localize("AMBIENCE_FORGE.Editor.DeleteTrack"),
        icon: "fa-solid fa-trash",
        callback: (event, button) => ({
          action: "delete-track",
          trackId: button.form.elements.trackId?.value ?? "",
          data: readAmbienceForm(button.form, ambience)
        })
      },
      {
        action: "back",
        label: game.i18n.localize("AMBIENCE_FORGE.Common.Back"),
        icon: "fa-solid fa-arrow-left"
      }
    ],
    submit: (result) => void handleEditorResult(api, ambienceId, result)
  });
  return dialog.render(true);
}

async function saveAmbienceDraft(api, ambienceId, data) {
  if (!data.name) {
    ui.notifications.warn(game.i18n.localize("AMBIENCE_FORGE.Notifications.NameRequired"));
    return null;
  }
  return api.upsertAmbience({ ...(data ?? {}), ...(ambienceId ? { id: ambienceId } : {}) });
}

async function handleEditorResult(api, ambienceId, result) {
  if (!result || result === "back") return openAmbienceManager(api);
  const saved = await saveAmbienceDraft(api, ambienceId, result.data);
  if (!saved) return openAmbienceEditor(api, ambienceId, result.data);

  if (result.action === "save") {
    ui.notifications.info(game.i18n.localize("AMBIENCE_FORGE.Notifications.Saved"));
    return openAmbienceManager(api);
  }
  if (result.action === "add-loop") return openLoopTrackEditor(api, saved.id, null);
  if (result.action === "edit-track") {
    if (!requireTrackSelection(result.trackId)) return openAmbienceEditor(api, saved.id);
    const track = saved.tracks.find((candidate) => candidate.id === result.trackId);
    if (!track) return openAmbienceEditor(api, saved.id);
    if (track.type !== TRACK_TYPES.LOOP) {
      ui.notifications.warn(game.i18n.localize("AMBIENCE_FORGE.Notifications.TrackEditorNotAvailable"));
      return openAmbienceEditor(api, saved.id);
    }
    return openLoopTrackEditor(api, saved.id, track.id);
  }
  if (result.action === "delete-track") {
    if (!requireTrackSelection(result.trackId)) return openAmbienceEditor(api, saved.id);
    saved.tracks = saved.tracks.filter((track) => track.id !== result.trackId);
    await api.upsertAmbience(saved);
    return openAmbienceEditor(api, saved.id);
  }
  return openAmbienceEditor(api, saved.id);
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
