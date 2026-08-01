import { LoginScreen } from "@/features/auth/components/LoginScreen";

/**
 * `/login` — the canonical sign-in route. Everything that redirects an
 * unauthenticated user points here (middleware, IdleTimeout, AdminShell's sign
 * out, the parent app), so it stays a real route rather than a redirect to `/`.
 * `/` renders the same screen; see `app/page.tsx`.
 */
export default function LoginPage() {
  return <LoginScreen />;
}
