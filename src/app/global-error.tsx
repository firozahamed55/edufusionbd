"use client";

import { useEffect } from "react";
import { reportError } from "@/shared/services/observability";

/**
 * Last-resort boundary: catches errors thrown by the ROOT layout itself.
 *
 * When this renders, `app/layout.tsx` has already failed — so there is no
 * ThemeProvider, no next-intl provider, and possibly no design system. It must
 * therefore replace `<html>`/`<body>` itself and depend on nothing: inline
 * styles only, both languages shown side by side rather than via `useT()`.
 * Anything imported here is one more thing that can fail on the way to showing
 * the user an error.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // The one import this file allows itself: `observability` has zero
    // dependencies (no React, no providers), so it cannot be part of whatever
    // just broke the root layout. A fatal that logs nothing is unfixable.
    reportError(error, "boundary:root");
  }, [error]);

  return (
    <html lang="bn">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          padding: "24px",
          background: "#f6f7fb",
          color: "#1b1f2a",
          fontFamily:
            "system-ui, -apple-system, 'Segoe UI', Roboto, 'Noto Sans Bengali', sans-serif",
        }}
      >
        <main
          role="alert"
          style={{
            maxWidth: "34rem",
            textAlign: "center",
            background: "#fff",
            border: "1px solid #e3e6ef",
            borderRadius: "16px",
            padding: "40px 28px",
          }}
        >
          <h1 style={{ fontSize: "1.25rem", margin: "0 0 8px" }}>
            অ্যাপ্লিকেশন চালু করা যায়নি
          </h1>
          <p style={{ fontSize: "0.95rem", margin: "0 0 4px", color: "#5b6376" }}>
            The application failed to start.
          </p>
          <p style={{ fontSize: "0.9rem", margin: "0 0 24px", color: "#5b6376" }}>
            পেজটি রিলোড করুন। সমস্যা থাকলে সাপোর্টে জানান। / Reload the page; if
            this persists, contact support.
          </p>

          <button
            type="button"
            onClick={reset}
            style={{
              cursor: "pointer",
              border: 0,
              borderRadius: "10px",
              padding: "10px 20px",
              fontSize: "0.95rem",
              fontWeight: 600,
              color: "#fff",
              background: "#4f46e5",
            }}
          >
            আবার চেষ্টা করুন / Try again
          </button>

          {error.digest ? (
            <p style={{ marginTop: "16px", fontSize: "0.75rem", color: "#8a90a2" }}>
              Reference: {error.digest}
            </p>
          ) : null}
        </main>
      </body>
    </html>
  );
}
