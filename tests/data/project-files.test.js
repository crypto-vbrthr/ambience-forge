import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(target) : [target];
  });
}

test("distribution includes license and current changelog entry", () => {
  const license = fs.readFileSync(path.join(root, "LICENSE"), "utf8");
  const changelog = fs.readFileSync(path.join(root, "CHANGELOG.md"), "utf8");
  assert.match(license, /MIT License/);
  assert.match(changelog, /0\.3\.0-alpha\.4/);
  assert.equal(fs.existsSync(path.join(root, "API.md")), true);
  assert.equal(fs.existsSync(path.join(root, "FORGE_SUITE_INTEGRATION.md")), true);
  const convention = fs.readFileSync(path.join(root, "FORGE_SUITE_INTEGRATION.md"), "utf8");
  assert.match(convention, /setStateForActiveAmbiences/);
  assert.match(convention, /getStateCatalog/);
});

test("manifest and package use the current release entry point", () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, "module.json"), "utf8"));
  const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
  assert.equal(manifest.version, "0.3.0-alpha.4");
  assert.equal(pkg.version, manifest.version);
  assert.deepEqual(manifest.esmodules, ["scripts/main.js"]);
  assert.equal(fs.existsSync(path.join(root, "scripts/main.js")), true);
});

test("distribution contains no obsolete alpha-suffixed runtime JavaScript files", () => {
  const files = walk(path.join(root, "scripts")).map((file) => path.basename(file));
  assert.deepEqual(files.filter((file) => /alpha\d+.*\.js$/i.test(file)), []);
});
