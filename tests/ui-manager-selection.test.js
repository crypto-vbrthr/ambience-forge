import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { resolveEditorTarget } from "../scripts/ui/ambience-manager-alpha16.js";

const source = fs.readFileSync(new URL("../scripts/ui/ambience-manager-alpha16.js", import.meta.url), "utf8");

test("editor target preserves the selected existing ambience id and data", () => {
  const ambience = { id: "ambience-selected", name: "Selected", tracks: [] };
  const api = { getAmbience: (id) => id === ambience.id ? structuredClone(ambience) : null };
  assert.deepEqual(resolveEditorTarget(api, ambience.id), {
    id: ambience.id,
    ambience,
    isNew: false
  });
});

test("only an explicit empty id resolves to a new ambience", () => {
  const api = { getAmbience: () => { throw new Error("must not fetch for new ambience"); } };
  const target = resolveEditorTarget(api, "");
  assert.equal(target.id, null);
  assert.equal(target.isNew, true);
  assert.equal(target.ambience.name, "");
});

test("unknown non-empty ids never silently become new ambiences", () => {
  const api = { getAmbience: () => null };
  assert.equal(resolveEditorTarget(api, "ambience-missing"), null);
});

test("manager edit action switches the same ApplicationV2 instance to the selected id", () => {
  assert.match(source, /if \(action === "edit"\) return this\.showEditor\(selectedId\)/);
  assert.match(source, /this\.ambienceId = target\.id/);
  assert.match(source, /this\.draft = draft \? cloneData\(draft\) : cloneData\(target\.ambience\)/);
});
