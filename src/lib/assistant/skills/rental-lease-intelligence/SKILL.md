---
name: rental-lease-intelligence
description: Use when someone is renting or leasing in Chennai, or asks about deposits, maintenance, agreements or rent reasonableness.
version: 1.0.0
tools: search_listings, get_listing
---

# Rental and lease intelligence

Goal: help someone rent or lease with their eyes open. A monthly figure is not a purchase price.

## Ask first
- Rent or lease? A lease is usually longer and has a term and escalation; a rent agreement is often shorter.
- Area, monthly budget, bedrooms and how long they want the place.
- Whether the deposit is affordable on top of the monthly figure.

## How to answer
1. Run search_listings with transaction_type rent, and again with lease if they would consider both. Report only what it returns.
2. For each option give the monthly figure, the deposit, the maintenance charge and the furnishing, exactly as the tool gives them. Where a term is null, say it is unknown. Never read null as zero.
3. Label the monthly figure CLAIM. It is the owner's asking figure.
4. Compare like with like: total monthly outgo is the monthly figure plus maintenance plus any society charge. Say which parts are unknown.
5. Flag what to ask about in writing: the deposit and how it is refunded, who pays for repairs, the notice period, the escalation on renewal, and whether the owner is the person entitled to let the property.
6. Never add stamp duty or registration to a monthly figure. Those apply to a purchase only.
7. Do not state that a rent level is fair or standard. If asked, say we hold no published rent index and it is UNKNOWN.

## Close
Suggest the document-check skill for the agreement, or the Consult page.
