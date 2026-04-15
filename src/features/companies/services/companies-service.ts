import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  serverTimestamp,
  type DocumentData,
} from "firebase/firestore";
import { db } from "@/shared/firebase/firebase-client";
import type { SessionUser } from "@/features/session/models/session-types";
import type { Company } from "../models/company-types";

function mapCompanyDoc(id: string, data: DocumentData): Company {
  return {
    id,
    name: String(data.name ?? "Sin nombre"),
    legalName:
      typeof data.legalName === "string" && data.legalName.trim().length > 0
        ? data.legalName.trim()
        : null,
    nit:
      typeof data.nit === "string" && data.nit.trim().length > 0
        ? data.nit.trim()
        : null,
    phone:
      typeof data.phone === "string" && data.phone.trim().length > 0
        ? data.phone.trim()
        : null,
    email:
      typeof data.email === "string" && data.email.trim().length > 0
        ? data.email.trim()
        : null,
    createdAt: data.createdAt ?? null,
  };
}

export async function fetchCompanyById(companyId: string): Promise<Company | null> {
  const ref = doc(db, "companies", companyId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return mapCompanyDoc(snap.id, snap.data());
}

/** Master: todas las empresas. Usuario de empresa: solo la suya (según claims). */
export async function fetchAccessibleCompanies(user: SessionUser | null): Promise<Company[]> {
  if (!user) return [];

  if (user.globalRole === "master") {
    const snap = await getDocs(collection(db, "companies"));
    const list: Company[] = [];
    snap.forEach((d) => {
      list.push(mapCompanyDoc(d.id, d.data()));
    });
    list.sort((a, b) => a.name.localeCompare(b.name, "es"));
    return list;
  }

  if (user.companyId) {
    const c = await fetchCompanyById(user.companyId);
    return c ? [c] : [];
  }

  return [];
}

export async function createCompany(name: string, createdByUid: string): Promise<string> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("El nombre de la empresa es obligatorio");

  const ref = await addDoc(collection(db, "companies"), {
    name: trimmed,
    createdAt: serverTimestamp(),
    createdByUid,
  });
  return ref.id;
}

export type UpdateCompanyInput = {
  name?: string;
  legalName?: string | null;
  nit?: string | null;
  phone?: string | null;
  email?: string | null;
};

export async function updateCompany(companyId: string, input: UpdateCompanyInput): Promise<void> {
  const patch: Record<string, unknown> = {};

  if (input.name !== undefined) {
    const name = input.name.trim();
    if (!name) throw new Error("El nombre de la empresa es obligatorio.");
    patch.name = name;
  }

  if (input.legalName !== undefined) {
    const value = input.legalName?.trim();
    patch.legalName = value ? value : null;
  }

  if (input.nit !== undefined) {
    const value = input.nit?.trim();
    patch.nit = value ? value : null;
  }

  if (input.phone !== undefined) {
    const value = input.phone?.trim();
    patch.phone = value ? value : null;
  }

  if (input.email !== undefined) {
    const value = input.email?.trim();
    patch.email = value ? value : null;
  }

  if (Object.keys(patch).length === 0) return;
  await updateDoc(doc(db, "companies", companyId), patch);
}
