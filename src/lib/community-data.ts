import { supabase } from "@/integrations/supabase/client";
import type { CommunityCategory, PostStatus } from "./community";

/**
 * The community tables are created by migration 0018 and are not in the generated database
 * types yet, and that file is owner-only. This narrow shape reaches them without editing it.
 */
export type Thread = {
  id: string;
  author_id: string;
  category: CommunityCategory;
  locality_slug: string | null;
  title: string;
  body: string;
  status: PostStatus;
  moderation_reason: string | null;
  created_at: string;
};

export type Post = {
  id: string;
  thread_id: string;
  parent_id: string | null;
  author_id: string;
  body: string;
  status: PostStatus;
  moderation_reason: string | null;
  created_at: string;
};

type Result = { data: unknown; error: { message: string } | null };
type Query = PromiseLike<Result> & {
  order: (column: string, opts?: { ascending?: boolean }) => Query;
  eq: (column: string, value: unknown) => Query;
  limit: (n: number) => Query;
};
type Table = {
  select: (columns?: string) => Query;
  insert: (row: Record<string, unknown>) => PromiseLike<Result>;
  delete: () => Query;
};
type Db = { from: (table: "community_threads" | "community_posts" | "community_reports") => Table };

const db = () => supabase as unknown as Db;

function unwrap<T>(result: Result): T[] {
  if (result.error) throw new Error(result.error.message);
  return (result.data ?? []) as T[];
}

/** One thread by id. Null means it is not readable, which is also true of anything unpublished. */
export async function getThread(id: string): Promise<Thread | null> {
  const rows = unwrap<Thread>(await db().from("community_threads").select("*").eq("id", id).limit(1));
  return rows[0] ?? null;
}

/** Published threads, newest first. Row-level security also hides anything not published. */
export async function listThreads(limit = 50): Promise<Thread[]> {
  const { data, error } = await db().from("community_threads").select("*").eq("status", "published").order("created_at", { ascending: false }).limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as Thread[];
}

export async function listPosts(threadId: string): Promise<Post[]> {
  return unwrap<Post>(await db().from("community_posts").select("*").eq("thread_id", threadId).eq("status", "published").order("created_at", { ascending: true }));
}

export async function createThread(row: Record<string, unknown>): Promise<void> {
  const { error } = await db().from("community_threads").insert(row);
  if (error) throw new Error(error.message);
}

export async function createPost(row: Record<string, unknown>): Promise<void> {
  const { error } = await db().from("community_posts").insert(row);
  if (error) throw new Error(error.message);
}

export async function reportPost(postId: string, reason: string): Promise<void> {
  const { error } = await db().from("community_reports").insert({ post_id: postId, reason });
  if (error) throw new Error(error.message);
}

/** Authors may delete their own posts; the database records the deletion. */
export async function deletePost(postId: string): Promise<void> {
  const { error } = await db().from("community_posts").delete().eq("id", postId);
  if (error) throw new Error(error.message);
}

/** Admin queue: everything that is waiting for a person to look at it. */
export async function listQueue(): Promise<{ threads: Thread[]; posts: Post[] }> {
  const [threads, posts] = await Promise.all([
    db().from("community_threads").select("*").eq("status", "pending").order("created_at", { ascending: true }),
    db().from("community_posts").select("*").eq("status", "pending").order("created_at", { ascending: true }),
  ]);
  if (threads.error) throw new Error(threads.error.message);
  if (posts.error) throw new Error(posts.error.message);
  return { threads: (threads.data ?? []) as Thread[], posts: (posts.data ?? []) as Post[] };
}

export async function setThreadStatus(id: string, status: PostStatus, reason: string | null): Promise<void> {
  const t = supabase as unknown as { from: (table: string) => { update: (patch: Record<string, unknown>) => { eq: (c: string, v: unknown) => PromiseLike<{ error: { message: string } | null }> } } };
  const { error } = await t.from("community_threads").update({ status, moderation_reason: reason }).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function setPostStatus(id: string, status: PostStatus, reason: string | null): Promise<void> {
  const t = supabase as unknown as { from: (table: string) => { update: (patch: Record<string, unknown>) => { eq: (c: string, v: unknown) => PromiseLike<{ error: { message: string } | null }> } } };
  const { error } = await t.from("community_posts").update({ status, moderation_reason: reason }).eq("id", id);
  if (error) throw new Error(error.message);
}
