"use client";

import { useState } from "react";
import Link from "next/link";
import { Pencil, Users } from "lucide-react";
import { useT } from "@/shared/i18n/useT";
import { GENDER, RELIGION, BLOOD_GROUP, BLOOD_TOKEN, BLOOD_LABEL } from "@/shared/constants/enums";
import {
  Button, Field, Select, Input, Skeleton, EmptyState, ErrorState, Modal, useToast,
  PageHeader, Pagination, LiveRegion, DataToolbar, Badge, RowActions,
  Table, THead, TBody, TR, TH, TD, TableEmpty, SortableTH,
} from "@/shared/ui";
import { useDataScreen, applyClientList } from "@/shared/lib/useDataScreen";
import { exportCsv } from "@/shared/lib/exportCsv";
import { localDay } from "@/shared/lib/format";
import { useClassSectionsLookup, useStudentCategories } from "@/shared/services/lookups/hooks";
import type { Option } from "@/shared/services/lookups/api";
import { useSectionStudents, useStudentBasic, useUpdateStudentBasic } from "../../logic/hooks";
import type { StudentBasicPayload } from "../../logic/api";
import { useErrorMessage } from "@/shared/services/errors";

/**
 * Student · Update Basic Info — section roster → edit modal.
 *
 * On the data-interaction contract (SRA A-0.1; A-2.2 named this screen for
 * having no URL state, no pagination and no export). Section and the open
 * record both live in the URL, so a half-finished correction survives a reload
 * and can be handed to whoever has the birth certificate on their desk.
 *
 * The three per-column filter boxes are gone. They were three inputs that each
 * did a substring match on one field; one search box across all three is the
 * contract's model, and it is also what someone holding a piece of paper
 * actually types — they have *a* number, not knowledge of which column it is.
 */

