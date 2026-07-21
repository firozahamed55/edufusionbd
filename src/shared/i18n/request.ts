import { getRequestConfig } from "next-intl/server";
import { cookies } from "next/headers";
import { defaultLocale, LOCALE_COOKIE, locales, type Locale } from "./config";

/**
 * Cookie-based locale (no locale in the URL) — the Bn/En toggle just flips a
 * cookie. Fits an authenticated app better than /bn /en URL segments.
 */
export default getRequestConfig(async () => {
  const store = await cookies();
  const cookieLocale = store.get(LOCALE_COOKIE)?.value as Locale | undefined;
  const locale =
    cookieLocale && locales.includes(cookieLocale) ? cookieLocale : defaultLocale;

  // Translation is inline via useT(t/tb/n); no message catalog is loaded.
  return { locale, messages: {} };
});
