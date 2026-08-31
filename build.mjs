#!/usr/bin/env node
/**
 * Concatenates src/ into the single self-contained index.html.
 *
 * The game ships as one file with no dependencies, but 4,000 lines in one
 * document is miserable to edit, so the source lives split by concern in
 * src/ and is joined here in filename order. Edit src/, never index.html.
 *
 *   node build.mjs           write index.html
 *   node build.mjs --check   exit 1 if index.html is out of date (used by CI)
 */
import { readdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = dirname(fileURLToPath(import.meta.url));
const srcDir = join(root, "src");
const out = join(root, "index.html");

const parts = (await readdir(srcDir))
  /* NN-name or NNx-name, so a part can be slotted between two existing ones
     without renumbering everything after it (03b-levels.js sorts between
     03-table.js and 04-physics.js, which is exactly where it has to run) */
  .filter((f) => /^\d\d[a-z]?-.+\.(html|js)$/.test(f))
  .sort();

if (parts.length === 0) {
  console.error("build: no source parts found in src/");
  process.exit(1);
}

const chunks = [];
for (const p of parts) chunks.push(await readFile(join(srcDir, p), "utf8"));
const built = chunks.join("");

if (process.argv.includes("--check")) {
  let current = "";
  try {
    current = await readFile(out, "utf8");
  } catch {
    /* missing counts as out of date */
  }
  if (current !== built) {
    console.error(
      "build --check: index.html does not match src/. Run `npm run build` and commit the result.",
    );
    process.exit(1);
  }
  console.log(`build --check: index.html is up to date (${parts.length} parts, ${built.length} bytes)`);
  process.exit(0);
}

await writeFile(out, built);
console.log(`build: wrote index.html from ${parts.length} parts (${built.length} bytes)`);
for (const p of parts) console.log(`  ${p}`);
