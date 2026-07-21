"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { CHILDREN, type Child } from "./data";

/**
 * Active-child context — powers the multi-child switcher (Figma parent header
 * pills). A guardian with several children picks one; every screen reads the
 * active child from here, so switching updates the whole app in place.
 */
type ChildCtx = {
  children: Child[];
  activeId: string;
  active: Child;
  setActiveId: (id: string) => void;
};

const Ctx = createContext<ChildCtx | null>(null);

export function ChildProvider({ children }: { children: ReactNode }) {
  const [activeId, setActiveId] = useState(CHILDREN[0].id);
  const value = useMemo<ChildCtx>(() => {
    const active = CHILDREN.find((c) => c.id === activeId) ?? CHILDREN[0];
    return { children: CHILDREN, activeId, active, setActiveId };
  }, [activeId]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useActiveChild(): ChildCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useActiveChild must be used within ChildProvider");
  return ctx;
}
