import {
  addDoc,
  collection,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/shared/firebase/firebase-client";
import type { Contractor } from "../models/contractor-types";

function contractorsCol(companyId: string) {
  return collection(db, "companies", companyId, "contractors");
}

function mapContractor(id: string, data: Record<string, unknown>): Contractor {
  return {
    id,
    name: String(data.name ?? "").trim(),
    phone: String(data.phone ?? "").trim(),
    createdAt: data.createdAt as Contractor["createdAt"],
    updatedAt: data.updatedAt as Contractor["updatedAt"],
  };
}

export async function fetchContractors(companyId: string): Promise<Contractor[]> {
  const q = query(contractorsCol(companyId), orderBy("name", "asc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => mapContractor(d.id, d.data() as Record<string, unknown>));
}

export type CreateContractorInput = {
  name: string;
  /** Vacío = sin teléfono guardado. */
  phone?: string;
};

export async function createContractor(companyId: string, input: CreateContractorInput): Promise<string> {
  const name = input.name.trim();
  if (!name) throw new Error("El nombre es obligatorio");
  const phone = (input.phone ?? "").trim();

  const ref = await addDoc(contractorsCol(companyId), {
    name,
    phone: phone || null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}
