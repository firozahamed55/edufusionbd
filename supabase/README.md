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

## Migration files are IN THIS REPO (as of 2026-07-26)

All **46** migrations are materialized under `migrations/`, byte-identical to the
hosted project's `supabase_migrations.schema_migrations` history (verified by
md5 per migration). The schema is therefore reproducible from source alone: a
fresh project can be rebuilt with `supabase db push`, and the DR gap of
"schema exists only in the hosted project" is closed.

**Every future schema change must land here as a migration file and go through
PR review — do not apply DDL to the hosted project by hand.**

```bash
# Re-sync after someone applies a change out-of-band:
supabase link --project-ref dkumhtrrgsuwxucgncix   # once, needs `supabase login`
npm run db:pull                                    # supabase db pull
npm run db:diff                                    # confirm repo == remote (empty diff)
```

`gen:types` in `../package.json` regenerates `../src/shared/types/database.types.ts`
from the live schema.

## Migration history (34 migrations)

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
| 23 | 20260711181028 | exam_module_rpcs | `fn_upsert_exam`, `fn_save_marks`, `fn_save_exam_config` |
| 24 | 20260711181940 | certificate_and_setting_rpcs | template/batch/testimonial/transfer RPCs + `fn_save_setting` |
| 25 | 20260711182633 | sms_notice_rpcs | campaign send, template CRUD, package purchase, notice CRUD |
| 26 | 20260711183330 | core_settings_rpcs | institution/class/subject/group/grading/signature CRUD |
| 27 | 20260724045934 | add_subject_class_range_and_status | `subject.min/max_class_level` + `status`; `fn_upsert_subject` |
| 28 | 20260724050009 | create_institution_assets_bucket | private storage bucket + 4 per-tenant storage policies |
| 29 | 20260724050615 | add_fn_record_file_upload | register an uploaded object in `file_object` |
| 30 | 20260724052041 | extend_fn_update_institution | more institution fields + metadata merge |
| 31 | 20260724052216 | make_fn_update_institution_partial_safe | only overwrite keys present in the payload |
| 32 | 20260724052546 | add_class_section_upsert_delete_rpcs | `fn_upsert_class_section` / `fn_delete_class_section` |
| 33 | 20260724054154 | extend_fn_upsert_signature_image | signature image file id |
| 34 | 20260725045652 | lock_class_section_and_upload_rpcs_to_authenticated | **security fix** — revoke anon EXECUTE on 3 `SECURITY DEFINER` RPCs |
| 35 | 20260725101640 | add_fn_digital_transaction_stats | digital-collection KPI aggregate |
| 36 | 20260726043308 | add_has_permission_and_seed_role_permissions | **Phase 0.2** — `private.has_permission/has_full_class_scope/is_guardian_of`; seed teacher/accountant/exam_controller permissions |
| 37 | 20260726043413 | role_based_rls_policies | **Phase 0.2 (A-C1)** — verb-split `<t>_read` / `<t>_write` policies on every table |
| 38 | 20260726043451 | teacher_class_section_scoping | **Phase 0.3** — wire `can_access_class_section` on attendance/mark/enrollment |
| 39 | 20260726043508 | parent_read_scoping | **Phase 0.4** — parent read-only access via `student_guardian` linkage |
| 40 | 20260726043523 | audit_log_append_only_and_coverage | **Phase 0.5 (A-H6)** — audit log append-only; coverage 6 → 22 tables |
| 41 | 20260726044457 | rpc_permission_guards | **Phase 0.2 (A-C1)** — all 48 `fn_*` moved to `private`, permission-checked wrappers in `public` |
| 42 | 20260726050447 | hot_path_indexes | **Phase 1.4 (A-M9/M10)** — `ix_fee_payment_inst_paid` INCLUDE(amount); `deleted_at` partial indexes on student/teacher/fee_invoice/guardian |
| 43 | 20260726051212 | add_fn_sms_campaign_totals | **Phase 1.1** — institution-wide SMS totals RPC, replaces summing the fetched page |
| 44 | 20260726052914 | scope_unpaid_by_institute_to_current_year | **Phase 1.3 (A-M16)** — `fn_unpaid_by_institute` now filters `class_section` by the current year |
| 45 | 20260726053505 | partition_attendance_and_mark_by_academic_year | **Phase 1.2 (A-H5)** — `attendance`/`mark` LIST-partitioned by `academic_year_id`, RLS/triggers/views recreated on the new tables |
| 46 | 20260726053715 | set_partition_key_at_write_paths | Corrects migration 45's first attempt (BEFORE trigger cannot set a partition key) — folded into 45 on disk; kept as a version marker |

## RPC catalog (server-side business logic)

Since migration 41 each RPC is a **pair**: `private.fn_x` holds the body, and
`public.fn_x` is a thin `SECURITY DEFINER` wrapper that calls
`private.require_permission('<code>')` before forwarding. Only the wrapper is
granted to `authenticated`; `private` is not in PostgREST's exposed schemas and
EXECUTE on the implementations is revoked. All are `search_path=''` and
institution-guarded via `private.current_institution_id()`:

`fn_register_student` · `fn_register_teacher` · `fn_update_teacher` ·
`fn_update_student_basic` · `fn_run_migration` · `fn_pushback_migration` ·
`fn_student_report_summary` · `fn_collect_fee` · `fn_delete_fee_invoice` ·
`fn_upsert_fee_mapping` · `fn_delete_fee_mapping` · `fn_unpaid_by_institute` ·
`fn_fee_income_statement` · `fn_mark_attendance` · `fn_attendance_summary` ·
`fn_generate_code`
