/**
 * The starter challenges shown on /contribute.
 *
 * These are proposals, not offers. Nothing here can be started or paid until the
 * owner approves it and confirms the funding, which is why there is no reward
 * amount: a number in this file would be read as a promise. The reward line is
 * set by the owner before work starts, and the page says so.
 *
 * Kept apart from the page so the wording can be tested without rendering it.
 */

export type Challenge = {
  /** Stable identifier, used as a React key and in tests. */
  id: string;
  title: string;
  summary: string;
  /** What "done" means. Checked against the deliverables before anything is paid. */
  done: string[];
};

export const CHALLENGES: Challenge[] = [
  {
    id: "local-rental-intelligence",
    title: "Local rental intelligence",
    summary: "Collect 20 consented rental observations from Guduvancheri and Potheri.",
    done: [
      "20 observations collected.",
      "Collection dates recorded for each one.",
      "Locality information for each one.",
      "Evidence or source notes for each one.",
      "No unnecessary personal details included.",
    ],
  },
  {
    id: "authorised-property-listings",
    title: "Authorised property listings",
    summary: "Document 10 property listings with the owner's permission.",
    done: [
      "Evidence of the owner's permission for each listing.",
      "Property information for each listing.",
      "Source details for each listing.",
      "Approved photographs only.",
      "Duplicate checks carried out.",
    ],
  },
  {
    id: "tn-property-charges",
    title: "Tamil Nadu property charges",
    summary:
      "Check current stamp-duty and registration charges against official government sources.",
    done: [
      "Official source links.",
      "Applicable property or transaction categories.",
      "The date the charges were verified.",
      "Any differences from the current calculator listed.",
      "Clear notes on what remains uncertain.",
    ],
  },
  {
    id: "tamil-translation",
    title: "Tamil translation",
    summary: "Translate the property cost calculator page into natural, understandable Tamil.",
    done: [
      "The complete interface translated.",
      "Financial terminology used consistently.",
      "No changes to the calculation logic.",
      "Readable on a mobile screen.",
      "Copy ready for review.",
    ],
  },
  {
    id: "mobile-testing",
    title: "Mobile testing",
    summary: "Test the website at a viewport width of 375px.",
    done: [
      "Main navigation tested.",
      "AI consultant tested.",
      "Property pages tested.",
      "Forms tested.",
      "Reproducible bug reports, with screenshots where appropriate.",
    ],
  },
];

/**
 * The notices that must appear on the page. Held here so a test can assert that
 * each one is present, because omitting any of them would mislead a contributor.
 */
export const CONTRIBUTE_NOTICES = [
  "These are proposed challenges, not guaranteed paid opportunities.",
  "A task becomes open only after the owner approves it and confirms funding.",
  "Contributors must provide appropriate consent.",
  "Personal information must remain private.",
  "Intellectual-property ownership and licensing are subject to a written contributor agreement and legal review.",
  "No referral, recruitment or multi-level rewards are offered.",
  "No contributor should start paid work without written acceptance of the task and reward.",
] as const;

/** The six steps a challenge goes through, in order. */
export const CONTRIBUTE_STEPS = [
  "The owner publishes an approved challenge.",
  "A contributor submits a short proposal.",
  "The owner selects a contributor.",
  "The contributor completes the agreed work.",
  "The owner checks the deliverables against published criteria.",
  "Accepted work is credited and paid according to the written agreement.",
] as const;
