-- Stand-ins for the Supabase pieces the migrations depend on.
--
-- This file exists so the migrations can be run against a plain PostgreSQL
-- server. It is NOT a Supabase emulator and must never be pointed at a real
-- project. Nothing here is a substitute for Supabase's own auth: it reproduces
-- only the shapes the migrations reference -- the auth schema, the users table,
-- the three roles, the storage bucket table, and the extensions that the
-- hosted platform provides.
--
-- The pieces that matter for the tests:
--   * auth.uid() reads a session setting instead of a JWT, so a test can say
--     "act as this user" and then ask what that user can see.
--   * `anon`, `authenticated` and `service_role` are real roles with no login,
--     so GRANT and REVOKE behave exactly as they do on Supabase.
--   * By default the migration runner connects as a superuser, which BYPASSES
--     row-level security. Tests that check RLS must switch to one of the three
--     roles, or they will prove nothing. `run-tests.sh` does this.

-- ------------------------------------------------------------------ roles
-- Supabase ships these three. They have no login password because clients
-- assume them; locally we use SET ROLE, which is why NOLOGIN is correct.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    CREATE ROLE service_role NOLOGIN BYPASSRLS;
  END IF;
END $$;

-- The migrations grant to these roles, so the runner must be able to switch
-- into them. In a real project the roles are owned by the platform.
GRANT anon TO CURRENT_USER;
GRANT authenticated TO CURRENT_USER;
GRANT service_role TO CURRENT_USER;

-- ---------------------------------------------------------------- auth schema
CREATE SCHEMA IF NOT EXISTS auth;

-- Only the columns the migrations touch. A real auth.users is much wider, but
-- nothing in this repository reads the rest.
CREATE TABLE IF NOT EXISTS auth.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------- auth.uid()
-- On Supabase this decodes the JWT. Here it reads a GUC, so a test can become a
-- given user with `SET LOCAL app.current_user_id = '<uuid>'` and then observe
-- what row-level security does. Reading a missing setting returns NULL, which
-- is the same thing an anonymous request sees, and the policies treat a NULL
-- caller as "no access".
CREATE OR REPLACE FUNCTION auth.uid()
RETURNS uuid
LANGUAGE sql STABLE
AS $$
  SELECT NULLIF(current_setting('app.current_user_id', true), '')::uuid
$$;

-- A stand-in for the helper Supabase uses to resolve the caller's role from the
-- JWT. The migrations call has_role() with an explicit id, so this is only here
-- so that anything referencing auth.role() does not fail.
CREATE OR REPLACE FUNCTION auth.role()
RETURNS text
LANGUAGE sql STABLE
AS $$
  SELECT COALESCE(current_setting('app.current_role', true), current_user::text)
$$;

-- ---------------------------------------------------------------- storage
-- Migration 0000 and 0007 create policies on storage.objects. Only the columns
-- those policies name are needed: bucket_id, name and owner.
CREATE SCHEMA IF NOT EXISTS storage;
CREATE TABLE IF NOT EXISTS storage.objects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket_id text NOT NULL,
  name text NOT NULL,
  owner uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON storage.objects TO authenticated;
GRANT SELECT ON storage.objects TO anon;
GRANT ALL ON storage.objects TO service_role;

-- ---------------------------------------------------------------- extensions
-- Provided by the hosted platform. The stub control files next to this script
-- make CREATE EXTENSION succeed; they install no functions, because the
-- migrations only create the extension and never call into it.
--
-- Supabase keeps extensions in their own schema and points at it with
-- `extensions.gen_random_bytes(...)` etc. Migration 0004 uses
-- `encode(extensions.gen_random_bytes(32), 'hex')`, so the schema must exist
-- before the extension is created.
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;
-- pgcrypto provides gen_random_bytes, which migration 0004 calls. On Supabase it
-- lives in the extensions schema; here it is installed into the default schema
-- and then made reachable as extensions.gen_random_bytes by the search_path
-- below, so the migration's fully-qualified call resolves.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $stub$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE p.proname = 'gen_random_bytes' AND n.nspname = 'extensions'
  ) THEN
    CREATE OR REPLACE FUNCTION extensions.gen_random_bytes(int)
    RETURNS bytea LANGUAGE sql VOLATILE AS $fn$ SELECT gen_random_bytes($1) $fn$;
  END IF;
END $stub$;

-- ---------------------------------------------------------------- grants
-- Supabase grants usage on these schemas to the client roles.
GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT USAGE ON SCHEMA storage TO anon, authenticated, service_role;
