# EduFusionBD — Database Tier (`supabase/`)

This folder is the **database layer** of the project, kept separate from the
application code in `../src`. The schema, security, business logic (PL/pgSQL
functions) and seed data all live here as versioned migrations.

- **Hosted project:** `EduFusionBD` (`dkumhtrrgsuwxucgncix`, region `ap-south-1`, Postgres 17)
- **Migrations:** applied via the Supabase migration history (see the table below).

## Three-tier separation

| Tier | Where it lives | Contents |
|------|----------------|----------|
| **Presentation (frontend)** | `../src/app`, `../src/features/**/*.tsx`, `../src/shared/ui` | React Client/Server Components, design-system UI |
| **Application (backend)** | `../src/features/**/logic/{api,hooks}.ts`, `../src/shared/services`, **+ the PL/pgSQL `fn_*` RPCs in this folder** | Data-access layer + server-side business logic |
| **Data (database)** | `supabase/migrations/*.sql` | Tables, RLS policies, triggers, functions, seed data |

> In Next.js the frontend (Client Components) and backend (Server Components,
> Route Handlers, and the Supabase RPCs) are intentionally co-located in one
> project — that is the framework's design. Separation is enforced **by layer**
> (UI files never issue SQL; all DB access goes through `logic/api.ts` →
> Supabase → RPCs), not by splitting into separate deployable repos.

## Materialize the migration `.sql` files

The full migration history lives in the hosted project. To pull every migration
into `supabase/migrations/` as versioned SQL files (one command):

```bash
# 1. Install the CLI (once):    npm i -g supabase   (or: npx supabase ...)
# 2. Log in:                    supabase login
# 3. Link this folder:          supabase link --project-ref dkumhtrrgsuwxucgncix
# 4. Pull all migrations:       supabase db pull
```

`gen:types` in `../package.json` regenerates `../src/shared/types/database.types.ts`
from the live schema.

## Migration history (22 migrations)

| # | Version | Migration | Purpose |
|---|---------|-----------|---------|
| 01 | 20260711034146 | foundations | schemas, extensions, roles |
| 02 | 20260711034405 | core_tables | 84 tables across 8 domains |
| 03 | 20260711034420 | deferred_fks | circular FK resolution |
| 04 | 20260711034459 | indexes_constraints | indexes, unique/check constraints |
| 05 | 20260711034734 | functions_triggers | code-gen, recompute, audit triggers |
| 06 | 20260711034924 | rls_policies | Row-Level Security policies |
| 07 | 20260711035205 | security_hardening | search_path, grants lockdown |
| 08 | 20260711035222 | fk_indexes_policy_cleanup | FK index + policy cleanup |
| 09 | 20260711035421 | views | `v_dashboard_kpi` + reporting views |
| 10 | 20260711035526 | seed_global | plans, permissions, enum labels |
| 11 | 20260711035828 | seed_demo_tenant | demo institution + users/data |
| 12 | 20260711041303 | bangladesh_geo_hierarchy | 8 divisions / 64 districts / 494 upazilas |
| 13 | 20260711052456 | fn_register_student | atomic student registration RPC |
| 14 | 20260711084804 | teacher_crud_and_code_seq | `fn_register_teacher`/`fn_update_teacher` + code-seq seed + fixed `fn_register_student` enum casts |
| 15 | 20260711085614 | lock_teacher_rpc_to_authenticated | revoke teacher RPCs from anon |
| 16 | 20260711090528 | student_module_rpcs | basic-update, `fn_run_migration`, `fn_pushback_migration`, `fn_student_report_summary` |
| 17 | 20260711090701 | fix_pushback_status | valid enrollment status on pushback |
| 18 | 20260711090744 | fix_pushback_batch_status | valid migration_batch status |
| 19 | 20260711091923 | fee_module_rpcs | `fn_collect_fee`, delete, mapping CRUD, `fn_unpaid_by_institute`, `fn_fee_income_statement` |
| 20 | 20260711092039 | fix_collect_fee_no_double_ledger | let trigger own the ledger write |
| 21 | 20260711093354 | attendance_rpcs | `fn_mark_attendance`, `fn_attendance_summary` |
| 22 | 20260711093456 | fix_mark_attendance_generated_key | match generated `exam_key` via `exam_id` |

## RPC catalog (server-side business logic)

All are `SECURITY DEFINER`, `search_path=''`, institution-guarded via
`private.current_institution_id()`, executable only by `authenticated`/`service_role`:

`fn_register_student` · `fn_register_teacher` · `fn_update_teacher` ·
`fn_update_student_basic` · `fn_run_migration` · `fn_pushback_migration` ·
`fn_student_report_summary` · `fn_collect_fee` · `fn_delete_fee_invoice` ·
`fn_upsert_fee_mapping` · `fn_delete_fee_mapping` · `fn_unpaid_by_institute` ·
`fn_fee_income_statement` · `fn_mark_attendance` · `fn_attendance_summary` ·
`fn_generate_code`
