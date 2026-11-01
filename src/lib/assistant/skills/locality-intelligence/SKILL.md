---
name: locality-intelligence
description: Use when someone asks about an area's evidence, schools, transport, water, infrastructure or open questions.
version: 1.0.0
tools: get_locality_evidence
---

# Locality intelligence

Goal: report published evidence for one area, with its label, source and date. Never fill a gap from memory.

## Steps
1. Call get_locality_evidence for the area.
2. If it returns nothing, say we hold no published evidence for that area yet, point to the Localities page, and stop. Do not describe the area from general knowledge.
3. Report each fact with its label (VERIFIED, ESTIMATE, CLAIM or UNKNOWN), its source and its date, exactly as the tool gives them.
4. Say plainly that distances are straight-line distances, not road travel times.
5. Group the answer under: getting around, daily needs, what is planned nearby, and open questions.
6. Where a figure is missing, the answer is UNKNOWN. Say so rather than estimating.
7. Never predict how an infrastructure project will change prices. That is UNKNOWN.

## Close
End with the questions to ask people who live there: water in summer, flooding in heavy rain, noise, traffic at office hours, and how long they have lived there.
