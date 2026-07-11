"use client";

import { useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/shared/services/supabase/client";
import { useT } from "@/shared/i18n/useT";
import { Button } from "@/shared/ui";

export default function LoginPage() {
  const { t } = useT();
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setLoading(false);
      setError(t("ইমেইল বা পাসওয়ার্ড ভুল", "Invalid email or password"));
      return;
    }
    // Full navigation so middleware picks up the new session cookie.
    const redirect = params.get("redirect") || "/admin/dashboard";
    router.replace(redirect);
    router.refresh();
  }

  return (
    <main className="grid min-h-screen place-items-center bg-canvas px-4 text-text-primary">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm rounded-lg border border-border-default bg-surface p-8 shadow-e2"
      >
        <div className="mb-6 flex items-center gap-2">
          <div className="h-8 w-8 rounded-md bg-primary" />
          <span className="text-xl font-bold">EduFusionBD</span>
        </div>

        <label className="mb-1.5 block text-sm font-medium text-text-secondary" htmlFor="email">
          {t("ইমেইল", "Email")}
        </label>
        <input
          id="email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mb-4 w-full rounded-lg border border-border-strong bg-canvas px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
          placeholder="admin@edufusionbd.test"
        />

        <label className="mb-1.5 block text-sm font-medium text-text-secondary" htmlFor="password">
          {t("পাসওয়ার্ড", "Password")}
        </label>
        <input
          id="password"
          type="password"
          required
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mb-4 w-full rounded-lg border border-border-strong bg-canvas px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
          placeholder="••••••••"
        />

        {error ? (
          <p className="mb-4 rounded-lg bg-danger-bg px-3 py-2 text-sm text-danger-fg" role="alert">
            {error}
          </p>
        ) : null}

        <Button type="submit" className="w-full justify-center" disabled={loading}>
          {loading ? t("লগইন হচ্ছে…", "Signing in…") : t("লগইন", "Sign in")}
        </Button>
      </form>
    </main>
  );
}