export function UpdateBasicScreen() {
  const { t, n, isBn } = useT();
  const msg = useErrorMessage();

  const ds = useDataScreen({ filters: { sectionId: "", id: "" } });
  const { sectionId, id: editId } = ds.filters;

  const sections = useClassSectionsLookup();
  const students = useSectionStudents(sectionId || null);

  const opt = (list?: Option[]) => (list ?? []).map((o) => ({ value: o.value, label: isBn ? o.label_bn : o.label_en }));

  const all = students.data ?? [];
  const { rows, total } = applyClientList(all, ds, {
    search: (r) => [r.code, r.roll, r.name_bn, r.name_en, r.category],
    sort: {
      code: (r) => r.code,
      roll: (r) => r.roll,
      name: (r) => (isBn ? r.name_bn : r.name_en),
      category: (r) => r.category,
    },
  });

  return (
    <div className="flex flex-col gap-5">
      <LiveRegion
        message={
          !sectionId
            ? ""
            : students.isLoading
              ? t("লোড হচ্ছে", "Loading students")
              : t(`${n(total)} জন শিক্ষার্থী পাওয়া গেছে`, `${total} students found`)
        }
      />

      <PageHeader
        crumbs={[{ label: t("শিক্ষার্থী", "Students"), href: "/admin/student/update-class" }, { label: t("মৌলিক তথ্য হালনাগাদ", "Update Basic Info") }]}
        title={t("মৌলিক তথ্য হালনাগাদ", "Update Basic Info")}
        subtitle={t("নির্বাচিত শিক্ষার্থীর মৌলিক তথ্য সম্পাদনা করুন", "Edit basic information of the selected student")}
      />

      <div className="flex flex-wrap items-end gap-3 rounded-2xl bg-surface p-5 shadow-e1">
        <Field label={t("শ্রেণি ও শাখা", "Class & Section")} required className="w-90 max-w-full">
          <Select
            value={sectionId}
            placeholder={sections.isLoading ? t("লোড হচ্ছে…", "Loading…") : t("নির্বাচন করুন", "Select")}
            options={opt(sections.data)}
            onChange={(e) => ds.setFilter("sectionId", e.target.value)}
          />
        </Field>
        {/* No Search button: the roster loads reactively from the select. */}
      </div>

      {sectionId ? (
        <DataToolbar
          q={ds.q}
          onQChange={ds.setQ}
          placeholder={t("নাম, আইডি বা রোল খুঁজুন", "Search name, ID or roll")}
          searchLabel={t("শিক্ষার্থী খুঁজুন", "Search students")}
          isFiltered={ds.isFiltered}
          onReset={ds.reset}
          onExportAll={() =>
            exportCsv(
              `section-students-${localDay()}.csv`,
              all.map((r) => ({
                StudentId: r.code ?? "",
                Roll: r.roll ?? "",
                Name: r.name_en,
                NameBn: r.name_bn,
                Category: r.category ?? "",
              })),
            )
          }
          exportAllCount={all.length}
        />
      ) : null}

      {!sectionId ? (
        <EmptyState icon={<Users size={22} />} title={t("একটি শ্রেণি ও শাখা নির্বাচন করুন", "Select a class & section")} description={t("শিক্ষার্থী তালিকা দেখতে উপরে থেকে শ্রেণি বেছে নিন।", "Pick a section above to load its student list.")} />
      ) : students.isError ? (
        <ErrorState title={t("তালিকা লোড করা যায়নি", "Could not load list")} description={msg(students.error)} />
      ) : !students.isLoading && all.length === 0 ? (
        <EmptyState icon={<Users size={22} />} title={t("এই শাখায় কোনো শিক্ষার্থী নেই", "No students in this section")} />
      ) : (
        <>
          <Table minWidth={820}>
            <THead>
              <TR>
                <SortableTH sortKey="code" sort={ds.sort} onSort={ds.setSort}>{t("শিক্ষার্থী আইডি", "Student ID")}</SortableTH>
                <SortableTH sortKey="roll" sort={ds.sort} onSort={ds.setSort}>{t("রোল", "Roll")}</SortableTH>
                <SortableTH sortKey="name" sort={ds.sort} onSort={ds.setSort}>{t("নাম", "Name")}</SortableTH>
                <SortableTH sortKey="category" sort={ds.sort} onSort={ds.setSort}>{t("ক্যাটাগরি", "Category")}</SortableTH>
                <TH className="w-20 text-right">{t("অ্যাকশন", "Action")}</TH>
              </TR>
            </THead>
            <TBody>
              {students.isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <TR key={i}>{Array.from({ length: 5 }).map((__, j) => <TD key={j}><Skeleton className="h-5" /></TD>)}</TR>
                ))
              ) : rows.length === 0 ? (
                <TableEmpty colSpan={5} icon={<Users size={22} />} title={t("কোনো মিল পাওয়া যায়নি", "No matches")} />
              ) : (
                rows.map((r) => (
                  <TR key={r.enrollmentId}>
                    <TD className="font-latin text-meta font-medium text-text-secondary tnum">{r.code ? n(r.code) : "—"}</TD>
                    <TD className="text-meta text-text-secondary tnum">{r.roll != null ? n(r.roll) : "—"}</TD>
                    <TD className="text-sm font-medium">
                      <Link href={`/admin/student/profile?id=${r.studentId}`} className="text-primary hover:underline">
                        {isBn ? r.name_bn : r.name_en}
                      </Link>
                    </TD>
                    <TD><Badge tone="info">{r.category ?? t("সাধারণ", "General")}</Badge></TD>
                    <TD className="text-right">
                      <RowActions
                        label={t("অ্যাকশন", "Actions")}
                        actions={[
                          {
                            label: t("সম্পাদনা", "Edit"),
                            icon: Pencil,
                            // URL-backed, so an open record survives a reload
                            // and is linkable (the fix A-3.1 made for teachers).
                            onClick: () => ds.setFilter("id", r.studentId),
                          },
                          { label: t("প্রোফাইল", "Open profile"), href: `/admin/student/profile?id=${r.studentId}` },
                        ]}
                      />
                    </TD>
                  </TR>
                ))
              )}
            </TBody>
          </Table>

          {total > ds.perPage ? (
            <Pagination
              label={t(
                `${n(ds.from)}–${n(ds.to(total))} দেখানো হচ্ছে · মোট ${n(total)} জন`,
                `Showing ${ds.from}-${ds.to(total)} of ${total}`,
              )}
              pages={ds.pages(total)}
              current={ds.page}
              onPageChange={ds.setPage}
            />
          ) : null}
        </>
      )}

      {editId ? <EditModal studentId={editId} onClose={() => ds.setFilter("id", "")} /> : null}
    </div>
  );
}

