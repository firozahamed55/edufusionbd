"use client";

import { useState } from "react";
import { Users, Download } from "lucide-react";
import {
  Button,
  StatCard,
  Badge,
  type BadgeTone,
  FormCard,
  Field,
  Input,
  Select,
  Textarea,
  SaveBar,
  UnsavedDot,
  Checkbox,
  Pagination,
  Breadcrumb,
  Table,
  THead,
  TBody,
  TR,
  TH,
  TD,
  TableEmpty,
  Skeleton,
  Spinner,
  EmptyState,
  ErrorState,
  PasswordInput,
  OtpInput,
  Stepper,
  Modal,
  ConfirmDialog,
  useToast,
  BarChart,
  Donut,
} from "@/shared/ui";

const VARIANTS = ["primary", "secondary", "tertiary", "ghost", "danger"] as const;
const SIZES = ["sm", "md", "lg"] as const;
const TONES: BadgeTone[] = ["neutral", "primary", "info", "success", "warning", "danger"];
const TYPE_SCALE = [
  { cls: "text-micro", label: "text-micro — 11px" },
  { cls: "text-xs", label: "text-xs — 12px" },
  { cls: "text-meta", label: "text-meta — 13px" },
  { cls: "text-body", label: "text-body — 15px" },
  { cls: "text-label", label: "text-label — 17px" },
  { cls: "text-h4", label: "text-h4 — 22px" },
  { cls: "text-h3", label: "text-h3 — 26px" },
  { cls: "text-stat", label: "text-stat — 29px" },
  { cls: "text-h1", label: "text-h1 — 40px" },
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-h4 font-bold text-text-primary">{title}</h2>
      <div className="flex flex-col gap-4 rounded-2xl bg-surface p-6 shadow-e3">{children}</div>
    </section>
  );
}

/**
 * Living style guide — one example of every shared/ui export, plus the type
 * scale as a literal specimen sheet. Internal tool only: underscore-prefixed
 * route so it's excluded from adminNav; still gated by the (admin) layout's
 * role-check middleware like every other /admin/* route.
 */
