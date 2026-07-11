import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/shared/types/database.types";

/** Browser Supabase client (client components / hooks). */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
