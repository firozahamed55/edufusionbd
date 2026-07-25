import Link from "next/link";
import type { Metadata } from "next";
import { getLocale } from "next-intl/server";
import { ROUTES } from "@/shared/constants/routes";

export const metadata: Metadata = { title: "Page not found" };

/**
 * Root 404. A server component on purpose — it must render for signed-out
 * visitors too, so it can't depend on any client provider or session state.
 * Locale comes from the same cookie the rest of the app reads.
 */
export default async function NotFound() {
  const isBn = (await getLocale()) === "bn";

  return (
    <main className="grid min-h-screen place-items-center bg-sunken px-6">
      <div className="flex max-w-md flex-col items-center gap-4 rounded-2xl border border-border-default bg-surface px-8 py-12 text-center">
        <p className="font-latin text-h1 font-bold text-primary">404</p>
        <h1 className="text-h4 font-semibold text-text-primary">
          {isBn ? "পেজটি খুঁজে পাওয়া যায়নি" : "Page not found"}
        </h1>
        <p className="text-sm text-text-muted">
          {isBn
            ? "আপনি যে পেজটি খুঁজছেন সেটি সরানো হয়েছে বা কখনও ছিল না।"
            : "The page you're looking for was moved, or never existed."}
        </p>
        <Link
          href={ROUTES.home}
          className="mt-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-text-on-primary hover:opacity-90"
        >
          {isBn ? "হোমে ফিরে যান" : "Back to home"}
        </Link>
      </div>
    </main>
  );
}
