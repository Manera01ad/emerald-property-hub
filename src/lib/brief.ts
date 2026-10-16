import { purchaseCost, type CostRules } from "./deal";

/** Buyer due-diligence brief built from listing data and official Tamil Nadu sources. No guesses: every step names where to check. */

export type BriefProperty = {
  property_type: string;
  asking_price: number;
  guideline_value: number | null;
  survey_number: string | null;
  approvals: string[] | null;
  rera_number: string | null;
  verification_status: string;
  doc_patta: boolean;
  doc_title_deed: boolean;
  doc_encumbrance: boolean;
  doc_approved_plan: boolean;
  doc_building_permit: boolean;
};

export type StepStatus = "seen" | "needed";
export type Step = { id: string; title: string; why: string; status: StepStatus; link: { label: string; url: string } };

const L = {
  eservices: { label: "TN e-Services (Patta/Chitta)", url: "https://eservices.tn.gov.in/" },
  tnreginet: { label: "TNREGINET (EC & guideline value)", url: "https://tnreginet.gov.in/" },
  rera: { label: "TNRERA registrations", url: "https://rera.tn.gov.in/" },
  cmda: { label: "CMDA (inside Chennai Metropolitan Area)", url: "https://www.cmdachennai.gov.in/" },
  dtcp: { label: "DTCP layout approvals (outside CMA)", url: "https://www.dtcp.tn.gov.in/" },
};

export function buildBrief(p: BriefProperty, rules: CostRules) {
  const isPlot = p.property_type === "plot";
  const reraApplies = !!p.approvals?.includes("RERA") || p.property_type === "apartment" || p.property_type === "villa";
  const steps: Step[] = [
    { id: "patta", title: "Patta / Chitta", why: "Owner name and survey number must match the seller and the sale deed.", status: p.doc_patta ? "seen" : "needed", link: L.eservices },
    { id: "title", title: "Title deed and parent documents", why: "Shows how the seller got the property. Have a lawyer check the chain of ownership.", status: p.doc_title_deed ? "seen" : "needed", link: L.tnreginet },
    { id: "ec", title: "Encumbrance certificate (EC)", why: "Shows loans, mortgages and earlier sales on the property. Ask for at least 13 years, ideally 30.", status: p.doc_encumbrance ? "seen" : "needed", link: L.tnreginet },
    { id: "plan", title: isPlot ? "Approved layout" : "Approved plan", why: "Unapproved layouts can be refused loans and registration. CMDA covers Chennai Metropolitan Area; DTCP covers the rest.", status: p.doc_approved_plan ? "seen" : "needed", link: L.dtcp },
  ];
  if (!isPlot) steps.push({ id: "permit", title: "Building permit and completion certificate", why: "Confirms the building was built as approved.", status: p.doc_building_permit ? "seen" : "needed", link: L.cmda });
  if (reraApplies) steps.push({ id: "rera", title: "RERA registration", why: "Check the registration number, project status and promoter on the official site.", status: p.rera_number ? "seen" : "needed", link: L.rera });
  steps.push({ id: "gv", title: "Guideline value and duties", why: "Stamp duty and registration are charged on the higher of price and guideline value.", status: p.guideline_value ? "seen" : "needed", link: L.tnreginet });

  const cost = purchaseCost(p, rules);

  const redFlags: string[] = [];
  const gv = Number(p.guideline_value) || 0;
  if (gv > 0 && p.asking_price < gv * 0.7) redFlags.push("Asking price is well below the guideline value. Ask why, and be wary of any part-payment in cash.");
  if (gv > 0 && p.asking_price > gv * 3) redFlags.push("Asking price is more than three times the guideline value. Compare with recent registered sales nearby.");
  if (p.approvals?.includes("RERA") && !p.rera_number) redFlags.push("RERA is claimed but no registration number is given.");
  if (p.verification_status !== "verified") redFlags.push("This listing has not been verified by PropWise. Treat every detail as the seller's claim until you see the documents.");

  const questions: string[] = [];
  if (!p.survey_number) questions.push("What is the survey number and sub-division?");
  questions.push("Is there any loan, mortgage or legal dispute on the property?");
  questions.push("Are property tax and electricity bills paid up to date?");
  questions.push("Why is the owner selling, and is the price negotiable?");
  if (!isPlot) questions.push("Which year was it built, and are there any structural changes since approval?");
  if (isPlot) questions.push("What is the access road width, and is the land classified as residential?");

  const seen = steps.filter((s) => s.status === "seen").length;
  return {
    steps, redFlags, questions, cost,
    readiness: { seen, total: steps.length },
    sitePrompt: "Visit after rain if you can, and ask neighbours about flooding, water supply and road access. Documents cannot show these.",
  };
}