export default function StyleguidePage() {
  const toast = useToast();
  const [page, setPage] = useState(2);
  const [modalOpen, setModalOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [otp, setOtp] = useState("");
  const [checked, setChecked] = useState(true);

  return (
    <div className="flex flex-col gap-8 pb-16">
      <div>
        <h1 className="text-h1 font-bold text-text-primary">Style Guide</h1>
        <p className="mt-1 text-meta text-text-muted">Every shared/ui primitive, one example each.</p>
      </div>

      <Section title="Type scale">
        <div className="flex flex-col gap-2">
          {TYPE_SCALE.map((t) => (
            <p key={t.cls} className={`${t.cls} text-text-primary`}>{t.label}</p>
          ))}
        </div>
      </Section>

      <Section title="Button">
        <div className="flex flex-col gap-4">
          {SIZES.map((size) => (
            <div key={size} className="flex flex-wrap items-center gap-3">
              <span className="w-10 text-meta text-text-muted">{size}</span>
              {VARIANTS.map((variant) => (
                <Button key={variant} variant={variant} size={size}>
                  {variant}
                </Button>
              ))}
              <Button variant="primary" size={size} disabled>disabled</Button>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Badge">
        <div className="flex flex-wrap gap-2.5">
          {TONES.map((tone) => (
            <Badge key={tone} tone={tone}>{tone}</Badge>
          ))}
          {TONES.map((tone) => (
            <Badge key={`${tone}-dot`} tone={tone} dot>{tone} + dot</Badge>
          ))}
        </div>
      </Section>

      <Section title="StatCard">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard label="Total Students" value="1,240" delta="+4.2%" trend="up" icon={<Users size={18} />} />
          <StatCard label="Dues" value="৳12,000" delta="-2.1%" trend="down" icon={<Users size={18} />} />
          <StatCard label="Active Staff" value="86" trend="flat" />
        </div>
      </Section>

      <Section title="Charts">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <BarChart
            caption="Weekly attendance"
            data={[
              { label: "Sun", value: 90 },
              { label: "Mon", value: 86 },
              { label: "Tue", value: 92 },
              { label: "Wed", value: 89 },
              { label: "Thu", value: 93 },
            ]}
            unit="%"
          />
          <Donut percent={62} label="Collected" />
        </div>
      </Section>

      <Section title="Breadcrumb">
        <Breadcrumb items={[{ label: "Core Settings", href: "/admin/core/basic-config" }, { label: "Style Guide" }]} />
      </Section>

      <Section title="Form primitives">
        <FormCard title="Institution profile" action={<Button size="sm" variant="secondary">Action</Button>}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Institution name" required hint="Shown on certificates">
              <Input placeholder="EduFusionBD High School" />
            </Field>
            <Field label="District">
              <Select
                placeholder="Select a district"
                options={[{ value: "dhaka", label: "Dhaka" }, { value: "ctg", label: "Chattogram" }]}
              />
            </Field>
            <Field label="Notes" className="sm:col-span-2">
              <Textarea placeholder="Optional notes…" />
            </Field>
            <Field label="Password">
              <PasswordInput placeholder="••••••••" />
            </Field>
            <Field label="Enable SMS notifications">
              <Checkbox checked={checked} onChange={(e) => setChecked(e.target.checked)} />
            </Field>
          </div>
        </FormCard>
        <SaveBar status={<><UnsavedDot /><span>Unsaved changes</span></>}>
          <Button variant="secondary">Reset</Button>
          <Button variant="primary">Save</Button>
        </SaveBar>
      </Section>

      <Section title="OTP input">
        <div className="max-w-xs">
          <OtpInput value={otp} onChange={setOtp} />
        </div>
      </Section>

      <Section title="Stepper">
        <Stepper steps={["Account", "Institution", "Branding", "Done"]} current={1} />
      </Section>

      <Section title="Table">
        <Table minWidth={480}>
          <THead>
            <TR>
              <TH>Name</TH>
              <TH>Status</TH>
            </TR>
          </THead>
          <TBody>
            <TR>
              <TD>Nusrat Jahan</TD>
              <TD><Badge tone="success" dot>Active</Badge></TD>
            </TR>
            <TR>
              <TD>Kamal Uddin</TD>
              <TD><Badge tone="warning" dot>On Leave</Badge></TD>
            </TR>
          </TBody>
        </Table>
        <Table minWidth={480}>
          <THead>
            <TR><TH>Empty example</TH></TR>
          </THead>
          <TBody>
            <TableEmpty colSpan={1} icon={<Users size={22} />} title="No rows" description="This is the zero state." />
          </TBody>
        </Table>
      </Section>

      <Section title="Pagination">
        <Pagination label="11–20 of 42" pages={5} current={page} onPageChange={setPage} />
      </Section>

      <Section title="Loading / empty / error states">
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <Spinner /> <Skeleton className="h-5 w-40" />
          </div>
          <EmptyState icon={<Users size={22} />} title="No teachers found" description="Add a teacher to get started." action={<Button size="sm">Add teacher</Button>} />
          <ErrorState title="Couldn't load data" description="Something went wrong." action={<Button size="sm" variant="secondary">Retry</Button>} />
        </div>
      </Section>

      <Section title="Modal / ConfirmDialog / Toast">
        <div className="flex flex-wrap gap-3">
          <Button onClick={() => setModalOpen(true)}>Open modal</Button>
          <Button variant="danger" onClick={() => setConfirmOpen(true)}>Open confirm dialog</Button>
          <Button variant="secondary" onClick={() => toast({ title: "Saved", variant: "success" })}>
            <Download size={16} /> Fire a toast
          </Button>
        </div>
        <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Example modal" description="A description goes here.">
          <p className="text-sm text-text-secondary">Modal body content.</p>
        </Modal>
        <ConfirmDialog
          open={confirmOpen}
          onClose={() => setConfirmOpen(false)}
          onConfirm={() => setConfirmOpen(false)}
          title="Delete this record?"
          description="This cannot be undone."
          tone="danger"
          confirmLabel="Delete"
        />
      </Section>
    </div>
  );
}
