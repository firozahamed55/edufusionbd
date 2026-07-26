import { redirect } from "next/navigation";
import { createClient } from "@/shared/services/supabase/server";
import { RoleSelect } from "@/features/auth/components/RoleSelect";
import { roleHome } from "@/features/auth/components/roles";

/**
 * App entry point. Signed-in users are sent straight to their role's dashboard
 * (persistent login); everyone else picks a role first. No unconditional jump
 * to /admin — a dashboard is only reachable after a real Supabase sign-in.
 */
export default async function Home() {
  // No Supabase env (local preview): can't auth, so just show role selection.
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return <RoleSelect />;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    // app_metadata only — user_metadata is client-writable (see middleware.ts).
    const role = user.app_metadata?.role as string | undefined;
    redirect(roleHome(role));
  }

  return <RoleSelect />;
}