function EditModal({ studentId, onClose }: { studentId: string; onClose: () => void }) {
  const { t, isBn } = useT();
  const msg = useErrorMessage();
  const toast = useToast();
  const detail = useStudentBasic(studentId);
  const categories = useStudentCategories();
  const update = useUpdateStudentBasic();
  const [f, setF] = useState<Record<string, string> | null>(null);

  const values = f ?? (detail.data
    ? { ...detail.data, blood_group: detail.data.blood_group ? BLOOD_LABEL[detail.data.blood_group] ?? "" : "" }
    : null);
  const up = (k: string, v: string) => setF((p) => ({ ...(p ?? (values as Record<string, string>)), [k]: v }));

  function save() {
    if (!values) return;
    if (!values.name_bn || !values.name_en) {
      toast({ title: t("নাম আবশ্যক", "Name is required"), variant: "error" });
      return;
    }
    const payload: StudentBasicPayload = {
      id: studentId,
      name_bn: values.name_bn,
      name_en: values.name_en,
      dob: values.dob,
      gender: values.gender,
      blood_group: values.blood_group ? BLOOD_TOKEN[values.blood_group] ?? "" : "",
      religion: values.religion,
      birth_reg_no: values.birth_reg_no,
      nationality: values.nationality,
      student_category_id: values.student_category_id,
    };
    update.mutate(payload, {
      onSuccess: () => { toast({ title: t("তথ্য হালনাগাদ হয়েছে", "Info updated"), variant: "success" }); onClose(); },
      onError: (e: unknown) => toast({ title: msg(e, { bn: "সংরক্ষণ ব্যর্থ", en: "Save failed" }), variant: "error" }),
    });
  }

  return (
    <Modal open onClose={onClose} title={t("মৌলিক তথ্য সম্পাদনা", "Edit Basic Info")}
      description={detail.data?.student_code ?? undefined} className="max-w-lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={update.isPending}>{t("বাতিল", "Cancel")}</Button>
          <Button variant="primary" onClick={save} disabled={update.isPending || !values}>
            {update.isPending ? t("সংরক্ষণ হচ্ছে…", "Saving…") : t("সংরক্ষণ করুন", "Save")}
          </Button>
        </>
      }>
      {detail.isLoading || !values ? (
        <div className="flex flex-col gap-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-11" />)}</div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label={t("নাম (বাংলা)", "Name (Bangla)")} required><Input value={values.name_bn} onChange={(e) => up("name_bn", e.target.value)} /></Field>
            <Field label={t("Name (English)", "Name (English)")} required><Input value={values.name_en} onChange={(e) => up("name_en", e.target.value)} className="font-latin" /></Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label={t("জন্ম তারিখ", "Date of Birth")}><Input type="date" value={values.dob} onChange={(e) => up("dob", e.target.value)} /></Field>
            <Field label={t("লিঙ্গ", "Gender")}>
              <Select value={values.gender} onChange={(e) => up("gender", e.target.value)} options={GENDER.map((g) => ({ value: g.value, label: isBn ? g.bn : g.en }))} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label={t("রক্তের গ্রুপ", "Blood Group")}>
              <Select value={values.blood_group} onChange={(e) => up("blood_group", e.target.value)} placeholder={t("নির্বাচন", "Select")} options={BLOOD_GROUP.map((b) => ({ value: b, label: b }))} />
            </Field>
            <Field label={t("ধর্ম", "Religion")}>
              <Select value={values.religion} onChange={(e) => up("religion", e.target.value)} placeholder={t("নির্বাচন", "Select")} options={RELIGION.map((r) => ({ value: r.value, label: isBn ? r.bn : r.en }))} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label={t("জন্ম নিবন্ধন", "Birth Reg.")}><Input value={values.birth_reg_no} onChange={(e) => up("birth_reg_no", e.target.value)} className="font-latin" /></Field>
            <Field label={t("ক্যাটাগরি", "Category")}>
              <Select value={values.student_category_id} onChange={(e) => up("student_category_id", e.target.value)} placeholder={t("নির্বাচন", "Select")}
                options={(categories.data ?? []).map((c) => ({ value: c.value, label: isBn ? c.label_bn : c.label_en }))} />
            </Field>
          </div>
        </div>
      )}
    </Modal>
  );
}
