function element(tag, { className = "", text = "" } = {}) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

export async function openStatusDialog(api) {
  // DialogV2 accepts an HTMLDivElement as trusted content, but Foundry V14
  // requires the outermost div itself to be plain (no attributes/classes).
  // Keep all styling on a nested wrapper.
  const root = element("div");
  const content = element("div", { className: "ambience-forge-status" });
  root.append(content);

  const intro = element("p", { text: game.i18n.localize("AMBIENCE_FORGE.Status.Foundation") });
  content.append(intro);

  const list = element("dl", { className: "ambience-forge-status-grid" });
  const rows = [
    ["AMBIENCE_FORGE.Status.ModuleVersion", api.getModuleVersion()],
    ["AMBIENCE_FORGE.Status.ApiVersion", api.version],
    ["AMBIENCE_FORGE.Status.Compositions", String(api.getAmbiences().length)],
    ["AMBIENCE_FORGE.Status.Active", String(api.getState().activeAmbienceIds.length)]
  ];
  for (const [key, value] of rows) {
    list.append(element("dt", { text: game.i18n.localize(key) }));
    list.append(element("dd", { text: value }));
  }
  content.append(list);

  const DialogV2 = foundry.applications.api.DialogV2;
  return DialogV2.prompt({
    window: { title: game.i18n.localize("AMBIENCE_FORGE.Title") },
    content: root,
    ok: { label: game.i18n.localize("AMBIENCE_FORGE.Common.Close"), icon: "fa-solid fa-check" },
    rejectClose: false,
    modal: false
  });
}

export function notifyStopped() {
  ui.notifications.info(game.i18n.localize("AMBIENCE_FORGE.Notifications.StoppedAll"));
}
