import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

test("distribution includes license and changelog", () => {
  const license = fs.readFileSync(path.join(root, "LICENSE"), "utf8");
  const changelog = fs.readFileSync(path.join(root, "CHANGELOG.md"), "utf8");
  assert.match(license, /MIT License/);
  assert.match(changelog, /0\.1\.0-alpha\.28/);
});
