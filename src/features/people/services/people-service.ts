import {
  addDoc,
  collection,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { db } from "@/shared/firebase/firebase-client";
import type { Person } from "../models/person-types";

function peopleCol(companyId: string) {
  return collection(db, "companies", companyId, "people");
}

function mapPerson(id: string, data: Record<string, unknown>): Person {
  return {
    id,
    name: String(data.name ?? "").trim(),
    idNumber: String(data.idNumber ?? "").trim(),
    phone: String(data.phone ?? "").trim(),
    createdAt: data.createdAt as Person["createdAt"],
    updatedAt: data.updatedAt as Person["updatedAt"],
  };
}

export async function fetchPeople(companyId: string): Promise<Person[]> {
  const q = query(peopleCol(companyId), orderBy("name", "asc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => mapPerson(d.id, d.data() as Record<string, unknown>));
}

export type CreatePersonInput = {
  name: string;
  idNumber: string;
  phone: string;
};

export async function createPerson(companyId: string, input: CreatePersonInput): Promise<string> {
  const name = input.name.trim();
  const idNumber = input.idNumber.trim();
  const phone = input.phone.trim();
  if (!name) throw new Error("El nombre es obligatorio");
  if (!idNumber) throw new Error("La cédula es obligatoria");
  if (!phone) throw new Error("El teléfono es obligatorio");

  const ref = await addDoc(peopleCol(companyId), {
    name,
    idNumber,
    phone,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updatePerson(
  companyId: string,
  personId: string,
  input: CreatePersonInput,
): Promise<void> {
  const name = input.name.trim();
  const idNumber = input.idNumber.trim();
  const phone = input.phone.trim();
  if (!name) throw new Error("El nombre es obligatorio");
  if (!idNumber) throw new Error("La cédula es obligatoria");
  if (!phone) throw new Error("El teléfono es obligatorio");

  await updateDoc(doc(db, "companies", companyId, "people", personId), {
    name,
    idNumber,
    phone,
    updatedAt: serverTimestamp(),
  });
}
