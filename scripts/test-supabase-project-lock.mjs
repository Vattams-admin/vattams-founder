#!/usr/bin/env node
/**
 * Keep all GitHub Actions deployments and build-time URLs pinned to the
 * canonical VATTAMS Academia Supabase project. The project ref and API URL
 * are public identifiers, not secrets; using mutable repository secrets here
 * risks silently targeting a different project.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const EXPECTED_REF = "ljnfktzrjewqjxxchvud";
const EXPECTED_URL = "https://ljnfktzrjewqjxxchvud.supabase.co";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const workflowRoot = path.join(root, ".github", "workflows");

function walk(directory) {
  if (!fs.existsSync(directory)) return [];
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...walk(fullPath));
    else if (/\.(?:yml|yaml)$/.test(entry.name)) files.push(fullPath);
  }
  return files;
}

const failures = [];
for (const file of walk(workflowRoot)) {
  const source = fs.readFileSync(file, "utf8");
  const relative = path.relative(root, file);
  if (/secrets\.SUPABASE_PROJECT_ID/.test(source)) {
    failures.push(relative + ": project ref must not come from SUPABASE_PROJECT_ID secret");
  }
  if (/secrets\.VITE_SUPABASE_URL/.test(source)) {
    failures.push(relative + ": Supabase URL must not come from VITE_SUPABASE_URL secret");
  }
  if (/nfcibyprftnowaiwlxxc/i.test(source)) {
    failures.push(relative + ": contains the retired Supabase project ref");
  }
  for (const match of source.matchAll(/^\s*(?:SUPABASE_URL|VITE_SUPABASE_URL):\s*(https?:\/\/[^\s]+)\s*$/gm)) {
    if (match[1] !== EXPECTED_URL) {
      failures.push(relative + ": unexpected Supabase URL " + match[1]);
    }
  }
  for (const match of source.matchAll(/^\s*(?:SUPABASE_PROJECT_ID|PROJECT_ID):\s*([a-z0-9]{20})\s*$/gm)) {
    if (match[1] !== EXPECTED_REF) {
      failures.push(relative + ": unexpected Supabase project ref " + match[1]);
    }
  }
}

if (failures.length) {
  console.error("Supabase project lock validation failed:");
  for (const failure of [...new Set(failures)]) console.error("- " + failure);
  process.exit(1);
}

console.log("Supabase project lock passed: GitHub Actions are pinned to " + EXPECTED_REF + ".");
