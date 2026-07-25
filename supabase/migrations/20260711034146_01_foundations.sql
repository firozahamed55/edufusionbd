-- ============================================================
-- EduFusionBD v2.0 — Migration 01: Foundations
-- Extensions, private schema, stable ENUM types, shared trigger fn
-- ============================================================

create extension if not exists pgcrypto;   -- gen_random_uuid()
create extension if not exists pg_trgm;     -- trigram search on names

-- Private schema: SECURITY DEFINER helpers (never exposed to API)
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- Stable, closed-set ENUM types (R2: only truly-stable sets become native enums)
create type gender as enum ('male','female','other');
create type blood_group as enum ('a_pos','a_neg','b_pos','b_neg','ab_pos','ab_neg','o_pos','o_neg');
create type religion as enum ('islam','hindu','christian','buddhist','other');
create type attendance_context as enum ('daily','exam');
create type attendance_status as enum ('present','absent','late','leave','exam_absent');
create type employment_type as enum ('permanent','part_time');
create type ledger_direction as enum ('debit','credit');
create type app_language as enum ('bn','en');

-- Shared updated_at trigger function
create or replace function private.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
