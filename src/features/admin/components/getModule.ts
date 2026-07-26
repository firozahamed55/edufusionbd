import { ADMIN_ALL_MODULES, type AdminModule } from "./adminNav";

/** Look up a module by key for a module-level layout.tsx. Throws on typo — fail loud at build/test time, not with a blank tab bar in prod. */
export function getModule(key: string): AdminModule {
  const mod = ADMIN_ALL_MODULES.find((m) => m.key === key);
  if (!mod) throw new Error(`getModule: no admin module with key "${key}"`);
  return mod;
}
