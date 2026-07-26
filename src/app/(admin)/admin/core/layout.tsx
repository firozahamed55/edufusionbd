import { ModuleTabs } from "@/features/admin/components";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-5">
      <ModuleTabs moduleKey="core" />
      {children}
    </div>
  );
}
