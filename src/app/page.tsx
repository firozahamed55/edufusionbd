import { redirect } from "next/navigation";
import { createClient } from "@/shared/services/supabase/server";
import { LoginScreen } from "@/features/auth/components/LoginScreen";
import { roleHome } from "@/features/auth/components/roles";

/**
 * App entry point. Signed-in users are sent straight to their role's dashboard
 * (persistent login); everyone else gets the sign-in form. No unconditional
 * jump to /admin — a dashboard is only reachable after a real Supabase sign-in.
 *
 * A-3: this used to render a role interstitial, whose answer the login screen
 * then ignored. The form is rendered here rather than redirected to `/login`,
 * so the most common entry into the product does not cost an extra round trip
 * on a slow connection.
 */
export default async function Home() {
  // No Supabase env (local preview): can't auth, so just show the form.
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return <LoginScreen />;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    // app_metadata only — user_metadata is client-writable (see middleware.ts).
    const role = user.app_metadata?.role as string | undefined;
    redirect(roleHome(role));
  }

  return <LoginScreen />;
}
