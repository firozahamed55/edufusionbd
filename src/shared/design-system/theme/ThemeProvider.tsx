"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ReactNode } from "react";

/**
 * Writes data-theme="light|dark" on <html>. All semantic tokens key off this,
 * so themes switch with zero per-component code. enableSystem honours the OS
 * preference on first load (design-system spec: auto-switching).
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemesProvider
      attribute="data-theme"
      defaultTheme="light"
      enableSystem
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}
