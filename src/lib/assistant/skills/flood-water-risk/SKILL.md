---
name: flood-water-risk
description: Use when someone asks about flooding, waterlogging, drainage or water supply for a property or area.
version: 1.1.0
tools: get_locality_evidence
---

# Flood, water and environmental risk

Goal: be honest that this is one of the weakest evidence areas we hold. Do not reassure.

## Say first
The site cannot tell anyone a property is flood-free or safe from waterlogging. We hold no flood map and no record of past waterlogging. Say this plainly.

## How to answer
1. Call get_locality_evidence and use its `flood` field. Start with its headline.
2. Report each fact in `flood.facts` with its evidence label exactly as given (Estimate, Official source or Unknown), plus its note. Never upgrade a label. If a fact has an Official source label, name the source and the date given.
3. Height above sea level is an ESTIMATE from open data, not a flood map, and nearby mapped water is context, not a flood assessment. Say so.
4. Facts marked Unknown stay unknown. Do not fill them from general knowledge, news or memory. Read out the `flood.unknowns` list.
5. Give the person the `flood.groundChecks` list. These are the checks only they can run on the ground.
6. Never give a probability, a return period or a risk score. We hold no such data.

## Close
Offer the locality-intelligence skill for the rest of the area, or the Consult page.
