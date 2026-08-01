"use client";

import { cn } from "@/shared/lib/cn";
import { useT } from "@/shared/i18n/useT";
import type { DocSignature, Letterhead as LetterheadData } from "./assets";

/* eslint-disable @next/next/no-img-element -- next/image optimises through a
   loader that is not available for a Supabase signed URL, and a printed sheet
   wants the original raster at its native resolution, not a resized variant. */

/**
 * The institution block at the top of every full-page artefact.
 *
 * `compact` is the ID-card / receipt variant: same data, one line, no rule.
 */
export function Letterhead({
  data,
  compact,
  className,
}: {
  data: LetterheadData | null | undefined;
  compact?: boolean;
  className?: string;
}) {
  const { t, isBn } = useT();
  if (!data) return null;
  const name = isBn ? data.name_bn : data.name_en;

  if (compact) {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        {data.logoUrl ? <img src={data.logoUrl} alt="" className="h-6 w-6 object-contain" /> : null}
        <div className="min-w-0">
          <p className="truncate text-xs font-bold leading-tight">{name}</p>
          {data.address ? <p className="truncate text-micro leading-tight">{data.address}</p> : null}
        </div>
      </div>
    );
  }

  return (
    <header className={cn("flex items-center gap-4 border-b-2 border-black pb-3", className)}>
      {data.logoUrl ? <img src={data.logoUrl} alt="" className="h-16 w-16 shrink-0 object-contain" /> : null}
      <div className="min-w-0 flex-1 text-center">
        <h1 className="text-h4 font-bold leading-tight">{name}</h1>
        {data.address ? <p className="mt-0.5 text-meta leading-tight">{data.address}</p> : null}
        <p className="mt-0.5 text-micro leading-tight">
          {[
            data.eiin ? `${t("ইআইআইএন", "EIIN")}: ${data.eiin}` : null,
            data.phone,
            data.email,
          ]
            .filter(Boolean)
            .join("  ·  ")}
        </p>
      </div>
      {data.logoUrl ? <span className="h-16 w-16 shrink-0" aria-hidden /> : null}
    </header>
  );
}

/**
 * The signature strip at the foot of a certificate.
 *
 * Renders the signature image when the institution uploaded one and a ruled
 * line when it did not, so an unsigned deployment still produces a document
 * somebody can sign by hand rather than a document with a hole in it.
 */
export function SignatureBlock({
  signatures,
  roles,
  className,
}: {
  signatures: readonly DocSignature[] | undefined;
  /** Role labels to render, in order. Missing ones still get a ruled line. */
  roles: readonly string[];
  className?: string;
}) {
  return (
    <div className={cn("flex items-end justify-between gap-8", className)}>
      {roles.map((role) => {
        const sig = signatures?.find((s) => s.role_label.toLowerCase() === role.toLowerCase());
        return (
          <div key={role} className="flex min-w-0 flex-1 flex-col items-center gap-1">
            {sig?.imageUrl ? (
              <img src={sig.imageUrl} alt="" className="h-10 object-contain" />
            ) : (
              <span className="h-10" aria-hidden />
            )}
            <span className="w-full border-t border-black" />
            <span className="text-micro font-semibold">{sig?.holder_name ?? ""}</span>
            <span className="text-micro">{sig?.role_label ?? role}</span>
          </div>
        );
      })}
    </div>
  );
}
