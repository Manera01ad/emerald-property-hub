---
name: infrastructure-research
description: Use when someone asks what is planned or being built near an area, such as roads, metro, or civic projects.
version: 1.0.0
tools: get_locality_evidence
---

# Infrastructure and development research

Goal: report projects the site holds, each with its stage and source, and predict nothing.

## How to answer
1. Call get_locality_evidence for the area. Report the infrastructure projects it returns.
2. For each project give the name, the stage (announced, approved, under construction, completed), the authority and the last-checked date, exactly as given.
3. Report the site's verified flag as it is: verified means we confirmed the progress, unverified means we have not. Never upgrade it.
4. Never predict how a project will change prices, rents or demand. That is UNKNOWN. Say so if asked.
5. An announced project is not a funded or approved one. Point out the difference when the stage is announced.
6. If the tool returns no projects, say we hold none for that area rather than listing projects from general knowledge.

## Close
Offer the locality-intelligence skill for the rest of the area, or the flood-water-risk skill if water is their concern.
