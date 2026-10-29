/** Pure rules for the community. No I/O here, so they stay testable. */

export const POST_MAX_CHARS = 2000;
export const TITLE_MAX_CHARS = 120;
export const POSTS_PER_DAY_LIMIT = 10;
export const NEW_ACCOUNT_DAYS = 7;
export const AUTO_HIDE_REPORTS = 3;

export const COMMUNITY_CATEGORIES = ["localities", "buying", "documents", "construction", "general"] as const;
export type CommunityCategory = (typeof COMMUNITY_CATEGORIES)[number];

export const CATEGORY_LABELS: Record<CommunityCategory, string> = {
  localities: "Localities",
  buying: "Buying process",
  documents: "Documents and approvals",
  construction: "Construction and upkeep",
  general: "General",
};

export type PostStatus = "pending" | "published" | "hidden" | "removed";

export const STATUS_LABELS: Record<PostStatus, string> = {
  pending: "Waiting for review",
  published: "Published",
  hidden: "Hidden pending review",
  removed: "Removed",
};

/**
 * Contact details must not appear in public posts, so buyers and owners are not put in
 * touch directly and no personal number ends up indexed. We reject rather than redact,
 * so nobody assumes a hidden number was delivered.
 */
const EMAIL = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i;
const PHONE = /(?:\+?91[\s-]?)?\b[6-9]\d{9}\b|\b[6-9]\d{4}[\s-]?\d{5}\b|\b\d{3}[\s-]\d{3}[\s-]\d{4}\b/;
const URL_LIKE_CONTACT = /\b(?:wa\.me|whatsapp|t\.me|telegram)\b/i;

export function containsContact(text: string): boolean {
  return EMAIL.test(text) || PHONE.test(text) || URL_LIKE_CONTACT.test(text);
}

export type PostInput = {
  title?: string;
  body: string;
  category?: string;
};

export type PostValidation = { ok: true } | { ok: false; error: string };

export function validatePost(input: PostInput): PostValidation {
  const body = input.body.trim();
  if (body.length < 10) return { ok: false, error: "Write at least 10 characters." };
  if (body.length > POST_MAX_CHARS) return { ok: false, error: `Keep posts under ${POST_MAX_CHARS} characters.` };
  if (input.title !== undefined) {
    const title = input.title.trim();
    if (title.length < 5) return { ok: false, error: "Give the thread a title of at least 5 characters." };
    if (title.length > TITLE_MAX_CHARS) return { ok: false, error: `Keep titles under ${TITLE_MAX_CHARS} characters.` };
  }
  if (input.category !== undefined && !COMMUNITY_CATEGORIES.includes(input.category as CommunityCategory)) {
    return { ok: false, error: "Choose a category." };
  }
  if (containsContact(body) || (input.title && containsContact(input.title))) {
    return { ok: false, error: "Please remove phone numbers, email addresses or messaging links. Contact details are not allowed in public posts." };
  }
  return { ok: true };
}

export type AccountAge = { createdAt: string; approvedPosts: number };

/**
 * New accounts and accounts with nothing approved yet go to the queue first. This is the
 * pre-moderation rule; it never publishes anything automatically.
 */
export function needsPreModeration(account: AccountAge, now = new Date()): boolean {
  const ageDays = (now.getTime() - new Date(account.createdAt).getTime()) / (24 * 60 * 60 * 1000);
  return ageDays < NEW_ACCOUNT_DAYS || account.approvedPosts === 0;
}

export function initialStatus(account: AccountAge, now = new Date()): PostStatus {
  return needsPreModeration(account, now) ? "pending" : "published";
}

/** Three distinct reporters hide a post until a person looks at it. */
export function shouldAutoHide(distinctReporters: number): boolean {
  return distinctReporters >= AUTO_HIDE_REPORTS;
}

export function postsToday(createdAtIso: string[], now = new Date()): number {
  const cutoff = now.getTime() - 24 * 60 * 60 * 1000;
  return createdAtIso.filter((d) => new Date(d).getTime() > cutoff).length;
}

export function canPostToday(createdAtIso: string[], now = new Date()): boolean {
  return postsToday(createdAtIso, now) < POSTS_PER_DAY_LIMIT;
}

export function statusTone(status: PostStatus): string {
  if (status === "published") return "bg-secondary text-success";
  if (status === "removed") return "bg-destructive/10 text-destructive";
  if (status === "hidden") return "bg-warning-soft text-warning";
  return "bg-muted text-muted-foreground";
}
