export const ROLES = ["admin", "teacher", "parent", "student", "super_admin"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, { bn: string; en: string }> = {
  admin: { bn: "প্রশাসক", en: "Admin" },
  teacher: { bn: "শিক্ষক", en: "Teacher" },
  parent: { bn: "অভিভাবক", en: "Parent" },
  student: { bn: "শিক্ষার্থী", en: "Student" },
  super_admin: { bn: "সুপার অ্যাডমিন", en: "Super Admin" },
};
