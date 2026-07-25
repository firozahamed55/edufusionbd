import { z } from "zod";

/**
 * Shared zod primitives for the RPC trust boundary (audit M-1).
 *
 * WHERE THE BOUNDARY ACTUALLY IS. Every write in this app is a `SECURITY DEFINER`
 * RPC that receives one `jsonb payload` and casts fields out of it
 * (`payload->>'amount'::numeric`). That design is good — it keeps writes
 * transactional and tenant-guarded — but it moves the type check to *runtime, in
 * Postgres*, where a failure is a raw SQLSTATE string rather than a field error.
 * Parsing the payload before it leaves the client turns that into an immediate,
 * localised, field-level rejection.
 *
 * THIS IS NOT THE SECURITY CONTROL. A client-side parse is bypassable by anyone
 * with the anon key and curl. The controls that cannot be bypassed are RLS, the
 * `private.current_institution_id()` guard inside every RPC, and the CHECK
 * constraints — all already in place. zod exists here for correctness and
 * operator experience, and the RPC-side guards are deliberately NOT removed
 * because of it. Never delete a server check because a client check now exists.
 */

/** Any id crossing the wire. Rejects "" and "undefined", the two classic leaks. */
export const uuid = z.string().uuid();

/**
 * Money as the string the form actually holds.
 *
 * Amounts travel as strings (an `<input>` has no numbers) and Postgres casts them
 * with `::numeric`. So `"1,200"` — which is how a Bangladeshi clerk types twelve
 * hundred taka — reaches the DB as `invalid input syntax for type numeric` and
 * the payment silently does not happen. Two decimals max because paisa is the
 * smallest unit, and `> 0` because `fn_collect_fee` raises on non-positive and we
 * would rather say so before the round trip.
 */
export const amountString = z
  .string()
  .regex(/^\d+(\.\d{1,2})?$/, "Amount must be digits, optionally with up to 2 decimals")
  .refine((v) => Number(v) > 0, "Amount must be greater than zero");

/** A bounded free-text field. Length caps keep a paste-bomb out of the DB. */
export const shortText = (max: number) => z.string().trim().max(max);

/**
 * `""` means "not provided" — the same rule the RPCs already apply.
 *
 * Every RPC reads optional fields as `nullif(payload->>'x','')`, so an empty
 * string and an absent key are identical *server-side*. A React form, though,
 * initialises optional selects to `""` and never to `undefined`. Without this
 * bridge, `uuid.optional()` rejects the empty select that the RPC would have
 * happily treated as null — the schema would be stricter than the database in a
 * way that has nothing to do with correctness.
 */
const blankToUndefined = (v: unknown) => (v === "" ? undefined : v);

/** An id that a form may legitimately leave unset. */
export const optionalUuid = z.preprocess(blankToUndefined, uuid.optional());

/** Bounded text that a form may legitimately leave unset. */
export const optionalText = (max: number) =>
  z.preprocess(blankToUndefined, shortText(max).optional());

/** `YYYY-MM-DD`, the only date shape the DB columns accept. */
export const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD");

/**
 * Payment methods, mirroring the `payment_method` lookup seeded in migration 10.
 *
 * Enumerated rather than `z.string()` on purpose: `fn_collect_fee` does
 * `coalesce(nullif(payload->>'method',''),'cash')`, so it defaults an EMPTY
 * method but happily stores an unrecognised one. A typo'd method would therefore
 * persist and quietly break every "collections by method" report. When a real
 * sixth method is added, this list is the intended place to fail loudly.
 */
export const paymentMethod = z.enum(["cash", "bkash", "nagad", "rocket", "card"]);

/** The literal union, so a screen's `useState` can't hold an unsendable method. */
export type PaymentMethod = z.infer<typeof paymentMethod>;
