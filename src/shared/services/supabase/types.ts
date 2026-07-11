import type { createClient } from "./client";

/**
 * Exact browser Supabase client type. Deriving it from createClient() avoids the
 * generic-arity mismatch between the installed @supabase/supabase-js and the
 * CLI-generated Database types. Import this in feature `logic/api.ts` files.
 */
export type BrowserClient = ReturnType<typeof createClient>;
