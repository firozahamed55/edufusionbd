import Link from "next/link";
import { ChevronRight } from "lucide-react";

export type Crumb = { label: string; href?: string };

/** Navigation trail — the last item is always the current page (no link, aria-current). */
export function Breadcrumb({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1.5 text-meta text-text-muted">
      {items.map((item, i) => {
        const last = i === items.length - 1;
        return (
          <span key={i} className="flex items-center gap-1.5">
            {item.href && !last ? (
              <Link href={item.href} className="hover:text-text-secondary hover:underline">
                {item.label}
              </Link>
            ) : (
              <span aria-current={last ? "page" : undefined} className={last ? "text-text-secondary" : undefined}>
                {item.label}
              </span>
            )}
            {!last ? <ChevronRight size={12} aria-hidden /> : null}
          </span>
        );
      })}
    </nav>
  );
}
