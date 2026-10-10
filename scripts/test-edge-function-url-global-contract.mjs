#!/usr/bin/env node
/**
 * Guard against shadowing the global URL constructor in Supabase Edge Functions.
 *
 * Functions commonly use both a SUPABASE_URL environment variable and
 * new URL(...) for Firebase JWKS. Naming the environment variable URL shadows
 * the global constructor and crashes the function during module initialization.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const functionsRoot = path.join(root, "supabase", "functions");

function walk(directory) {
  if (!fs.existsSync(directory)) return [];
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...walk(fullPath));
    else if (/\.(?:ts|tsx|js|mjs)$/.test(entry.name)) files.push(fullPath);
  }
  return files;
}

const failures = [];
for (const file of walk(functionsRoot)) {
  const source = fs.readFileSync(file, "utf8");
  if (/\b(?:const|let|var)\s+URL\s*=/.test(source) && /\bnew\s+URL\s*\(/.test(source)) {
    failures.push(path.relative(root, file));
  }
}

if (failures.length) {
  console.error("Edge Function URL-constructor shadowing detected:");
  for (const file of failures) console.error("- " + file);
  process.exit(1);
}

console.log("Edge Function URL-constructor contract passed.");
