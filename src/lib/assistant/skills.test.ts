import { describe, expect, it } from "vitest";
import {
  MAX_BODY_CHARS,
  MAX_DESCRIPTION_CHARS,
  findSkill,
  folderOf,
  loadSkills,
  parseSkill,
  skillIndex,
  withSkills,
} from "./skills";
import { SKILLS, SKILL_ERRORS } from "./skill-files";

const good = (name: string) => `---\nname: ${name}\ndescription: Use when testing ${name}.\n---\n\nStep one.\n`;

describe("the skills shipped with the assistant", () => {
  it("all load without a single problem", () => {
    expect(SKILL_ERRORS).toEqual([]);
  });

  it("include the starter set", () => {
    expect(SKILLS.map((s) => s.name).sort()).toEqual(["document-check", "locality-brief", "rent-or-buy"]);
  });

  it("stay within the size limits", () => {
    for (const skill of SKILLS) {
      expect(skill.description.length).toBeGreaterThan(0);
      expect(skill.description.length).toBeLessThanOrEqual(MAX_DESCRIPTION_CHARS);
      expect(skill.body.length).toBeLessThanOrEqual(MAX_BODY_CHARS);
    }
  });

  it("contain no links, code, phone numbers or instructions to drop the other rules", () => {
    for (const skill of SKILLS) {
      const text = `${skill.description}\n${skill.body}`;
      expect(text, `${skill.name} has a link`).not.toMatch(/https?:\/\/|www\./i);
      expect(text, `${skill.name} has code`).not.toMatch(/```/);
      expect(text, `${skill.name} has a phone number`).not.toMatch(/\+?\d[\d\s-]{8,}\d/);
      expect(text, `${skill.name} tells the assistant to ignore rules`).not.toMatch(
        /ignore (all|any|the|your|previous|prior|other)/i,
      );
    }
  });
});

describe("parseSkill", () => {
  it("reads a valid skill", () => {
    const parsed = parseSkill("demo", good("demo"));
    expect(parsed).toEqual({ skill: { name: "demo", description: "Use when testing demo.", body: "Step one." } });
  });

  it("rejects a file with no header", () => {
    expect(parseSkill("demo", "Just text")).toEqual({
      error: expect.stringMatching(/must start with a --- header/),
    });
  });

  it("rejects a name that does not match its folder", () => {
    expect(parseSkill("other", good("demo"))).toEqual({ error: expect.stringMatching(/must match its folder/) });
  });

  it("rejects a bad name, a missing description and unknown header keys", () => {
    expect(parseSkill("Demo", good("Demo"))).toEqual({ error: expect.stringMatching(/lowercase/) });
    expect(parseSkill("demo", "---\nname: demo\n---\nBody")).toEqual({ error: expect.stringMatching(/description is required/) });
    expect(parseSkill("demo", "---\nname: demo\ndescription: x\nowner: me\n---\nBody")).toEqual({
      error: expect.stringMatching(/unknown header key/),
    });
  });

  it("rejects an empty body and over-long text", () => {
    expect(parseSkill("demo", "---\nname: demo\ndescription: x\n---\n   ")).toEqual({
      error: expect.stringMatching(/no instructions/),
    });
    const longDescription = `---\nname: demo\ndescription: ${"x".repeat(MAX_DESCRIPTION_CHARS + 1)}\n---\nBody`;
    expect(parseSkill("demo", longDescription)).toEqual({ error: expect.stringMatching(/description is over/) });
    const longBody = `---\nname: demo\ndescription: x\n---\n${"y".repeat(MAX_BODY_CHARS + 1)}`;
    expect(parseSkill("demo", longBody)).toEqual({ error: expect.stringMatching(/instructions are over/) });
  });

  it("accepts Windows line endings", () => {
    const parsed = parseSkill("demo", good("demo").replace(/\n/g, "\r\n"));
    expect("skill" in parsed && parsed.skill.name).toBe("demo");
  });
});

describe("loadSkills", () => {
  it("keeps valid skills, skips broken ones and reports why", () => {
    const result = loadSkills({
      "./skills/b-skill/SKILL.md": good("b-skill"),
      "./skills/a-skill/SKILL.md": good("a-skill"),
      "./skills/broken/SKILL.md": "no header",
      "./elsewhere/SKILL.md": good("elsewhere"),
    });
    expect(result.skills.map((s) => s.name)).toEqual(["a-skill", "b-skill"]);
    expect(result.errors).toHaveLength(2);
  });

  it("finds the folder in a glob path", () => {
    expect(folderOf("./skills/rent-or-buy/SKILL.md")).toBe("rent-or-buy");
    expect(folderOf("./skills/README.md")).toBeNull();
  });
});

describe("findSkill, skillIndex and withSkills", () => {
  const skills = loadSkills({ "./skills/demo/SKILL.md": good("demo") }).skills;

  it("finds a skill by name, ignoring case and spaces, and returns null for an unknown name", () => {
    expect(findSkill(skills, "  DEMO ")?.name).toBe("demo");
    expect(findSkill(skills, "missing")).toBeNull();
  });

  it("lists names and descriptions only, never the instructions", () => {
    const index = skillIndex(skills);
    expect(index).toContain("- demo: Use when testing demo.");
    expect(index).not.toContain("Step one.");
  });

  it("adds the list after the base prompt, or leaves the prompt alone when there are no skills", () => {
    expect(withSkills("BASE", skills).startsWith("BASE\n\nSkills:")).toBe(true);
    expect(withSkills("BASE", [])).toBe("BASE");
  });
});
