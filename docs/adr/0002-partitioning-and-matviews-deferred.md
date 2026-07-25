# ADR-0002 — Table partitioning and materialized dashboard views: deferred, with triggers

**Status:** Accepted · **Date:** 2026-07-25 · **Refines:** ENGINEERING_AUDIT §4 (100k tier), §7 Phase 4.

## Context

The audit's 100k-tier plan calls for partitioning `attendance` / `sms_campaign` / `audit_log` by institution+period and adding materialized views for dashboard aggregates. Both were listed without a measurement. Here is the measurement.

### Actual table sizes (project `dkumhtrrgsuwxucgncix`, 2026-07-25)

| Table | Est. rows | Total size |
|---|---|---|
| `audit_log` | 38 | 144 kB |
| `attendance` | 12 | 136 kB |
| `student` | 12 | 184 kB |
| `fee_invoice` | 6 | 128 kB |
| `digital_transaction` | 0 | 40 kB |
| `sms_campaign` | 0 | 40 kB |

### Dashboard view cost — `explain (analyze, buffers) select * from v_dashboard_kpi`

```
Seq Scan on institution i  (rows=1)              actual time=11.776..11.784
  SubPlan 1  Index Scan  ix_student_institution
  SubPlan 2  Index Scan  ix_teacher_institution
  SubPlan 3  Index Only Scan  uq_class_section
  SubPlan 4  Index Scan  ix_fee_invoice_status
  SubPlan 5  Bitmap Index Scan  ix_fee_payment_institution
Planning Time: 57.704 ms
Execution Time: 12.180 ms
```

Every subplan is an **index** scan on `institution_id`. The single `Seq Scan` is on `institution`, which has one row. Buffers are 100% `shared hit`.

## Decision

**Do neither now.** Both are recorded with numeric triggers instead.

### Why not partition

Partitioning is a one-way table rewrite, and the partition key can only be chosen correctly once the real access pattern is known. Right now `attendance` holds 12 rows across one institution, so any key chosen today would be a guess about which of `institution_id`, `date`, or `class_section_id` dominates the eventual `WHERE`. Guessing wrong is not neutral: a partition key misaligned with the query pattern makes the planner scan every partition, which is *slower* than the unpartitioned table it replaced, and undoing it means another rewrite of the largest table in the schema.

The existing indexes already give partition-like pruning (`ix_*_institution` on every growth table, 0 unindexed FKs per the audit), which is why the plan above touches no sequential scan.

**Trigger:** partition `attendance` when it passes **~50 M rows** or when an index-only scan on it stops fitting in `shared_buffers` — whichever comes first. At ~180 attendance rows per student-year, that is roughly 250k student-years, i.e. well past the 100k-user tier. Re-measure at 10 M rows and revisit the number rather than trusting this one.

### Why not materialize the dashboard

Beyond it costing 12 ms on index scans, there is a correctness reason that the audit item missed: **`v_dashboard_kpi` is a `security_invoker` view, and a materialized view cannot be.** A matview is a physical table populated by whoever refreshed it, so it neither respects the caller's RLS nor evaluates `current_institution_id()` per caller. Swapping the view for a matview would hand every institution's KPI row to every institution — a cross-tenant leak in exchange for 12 ms.

The correct shape, if it is ever needed, is not a matview but a **physical snapshot table** (`institution_kpi_snapshot`, one row per institution, RLS enabled with the same predicate as the view, refreshed by `pg_cron`). That trades live numbers for stale ones, which is a product decision — a headteacher reading "fees collected this month" expects it to include the payment they took two minutes ago.

**Trigger:** build the snapshot table when the view exceeds **200 ms at p95**, or when dashboard reads become a measurable share of DB CPU. Not before — and if it happens, check first whether one missing index explains it.

## Consequences

- **Retained:** a live, RLS-correct dashboard and a schema that can still be reshaped cheaply.
- **Accepted risk:** these become real work later, at a point where there is production traffic to design against — which is the only point at which they can be designed correctly.
- **Related:** audit item L-3 (prune the 169 unused indexes) stays deferred for the same reason and must not be done blind — those indexes are what keeps the plan above index-only.
- **Noted, not acted on:** planning time (57.7 ms) exceeds execution time (12.2 ms) on a cold parse, with 1139 planning buffers. Plan caching absorbs this in steady state. If dashboard latency is ever investigated, measure a warm plan before concluding anything from the numbers above.
