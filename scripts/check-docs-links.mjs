#!/usr/bin/env node
/**
 * Relative-link checker for the repository's Markdown.
 *
 * Documentation moves quickly here. This fails when a relative link points at a
 * file that does not exist, so a reorganised folder cannot silently leave dead
 * links behind. External links (http, mailto) and pure anchors are not checked.
 *
 * Usage:
 *   bun run check:docs          # or: node scripts/check-docs-links.mjs
 *   node scripts/check-docs-links.mjs --quiet
 */
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

const root = resolve(process.cwd());
const quiet = process.argv.includes("--quiet");
const SKIP_DIRS = new Set([
  ".git",
  "node_modules",
  "dist",
  ".output",
  ".tanstack",
  ".nitro",
  "test-results",
  "playwright-report",
  "coverage",
  ".tmp",
]);
const SKIP_PREFIXES = [".agents/worktrees/"];
const LINK = /!?\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const path = join(dir, name);
    const rel = relative(root, path).replaceAll("\\", "/");
    if (SKIP_PREFIXES.some((prefix) => rel.startsWith(prefix))) continue;
    const stat = statSync(path);
    if (stat.isDirectory()) walk(path, out);
    else if (/\.mdx?$/.test(name)) out.push(path);
  }
  return out;
}

const broken = [];
let linkCount = 0;

for (const file of walk(root)) {
  const text = readFileSync(file, "utf8");
  const relFile = relative(root, file).replaceAll("\\", "/");
  let match;
  LINK.lastIndex = 0;
  while ((match = LINK.exec(text))) {
    const target = match[1];
    if (/^(https?:|mailto:|#)/i.test(target)) continue;
    linkCount += 1;
    const [pathPart] = target.split("#");
    if (!pathPart) continue;
    const resolved = resolve(dirname(file), pathPart);
    if (!existsSync(resolved)) {
      const line = text.slice(0, match.index).split("\n").length;
      broken.push({ file: relFile, line, target });
    }
  }
}

if (broken.length > 0) {
  console.error(`Broken relative links: ${broken.length} of ${linkCount} checked`);
  for (const { file, line, target } of broken) console.error(`  ${file}:${line}  ->  ${target}`);
  process.exit(1);
}

if (!quiet) console.log(`Relative links OK: ${linkCount} checked across ${walk(root).length} Markdown files`);
