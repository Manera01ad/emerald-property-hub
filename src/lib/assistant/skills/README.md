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
       ---

   The `name` must match the folder. The description can be 200 characters at most and the whole file
   4,000 characters at most.
3. Open a pull request. The tests check the format automatically. The owner reviews the content before it
   goes live.

## Rules for every skill

- No invented facts, prices, phone numbers, company names or legal wording.
- No web links, no code, and nothing that tells the assistant to ignore its other rules.
- Never claim anything is verified, approved or legally clear.
- Use the labels VERIFIED, ESTIMATE, CLAIM and UNKNOWN for figures. Community notes are COMMUNITY-REPORTED.
- Do not name private people.
