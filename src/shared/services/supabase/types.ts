import type { createClient } from "./client";
import type { Json } from "@/shared/types/database.types";

/**
 * Exact browser Supabase client type. Deriving it from createClient() avoids the
 * generic-arity mismatch between the installed @supabase/supabase-js and the
 * CLI-generated Database types. Import this in feature `logic/api.ts` files.
 */
export type BrowserClient = ReturnType<typeof createClient>;

/**
 * Payload accepted by the `jsonb`-argument RPCs (`fn_upsert_*`, `fn_create_*`,
 * `fn_save_setting`, …).
 *
 * NOT `Record<string, unknown>`: `unknown` is not assignable to `Json`, so a
 * signature typed that way cannot be handed to a typed `supabase.rpc()` call
 * without a cast — which is precisely how the 9 copies of `RpcFn` and their
 * ~30 `as unknown as` escapes came to exist (audit A-M1). Typing the boundary
 * as JSON-shaped instead means the DB's own jsonb contract is what screens are
 * checked against, and no cast is needed anywhere.
 */
export type RpcPayload = { [key: string]: Json | undefined };
