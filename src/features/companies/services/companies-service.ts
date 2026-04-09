import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
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
