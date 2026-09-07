import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../..");

function read(name) {
  return JSON.parse(fs.readFileSync(path.join(root, "lang", name), "utf8"));
}

test("English and German localization files contain the same keys", () => {
  const en = Object.keys(read("en.json")).sort();
  const de = Object.keys(read("de.json")).sort();
  assert.deepEqual(de, en);
});
