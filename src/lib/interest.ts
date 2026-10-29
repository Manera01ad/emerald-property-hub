/** Pure rules for interest requests. No I/O here, so they stay testable. */

export const INTEREST_CONSENT_VERSION = "interest-consent-2026-03";

export const INTEREST_CONSENT_TEXT =
  "I want PropWise AI to pass my interest in this listing to the team, so they can arrange next steps. " +
  "I understand PropWise does not charge me a commission for this, does not act for the seller, and does not share the owner's contact details with me.";

export type InterestInput = {
  consent: boolean;
  message: string;
};

export type InterestValidation = { ok: true } | { ok: false; error: string };

/** A request needs consent and a short note; an empty or very long note is rejected. */
export function validateInterest(input: InterestInput): InterestValidation {
  if (!input.consent) return { ok: false, error: "Please tick the consent box to continue." };
  const message = input.message.trim();
  if (message.length < 10) return { ok: false, error: "Add a short note (at least 10 characters) so we can help." };
  if (message.length > 2000) return { ok: false, error: "Keep the note under 2000 characters." };
  return { ok: true };
}

export type InterestRequest = {
  propertyId: string;
  name: string;
  phone: string;
  email: string | null;
  message: string;
};

/** The row an interest request writes. Consent and its wording version are always included. */
export function interestRow(request: InterestRequest) {
  return {
    enquiry_type: "interest" as const,
    property_id: request.propertyId,
    name: request.name.trim(),
    phone: request.phone.trim(),
    email: request.email,
    message: request.message.trim(),
    consent: true as const,
    consent_version: INTEREST_CONSENT_VERSION,
  };
}
