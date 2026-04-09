"use client";

import { useEffect, useState } from "react";
import { useAppSelector } from "@/shared/store/hooks";
import { selectSessionUser } from "@/features/session/models/session-selectors";

const STORAGE_KEY = "lotea_active_company_id";

/** Dispara re-render en la misma pestaña (p. ej. menú) al elegir empresa. */
export const LOTEA_COMPANY_STORAGE_EVENT = "lotea:active-company-changed";

export type EffectiveCompanySource = "user" | "local" | null;

export function getStoredCompanyId(): string | null {
  if (typeof window === "undefined") return null;
  const v = localStorage.getItem(STORAGE_KEY);
  return v?.trim() ? v.trim() : null;
}

export function setStoredCompanyId(id: string) {
  localStorage.setItem(STORAGE_KEY, id.trim());
  window.dispatchEvent(new Event(LOTEA_COMPANY_STORAGE_EVENT));
}

export function clearStoredCompanyId() {
  localStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new Event(LOTEA_COMPANY_STORAGE_EVENT));
}

/** Prioridad: claim `companyId` del usuario → ID guardado en este navegador (para master / pruebas). */
export function useEffectiveCompanyId(storageRevision = 0): {
  companyId: string | null;
  source: EffectiveCompanySource;
} {
  const user = useAppSelector(selectSessionUser);
  const [stored, setStoredState] = useState<string | null>(null);

  useEffect(() => {
    const sync = () => setStoredState(getStoredCompanyId());
    sync();
    window.addEventListener(LOTEA_COMPANY_STORAGE_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(LOTEA_COMPANY_STORAGE_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, [user?.companyId, storageRevision]);

  const fromUser = user?.companyId?.trim() || null;
  if (fromUser) {
    return { companyId: fromUser, source: "user" };
  }
  if (stored) {
    return { companyId: stored, source: "local" };
  }
  return { companyId: null, source: null };
}
