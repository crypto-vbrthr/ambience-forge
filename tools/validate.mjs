import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const jsonFiles = ["module.json", "package.json", "lang/en.json", "lang/de.json"];
for (const file of jsonFiles) JSON.parse(fs.readFileSync(path.join(root, file), "utf8"));

const en = JSON.parse(fs.readFileSync(path.join(root, "lang/en.json"), "utf8"));
const de = JSON.parse(fs.readFileSync(path.join(root, "lang/de.json"), "utf8"));
const enKeys = Object.keys(en).sort();
const deKeys = Object.keys(de).sort();
if (JSON.stringify(enKeys) !== JSON.stringify(deKeys)) {
  throw new Error("Localization key mismatch between en.json and de.json");
}

const manifest = JSON.parse(fs.readFileSync(path.join(root, "module.json"), "utf8"));
if (manifest.id !== "ambience-forge") throw new Error("Manifest id must remain ambience-forge");
if (!manifest.socket) throw new Error("Ambience Forge requires its module socket namespace");
console.log("Ambience Forge validation passed.");
