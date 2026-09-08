import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function readJson(file) {
  return JSON.parse(fs.readFileSync(path.join(root, file), "utf8"));
}

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(target) : [target];
  });
}

for (const file of ["module.json", "package.json", "lang/en.json", "lang/de.json"]) readJson(file);

const en = readJson("lang/en.json");
const de = readJson("lang/de.json");
const enKeys = Object.keys(en).sort();
const deKeys = Object.keys(de).sort();
if (JSON.stringify(enKeys) !== JSON.stringify(deKeys)) {
  throw new Error("Localization key mismatch between en.json and de.json");
}

const manifest = readJson("module.json");
const pkg = readJson("package.json");
if (manifest.id !== "ambience-forge") throw new Error("Manifest id must remain ambience-forge");
if (!manifest.socket) throw new Error("Ambience Forge requires its module socket namespace");
if (manifest.version !== pkg.version) throw new Error("module.json and package.json versions must match");
if (JSON.stringify(manifest.esmodules) !== JSON.stringify(["scripts/main.js"])) {
  throw new Error("Manifest must use the stable scripts/main.js entry point");
}
for (const relative of [...manifest.esmodules, ...(manifest.styles ?? []), ...(manifest.languages ?? []).map((language) => language.path)]) {
  if (!fs.existsSync(path.join(root, relative))) throw new Error(`Manifest file does not exist: ${relative}`);
}

const scriptFiles = walk(path.join(root, "scripts")).filter((file) => file.endsWith(".js"));
const stale = scriptFiles.filter((file) => /alpha\d+.*\.js$/i.test(path.basename(file)));
if (stale.length) throw new Error(`Obsolete alpha runtime files remain: ${stale.map((file) => path.relative(root, file)).join(", ")}`);

for (const file of scriptFiles) {
  const check = spawnSync(process.execPath, ["--check", file], { encoding: "utf8" });
  if (check.status !== 0) throw new Error(`JavaScript syntax check failed for ${path.relative(root, file)}:\n${check.stderr}`);

  const source = fs.readFileSync(file, "utf8");
  const importPattern = /(?:from\s+|import\s*)["'](\.{1,2}\/[^"']+)["']/g;
  for (const match of source.matchAll(importPattern)) {
    const target = path.resolve(path.dirname(file), match[1]);
    if (!fs.existsSync(target)) throw new Error(`Missing relative import from ${path.relative(root, file)}: ${match[1]}`);
  }
}

console.log("Ambience Forge validation passed.");
