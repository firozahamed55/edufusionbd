-- ============================================================================
-- Phase 1.4 — the two index gaps that show up on the hottest screens.
-- Closes A-M9 and A-M10.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- A-M9 — `v_dashboard_kpi.collected_this_month` is
--     select coalesce(sum(amount),0) from fee_payment
--      where institution_id = i.id and paid_at >= date_trunc('month', now())
-- and `fee_payment` had only `(institution_id)`. Postgres therefore scanned
-- every payment the school has ever taken and filtered by date in memory — on
-- the first screen every admin loads, growing forever.
--
-- INCLUDE (amount) makes it index-only: the sum never touches the heap.
-- ---------------------------------------------------------------------------
create index if not exists ix_fee_payment_inst_paid
  on public.fee_payment (institution_id, paid_at) include (amount);

-- ---------------------------------------------------------------------------
-- A-M10 — soft delete is pervasive and was unindexed.
--
-- The partial UNIQUE indexes correctly carry `where deleted_at is null`, but no
-- LOOKUP index did, so every `.is("deleted_at", null)` list query read deleted
-- rows and discarded them. Partial indexes are also smaller, which matters more
-- than the filter itself on the tables that grow.
--
-- `student`/`teacher` lead with institution_id because that is what RLS
-- compares first; `fee_invoice` keeps its (institution_id, student_id) shape
-- because every fee screen filters by student.
-- ---------------------------------------------------------------------------
create index if not exists ix_student_live
  on public.student (institution_id, name_en) where deleted_at is null;

create index if not exists ix_teacher_live
  on public.teacher (institution_id, employee_code) where deleted_at is null;

create index if not exists ix_fee_invoice_live
  on public.fee_invoice (institution_id, student_id, due_date) where deleted_at is null;

create index if not exists ix_guardian_live
  on public.guardian (institution_id, name) where deleted_at is null;

-- ---------------------------------------------------------------------------
-- Not added, deliberately: `attendance` and `mark` have no `deleted_at`
-- column, and `student_enrollment` got `ix_student_enrollment_student_active`
-- in the Phase 0.3 migration. Adding an index "for symmetry" costs write
-- throughput on the two tables that will be the largest in the system.
-- ---------------------------------------------------------------------------
