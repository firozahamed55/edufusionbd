import type { Metadata } from "next";
import { Hind_Siliguri, Inter } from "next/font/google";
import { headers } from "next/headers";
import { getLocale, getMessages } from "next-intl/server";
import { Providers } from "./providers";
import "./globals.css";

/* Type system: Hind Siliguri (Bangla — the plain, highly legible workhorse face
   used across most Bangladeshi web/UI; familiar and unfussy) + Inter (Latin).
   Loading them here is what makes the type render correctly across the app —
   without this the UI falls back to system fonts and every screen reads "off".
   The bn↔en apparent-size match is handled by `font-size-adjust` in globals.css
   so switching locale never changes layout, spacing, or the typographic scale. */
const hindSiliguri = Hind_Siliguri({
  weight: ["400", "500", "600", "700"],
  subsets: ["bengali", "latin"],
  variable: "--font-bn",
  display: "swap",
});
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-latin",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "EduFusionBD", template: "%s · EduFusionBD" },
  description: "Multi-tenant school management for Bangladesh — Bangla-first.",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getLocale();
  const messages = await getMessages();
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  return (
    <html
      lang={locale}
      className={`${hindSiliguri.variable} ${inter.variable}`}
      suppressHydrationWarning
    >
      <body>
        <Providers locale={locale} messages={messages} nonce={nonce}>
          {children}
        </Providers>
      </body>
    </html>
  );
}
