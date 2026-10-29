-- 0014: video-first property experience, additive only.
--
-- WHY: the site has no way to attach a property video. The design calls for
-- authorised YouTube embeds only, as an explicit admin action, never scraped.
--
-- SAFETY: one nullable-with-default column. Nothing is renamed or dropped. The
-- public-visibility rule is untouched, so a draft listing cannot expose a video.
--
-- The owner applies this. Agents do not run migrations.

ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS video_urls text[] NOT NULL DEFAULT '{}';

-- A video link is stored as pasted and validated in the app by src/lib/video.ts,
-- which accepts only YouTube watch/short/embed links or a bare 11-character id
-- and renders them through youtube-nocookie.com. No database constraint is added
-- for the URL shape, because the app already drops anything it cannot parse and a
-- constraint here would block an admin from saving while they fix a typo.
