# ADR-0001 — Background-job / queue infrastructure: deferred, with a trigger

**Status:** Accepted · **Date:** 2026-07-25 · **Supersedes:** the unconditional "build queue infra" item in ENGINEERING_AUDIT §4 (100k tier) and §7 Phase 4.

## Context

The audit listed "background-job/queue infra for bulk SMS + result processing" as required for the 100k tier, on the stated grounds that **"bulk SMS and result processing are synchronous today — the key gap."**

That premise does not survive reading the code:

- `fn_send_sms_campaign` (migration 25) **does not send anything.** It inserts one `sms_campaign` row and decrements `sms_account.balance` by `recipient_count`. There is no gateway call, no per-recipient row, and no SMS provider selected for the project. It is a simulation, and it is O(1) — there is no long-running work to move off the request path.
- Result processing is a single set-based RPC, not a per-student loop.

So the thing a queue would decouple us from does not exist yet.

## Decision

**Do not build queue infrastructure now.** Record the design so the eventual provider integration is asynchronous *by construction* rather than retrofitted.

Measured state of the options (2026-07-25, project `dkumhtrrgsuwxucgncix`):

| Extension | Available | Installed |
|---|---|---|
| `pgmq` 1.5.1 | yes | no |
| `pg_cron` 1.6.4 | yes | no |
| `pg_net` 0.20.3 | yes | no |

All three are one `create extension` away. That availability is precisely *why* this is safe to defer: there is no procurement, no new service, and no lead time to absorb later.

## Why building it now would be wrong, not merely early

A queue's schema is determined by the provider's API — batch size, per-message vs per-batch idempotency keys, the delivery-receipt callback shape, and whether the provider dedupes. Bangladeshi gateways differ on every one of those (Robi, Banglalink, and the aggregators each expose a different contract). A queue designed against no provider gets one of them wrong, and a wrong queue is harder to remove than no queue: it has migrations, a cron entry, retry semantics, and a dead-letter table that all have to be unwound.

## The intended design (build this, when the trigger fires)

1. **Outbox, not a job runner.** `fn_send_sms_campaign` keeps its current transaction and additionally inserts one `sms_outbox` row per recipient (`campaign_id`, `msisdn`, `body`, `status`, `attempts`, `provider_message_id`, `institution_id` + RLS). Enqueue and debit stay in the same transaction as the campaign, so a crash cannot bill for messages it never queued.
2. **`pgmq` for the work queue**, fed by a trigger on `sms_outbox` — visibility timeouts and dead-lettering are already implemented there and are the parts most often got wrong by hand.
3. **A Supabase Edge Function as the worker**, invoked by `pg_cron` every minute (`pg_net` for the HTTP hop). Edge Functions have the outbound-request budget for a gateway call; a plpgsql function does not.
4. **Delivery receipts land in a route handler**, keyed on `provider_message_id`, and update `sms_outbox.status`. This is the reason for the outbox: without a per-recipient row there is nowhere to record a per-recipient receipt, so "did this parent get the message" is unanswerable — which is the question schools actually ask.
5. **Bill on `sent`, not on enqueue.** The current `balance - recipient_count` debit is only defensible while nothing is really sent.

## Trigger — build it when ANY of these is true

- An SMS provider contract is signed (**this alone is sufficient** — do not wire a real gateway synchronously into an RPC).
- Any single write path exceeds ~2 s at p95.
- A recipient-level delivery report is requested by a customer.

## Consequences

- **Accepted risk:** the SMS screens keep describing a simulated send. The UI already says so (`SendScreen` carries the notice); §9 of the audit records it.
- **Retained:** zero new infrastructure, zero new failure modes, and no queue to migrate when the real provider's contract turns out to differ from the guess.
