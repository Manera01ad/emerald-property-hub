-- Phase 1 W2-4. The help assistant can now look up published locality evidence,
-- so the search history records a fourth kind.
--
-- This file is NOT applied automatically. The repository owner runs it.
--
-- Nothing else about the log changes: it still holds one row per lookup, readable
-- only by the user who made it, through the existing row-level security policies.

ALTER TABLE public.assistant_search_log DROP CONSTRAINT IF EXISTS assistant_search_log_kind_check;
ALTER TABLE public.assistant_search_log ADD CONSTRAINT assistant_search_log_kind_check
  CHECK (kind IN ('listings', 'listing', 'web', 'locality'));
