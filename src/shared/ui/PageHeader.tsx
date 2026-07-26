import { cn } from "@/shared/lib/cn";
import type { Crumb } from "./Breadcrumb";

/**
 * The h1 + subtitle block that opens every admin screen (audit M-8).
 *
 * It was copied into 40 screens. Notably, all 40 copies were byte-identical —
 * `mt-1.5 text-h4 font-bold text-text-primary` and `mt-1 text-meta text-text-muted`
 * with zero drift — so this extraction is not fixing an inconsistency, it is
 * preventing the one that arrives the first time somebody nudges the spacing on
 * the screen they happen to be working on. Forty places to change is forty chances
 * to change thirty-nine.
 *
 * `crumbs` is accepted but no longer rendered: the breadcrumb moved into the
 * sticky topbar (final_admin.md T-3/§9.4) so orientation survives scrolling on
 * long tables. The prop stays so the ~15 call sites did not all need editing in
 * the same commit, and because the trail is still the screen's own knowledge —
 * a future "collapse to Home › … › Current" lives here, not in the shell.
 */
export function PageHeader({
  title,
  subtitle,
  className,
}: {
  /** @deprecated The topbar renders the trail now; passing this is a no-op. */
  crumbs?: Crumb[];
  title: string;
  subtitle?: string;
  className?: string;
}) {
  return (
    <header className={cn(className)}>
      <h1 className="text-h4 font-bold text-text-primary">{title}</h1>
      {subtitle ? <p className="mt-1 text-meta text-text-muted">{subtitle}</p> : null}
    </header>
  );
}
