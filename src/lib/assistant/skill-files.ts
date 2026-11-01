import { loadSkills, type Skill } from "./skills";

/**
 * Reads every skills/<name>/SKILL.md at build time as plain text. Vite inlines them, so nothing is read
 * from disk or the network while the assistant runs.
 */
const files = import.meta.glob("./skills/*/SKILL.md", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

const loaded = loadSkills(files);
for (const problem of loaded.errors) console.error("assistant: skipped a skill:", problem);

/** The skills the assistant can load. Invalid ones are left out here and fail the tests. */
export const SKILLS: Skill[] = loaded.skills;
export const SKILL_ERRORS: string[] = loaded.errors;
