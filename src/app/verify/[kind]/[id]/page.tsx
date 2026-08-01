import Link from "next/link";
import { createClient } from "@/shared/services/supabase/server";

/**
 * Public certificate verification (SRA A-7 point 6).
 *
 * The QR printed on a testimonial or transfer certificate resolves here. It is
 * deliberately outside every auth group: the person checking is a clerk at the
 * receiving school with no account, and a verification page behind a login
 * verifies nothing.
 *
 * `fn_verify_document` is the only thing this reads. It is uuid-keyed, so the
 * register cannot be walked, and it returns the institution, the student's
 * name and the issue date — enough to confirm the paper, and nothing more.
 */
export const dynamic = "force-dynamic";

type Payload = {
  found?: boolean;
  kind?: string;
  serial?: string | null;
  issued_at?: string | null;
  session?: string | null;
  student_bn?: string;
  student_en?: string;
  institution_bn?: string;
  institution_en?: string;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function VerifyPage({
  params,
}: {
  params: Promise<{ kind: string; id: string }>;
}) {
  const { kind, id } = await params;

  // A malformed id is a not-found, not a 500 from a failed uuid cast.
  let payload: Payload = { found: false };
  if (UUID.test(id) && (kind === "testimonial" || kind === "transfer")) {
    const supabase = await createClient();
    const { data } = await supabase.rpc("fn_verify_document", { p_kind: kind, p_id: id });
    payload = (data ?? { found: false }) as Payload;
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 p-6">
      <header className="text-center">
        <p className="text-meta font-semibold uppercase tracking-wide text-primary">EduFusionBD</p>
        <h1 className="mt-1 text-h4 font-bold text-text-primary">নথি যাচাই / Document verification</h1>
      </header>

      {payload.found ? (
        <section className="flex flex-col gap-3 rounded-2xl border border-success-fg/30 bg-surface p-6 shadow-e1">
          <p className="rounded-lg bg-success-bg px-3 py-2 text-center text-meta font-semibold text-success-fg">
            ✓ এই নথিটি বৈধ / This document is on record
          </p>
          <Row label="ধরন / Type" value={payload.kind === "transfer" ? "স্থানান্তর সনদ / Transfer Certificate" : "প্রশংসাপত্র / Testimonial"} />
          <Row label="সনদ নং / Serial" value={payload.serial ?? "—"} />
          <Row label="শিক্ষার্থী / Student" value={`${payload.student_bn ?? ""} / ${payload.student_en ?? ""}`} />
          <Row label="প্রতিষ্ঠান / Institution" value={`${payload.institution_bn ?? ""} / ${payload.institution_en ?? ""}`} />
          <Row label="সেশন / Session" value={payload.session ?? "—"} />
          <Row label="ইস্যু / Issued" value={payload.issued_at ? String(payload.issued_at).slice(0, 10) : "—"} />
        </section>
      ) : (
        <section className="flex flex-col gap-2 rounded-2xl border border-danger-fg/30 bg-surface p-6 text-center shadow-e1">
          <p className="rounded-lg bg-danger-bg px-3 py-2 text-meta font-semibold text-danger-fg">
            এই নথিটি পাওয়া যায়নি / No such document on record
          </p>
          <p className="text-meta text-text-muted">
            কোডটি আবার স্ক্যান করুন, অথবা প্রতিষ্ঠানের সাথে যোগাযোগ করুন।
            <br />
            Re-scan the code, or contact the issuing institution.
          </p>
        </section>
      )}

      <p className="text-center text-micro text-text-muted">
        <Link href="/" className="text-primary hover:underline">EduFusionBD</Link>
      </p>
    </main>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3 border-b border-border-default pb-2 last:border-0 last:pb-0">
      <dt className="w-32 shrink-0 text-meta text-text-muted">{label}</dt>
      <dd className="min-w-0 flex-1 text-meta font-semibold text-text-primary">{value}</dd>
    </div>
  );
}
