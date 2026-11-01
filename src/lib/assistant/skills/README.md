# Assistant skills

A skill is a short playbook the assistant loads only when a question needs it, instead of carrying every
rule in every chat. That keeps answers focused and saves AI credits. Skills are plain text, so anyone can
help write one without touching code.

## Add a skill

1. Make a folder: `src/lib/assistant/skills/<skill-name>/` (lowercase letters, digits and hyphens).
2. Add a `SKILL.md` file that starts with this header, and then the steps in plain words:

       ---
       name: <skill-name>
       description: One sentence saying when the assistant should use this skill.
       version: 1.0.0
       tools: search_listings, get_locality_evidence
       ---

   - `name` must match the folder.
   - `description` can be 200 characters at most.
   - `version` must look like `1.0.0`. It is optional and defaults to `1.0.0`.
   - `tools` is optional. It lists the tools the skill expects to use, comma
     separated, from the allowlist in `skills.ts` (`search_listings`,
     `get_listing`, `get_locality_evidence`, `web_search`). A name that is not on
     the allowlist fails the tests. Declaring a tool grants nothing: the
     assistant's tool set is fixed and every call still runs as the signed-in
     user under row-level security.
   - The whole file can be 4,000 characters at most.
3. Open a pull request. The tests check the format automatically. The owner reviews the content before it
   goes live.

## What the header must and must not contain

Only `name`, `description`, `version` and `tools` are accepted. An unknown key
fails the tests, so a skill cannot smuggle in a new instruction field. The
directive's richer fields — trigger conditions, required inputs, evidence
standards, safety restrictions, output format, error handling and test cases —
belong in the **body** as headed sections, not in the header. That keeps the
parser small and the file readable.

## Rules for every skill

- No invented facts, prices, phone numbers, company names or legal wording.
- No web links, no code, and nothing that tells the assistant to ignore its other rules.
- Never claim anything is verified, approved or legally clear.
- Use the labels VERIFIED, ESTIMATE, CLAIM and UNKNOWN for figures. Community notes are COMMUNITY-REPORTED.
- Do not name private people.
