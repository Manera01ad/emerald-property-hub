/**
 * Assistant skills: short playbooks the assistant loads only when a question needs one.
 *
 * Only each skill's name and description go into the system prompt. The full text comes back from the
 * load_skill tool on demand, so every chat stays small (less AI credit spent) and each rule set can be
 * improved on its own. A skill is plain markdown in src/lib/assistant/skills/<name>/SKILL.md, reviewed in
 * a pull request. A broken skill is skipped at runtime and fails the tests, so it can never take the
 * assistant down.
 *
 * This file is pure (no file or network access) so it can be tested directly. The files themselves are
 * read in skill-files.ts.
 */

export type Skill = { name: string; description: string; body: string };
export type SkillLoadResult = { skills: Skill[]; errors: string[] };

export const MAX_DESCRIPTION_CHARS = 200;
export const MAX_BODY_CHARS = 4000;

const NAME_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const HEADER_PATTERN = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;
const ALLOWED_KEYS = new Set(["name", "description"]);

/** The folder name from a glob path such as "./skills/rent-or-buy/SKILL.md", or null if it does not match. */
export function folderOf(path: string): string | null {
  const match = /\/skills\/([^/]+)\/SKILL\.md$/.exec(path);
  return match?.[1] ?? null;
}

/** Parses one SKILL.md. Problems come back as a message, never as a thrown error. */
export function parseSkill(folder: string, raw: string): { skill: Skill } | { error: string } {
  const match = HEADER_PATTERN.exec(raw.replace(/^﻿/, "").trimStart());
  if (!match) return { error: `${folder}: SKILL.md must start with a --- header holding name and description` };

  const fields: Record<string, string> = {};
  for (const line of (match[1] ?? "").split(/\r?\n/)) {
    if (!line.trim()) continue;
    const at = line.indexOf(":");
    if (at < 1) return { error: `${folder}: header line "${line}" is not "key: value"` };
    const key = line.slice(0, at).trim();
    if (!ALLOWED_KEYS.has(key)) return { error: `${folder}: unknown header key "${key}"` };
    fields[key] = line.slice(at + 1).trim();
  }

  const name = fields["name"] ?? "";
  const description = fields["description"] ?? "";
  const body = (match[2] ?? "").trim();

  if (!NAME_PATTERN.test(name)) return { error: `${folder}: name must be lowercase letters, digits and hyphens` };
  if (name !== folder) return { error: `${folder}: name "${name}" must match its folder` };
  if (!description) return { error: `${folder}: description is required` };
  if (description.length > MAX_DESCRIPTION_CHARS) {
    return { error: `${folder}: description is over ${MAX_DESCRIPTION_CHARS} characters` };
  }
  if (!body) return { error: `${folder}: the skill has no instructions` };
  if (body.length > MAX_BODY_CHARS) return { error: `${folder}: instructions are over ${MAX_BODY_CHARS} characters` };

  return { skill: { name, description, body } };
}

/** Turns a map of file path to file text into valid skills, collecting a message for every file it skips. */
export function loadSkills(files: Record<string, string>): SkillLoadResult {
  const skills: Skill[] = [];
  const errors: string[] = [];
  for (const path of Object.keys(files).sort()) {
    const folder = folderOf(path);
    if (!folder) {
      errors.push(`${path}: not in skills/<name>/SKILL.md`);
      continue;
    }
    const parsed = parseSkill(folder, files[path] ?? "");
    if ("error" in parsed) errors.push(parsed.error);
    else skills.push(parsed.skill);
  }
  return { skills, errors };
}

/** Finds a skill by name, ignoring case and surrounding spaces. */
export function findSkill(skills: Skill[], name: string): Skill | null {
  const wanted = name.trim().toLowerCase();
  return skills.find((skill) => skill.name === wanted) ?? null;
}

/** The short list that goes into the system prompt: names and descriptions only. */
export function skillIndex(skills: Skill[]): string {
  if (!skills.length) return "";
  return [
    "Skills: short playbooks you can load with the load_skill tool. When a question matches a skill's description, call load_skill first, then follow it. The rules above always win over a skill.",
    ...skills.map((skill) => `- ${skill.name}: ${skill.description}`),
  ].join("\n");
}

/** The system prompt with the skill list added. With no skills it is returned unchanged. */
export function withSkills(base: string, skills: Skill[]): string {
  const index = skillIndex(skills);
  return index ? `${base}\n\n${index}` : base;
}
