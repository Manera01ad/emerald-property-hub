-- Phase 1 W4-1. Community threads and posts, moderated.
--
-- This file is NOT applied automatically. The repository owner runs it.
--
-- Rules enforced here, not only in the browser:
--   * Anyone may read published threads and posts. Nothing else is readable.
--   * Only a signed-in user may write, and only as themselves.
--   * A new account (under 7 days) or an account with no published post yet goes to the
--     queue: pre-moderation, never auto-publish.
--   * Contact details (phone, email, messaging links) are rejected outright, so no
--     personal number or address ends up in a public post.
--   * Ten posts a day per account.
--   * Three distinct reporters hide a post pending review.
--   * A user may delete their own post. Deletion is recorded in the moderation log.
--   * Every moderation action is logged with an actor and a reason.

CREATE TABLE public.community_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category text NOT NULL CHECK (category IN ('localities','buying','documents','construction','general')),
  locality_slug text REFERENCES public.localities(slug) ON DELETE SET NULL,
  title text NOT NULL CHECK (char_length(title) BETWEEN 5 AND 120),
  body text NOT NULL CHECK (char_length(body) BETWEEN 10 AND 2000),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','published','hidden','removed')),
  moderation_reason text CHECK (moderation_reason IS NULL OR char_length(moderation_reason) <= 1000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX community_threads_feed_idx ON public.community_threads (status, created_at DESC);
CREATE INDEX community_threads_author_idx ON public.community_threads (author_id, created_at DESC);

CREATE TABLE public.community_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES public.community_threads(id) ON DELETE CASCADE,
  parent_id uuid REFERENCES public.community_posts(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL CHECK (char_length(body) BETWEEN 10 AND 2000),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','published','hidden','removed')),
  moderation_reason text CHECK (moderation_reason IS NULL OR char_length(moderation_reason) <= 1000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX community_posts_thread_idx ON public.community_posts (thread_id, created_at);
CREATE INDEX community_posts_author_idx ON public.community_posts (author_id, created_at DESC);

CREATE TABLE public.community_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  thread_id uuid REFERENCES public.community_threads(id) ON DELETE CASCADE,
  post_id uuid REFERENCES public.community_posts(id) ON DELETE CASCADE,
  reason text NOT NULL CHECK (char_length(reason) BETWEEN 3 AND 500),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT report_targets_one_thing CHECK ((thread_id IS NULL) <> (post_id IS NULL)),
  UNIQUE (reporter_id, thread_id, post_id)
);
CREATE INDEX community_reports_post_idx ON public.community_reports (post_id);
CREATE INDEX community_reports_thread_idx ON public.community_reports (thread_id);

CREATE TABLE public.community_moderation_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_type text NOT NULL CHECK (target_type IN ('thread','post','report')),
  target_id uuid NOT NULL,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL CHECK (char_length(action) BETWEEN 2 AND 40),
  reason text CHECK (reason IS NULL OR char_length(reason) <= 1000),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX community_moderation_log_target_idx ON public.community_moderation_log (target_type, target_id, created_at DESC);

GRANT SELECT ON public.community_threads TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.community_threads TO authenticated;
GRANT SELECT ON public.community_posts TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.community_posts TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.community_reports TO authenticated;
GRANT SELECT ON public.community_moderation_log TO authenticated;
GRANT ALL ON public.community_threads, public.community_posts, public.community_reports, public.community_moderation_log TO service_role;

ALTER TABLE public.community_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_moderation_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public read published threads" ON public.community_threads FOR SELECT TO anon, authenticated USING (status = 'published');
CREATE POLICY "authors read own threads" ON public.community_threads FOR SELECT TO authenticated USING (auth.uid() = author_id);
CREATE POLICY "signed in start threads" ON public.community_threads FOR INSERT TO authenticated WITH CHECK (auth.uid() = author_id);
CREATE POLICY "authors delete own threads" ON public.community_threads FOR DELETE TO authenticated USING (auth.uid() = author_id);
CREATE POLICY "admins manage threads" ON public.community_threads FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "public read published posts" ON public.community_posts FOR SELECT TO anon, authenticated USING (status = 'published');
CREATE POLICY "authors read own posts" ON public.community_posts FOR SELECT TO authenticated USING (auth.uid() = author_id);
CREATE POLICY "signed in reply" ON public.community_posts FOR INSERT TO authenticated WITH CHECK (auth.uid() = author_id);
CREATE POLICY "authors delete own posts" ON public.community_posts FOR DELETE TO authenticated USING (auth.uid() = author_id);
CREATE POLICY "admins manage posts" ON public.community_posts FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "signed in report" ON public.community_reports FOR INSERT TO authenticated WITH CHECK (auth.uid() = reporter_id);
CREATE POLICY "reporters read own reports" ON public.community_reports FOR SELECT TO authenticated USING (auth.uid() = reporter_id);
CREATE POLICY "admins read reports" ON public.community_reports FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admins read moderation log" ON public.community_moderation_log FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER community_threads_touch BEFORE UPDATE ON public.community_threads FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER community_posts_touch BEFORE UPDATE ON public.community_posts FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Contact details are refused at the database, so they cannot be written by any client.
CREATE OR REPLACE FUNCTION public.community_text_is_clean(_text text)
RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT _text !~* '[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}'
     AND _text !~ '(\+?91[\s-]?)?\b[6-9][0-9]{9}\b'
     AND _text !~ '\b[6-9][0-9]{4}[\s-]?[0-9]{5}\b'
     AND _text !~* '\b(wa\.me|whatsapp|t\.me|telegram)\b'
$$;

CREATE OR REPLACE FUNCTION public.check_community_text()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT public.community_text_is_clean(NEW.body) THEN
    RAISE EXCEPTION 'Remove phone numbers, email addresses or messaging links before posting.';
  END IF;
  IF TG_TABLE_NAME = 'community_threads' AND NOT public.community_text_is_clean(NEW.title) THEN
    RAISE EXCEPTION 'Remove phone numbers, email addresses or messaging links from the title.';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER community_threads_clean BEFORE INSERT OR UPDATE ON public.community_threads
  FOR EACH ROW EXECUTE FUNCTION public.check_community_text();
CREATE TRIGGER community_posts_clean BEFORE INSERT OR UPDATE ON public.community_posts
  FOR EACH ROW EXECUTE FUNCTION public.check_community_text();

-- Pre-moderation: an account under 7 days old, or with nothing published yet, waits in the queue.
CREATE OR REPLACE FUNCTION public.community_initial_status(_author uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN (SELECT count(*) FROM public.community_posts WHERE author_id = _author AND status = 'published') = 0
      OR (SELECT created_at FROM auth.users WHERE id = _author) > now() - interval '7 days'
    THEN 'pending' ELSE 'published'
  END
$$;

-- Authors may not choose their own status; it is decided here on insert.
CREATE OR REPLACE FUNCTION public.community_set_initial_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    NEW.status := public.community_initial_status(NEW.author_id);
    NEW.moderation_reason := NULL;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER community_threads_initial BEFORE INSERT ON public.community_threads
  FOR EACH ROW EXECUTE FUNCTION public.community_set_initial_status();
CREATE TRIGGER community_posts_initial BEFORE INSERT ON public.community_posts
  FOR EACH ROW EXECUTE FUNCTION public.community_set_initial_status();

-- Ten posts a day per account, threads and replies counted together.
CREATE OR REPLACE FUNCTION public.check_community_rate_limit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE recent int;
BEGIN
  IF public.has_role(auth.uid(), 'admin') THEN RETURN NEW; END IF;
  SELECT (SELECT count(*) FROM public.community_posts WHERE author_id = NEW.author_id AND created_at > now() - interval '24 hours')
       + (SELECT count(*) FROM public.community_threads WHERE author_id = NEW.author_id AND created_at > now() - interval '24 hours')
    INTO recent;
  IF recent >= 10 THEN
    RAISE EXCEPTION 'Ten posts a day is the limit. Please try again tomorrow.';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER community_threads_rate BEFORE INSERT ON public.community_threads
  FOR EACH ROW EXECUTE FUNCTION public.check_community_rate_limit();
CREATE TRIGGER community_posts_rate BEFORE INSERT ON public.community_posts
  FOR EACH ROW EXECUTE FUNCTION public.check_community_rate_limit();

-- Three distinct reporters hide the target until a person reviews it.
CREATE OR REPLACE FUNCTION public.community_apply_report()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE reports int;
BEGIN
  IF NEW.post_id IS NOT NULL THEN
    SELECT count(DISTINCT reporter_id) INTO reports FROM public.community_reports WHERE post_id = NEW.post_id;
    IF reports >= 3 THEN
      UPDATE public.community_posts
        SET status = 'hidden', moderation_reason = 'Hidden automatically after three reports. Waiting for review.'
        WHERE id = NEW.post_id AND status = 'published';
    END IF;
  ELSE
    SELECT count(DISTINCT reporter_id) INTO reports FROM public.community_reports WHERE thread_id = NEW.thread_id;
    IF reports >= 3 THEN
      UPDATE public.community_threads
        SET status = 'hidden', moderation_reason = 'Hidden automatically after three reports. Waiting for review.'
        WHERE id = NEW.thread_id AND status = 'published';
    END IF;
  END IF;
  INSERT INTO public.community_moderation_log (target_type, target_id, actor_id, action, reason)
    VALUES (CASE WHEN NEW.post_id IS NOT NULL THEN 'post' ELSE 'thread' END,
            coalesce(NEW.post_id, NEW.thread_id), NEW.reporter_id, 'report', NEW.reason);
  RETURN NEW;
END $$;
CREATE TRIGGER community_reports_apply AFTER INSERT ON public.community_reports
  FOR EACH ROW EXECUTE FUNCTION public.community_apply_report();

-- Every status change made by a person is logged with a reason.
CREATE OR REPLACE FUNCTION public.community_log_status_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status <> OLD.status THEN
    IF NEW.status <> 'hidden' OR NEW.moderation_reason IS DISTINCT FROM 'Hidden automatically after three reports. Waiting for review.' THEN
      INSERT INTO public.community_moderation_log (target_type, target_id, actor_id, action, reason)
        VALUES (CASE WHEN TG_TABLE_NAME = 'community_threads' THEN 'thread' ELSE 'post' END,
                NEW.id, auth.uid(), 'status:' || NEW.status, NEW.moderation_reason);
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER community_threads_log AFTER UPDATE ON public.community_threads
  FOR EACH ROW EXECUTE FUNCTION public.community_log_status_change();
CREATE TRIGGER community_posts_log AFTER UPDATE ON public.community_posts
  FOR EACH ROW EXECUTE FUNCTION public.community_log_status_change();

-- Deleting your own post is allowed, and it is recorded.
CREATE OR REPLACE FUNCTION public.community_log_delete()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.community_moderation_log (target_type, target_id, actor_id, action, reason)
    VALUES (CASE WHEN TG_TABLE_NAME = 'community_threads' THEN 'thread' ELSE 'post' END,
            OLD.id, auth.uid(), 'deleted', 'Deleted by the author or an admin.');
  RETURN OLD;
END $$;
CREATE TRIGGER community_threads_delete_log AFTER DELETE ON public.community_threads
  FOR EACH ROW EXECUTE FUNCTION public.community_log_delete();
CREATE TRIGGER community_posts_delete_log AFTER DELETE ON public.community_posts
  FOR EACH ROW EXECUTE FUNCTION public.community_log_delete();
