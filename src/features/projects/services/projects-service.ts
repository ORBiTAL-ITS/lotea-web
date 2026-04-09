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
import type { Project, ProjectStatus } from "../models/project-types";

function projectsCol(companyId: string) {
  return collection(db, "companies", companyId, "projects");
}

function slugify(input: string) {
  return input
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export type CreateProjectInput = {
  name: string;
  code?: string;
  status: ProjectStatus;
  lotCount?: number;
};

export type UpdateProjectInput = {
  name?: string;
  lotCount?: number;
  status?: ProjectStatus;
};

export async function createProject(companyId: string, input: CreateProjectInput) {
  const name = input.name.trim();
  if (!name) throw new Error("El nombre es obligatorio");
  const code = input.code?.trim() ? slugify(input.code) : slugify(name);
  if (!code) throw new Error("Código inválido");

  const lotCount =
    typeof input.lotCount === "number" && Number.isFinite(input.lotCount) && input.lotCount >= 0
      ? Math.floor(input.lotCount)
      : 0;

  await addDoc(projectsCol(companyId), {
    name,
    code,
    status: input.status,
    lotCount,
    createdAt: serverTimestamp(),
  });
}

export async function updateProject(
  companyId: string,
  projectId: string,
  input: UpdateProjectInput,
): Promise<void> {
  const patch: Record<string, unknown> = {};

  if (input.name !== undefined) {
    const name = input.name.trim();
    if (!name) throw new Error("El nombre es obligatorio");
    patch.name = name;
  }

  if (input.lotCount !== undefined) {
    if (!Number.isFinite(input.lotCount) || input.lotCount < 0) {
      throw new Error("La cantidad de lotes debe ser un número ≥ 0");
    }
    patch.lotCount = Math.floor(input.lotCount);
  }

  if (input.status !== undefined) {
    patch.status = input.status;
  }

  if (Object.keys(patch).length === 0) return;

  await updateDoc(doc(db, "companies", companyId, "projects", projectId), patch);
}

export async function fetchProjects(companyId: string): Promise<Project[]> {
  const q = query(projectsCol(companyId), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const data = d.data();
    const rawLots = data.lotCount;
    const lotCount =
      typeof rawLots === "number" && Number.isFinite(rawLots) && rawLots >= 0
        ? Math.floor(rawLots)
        : 0;

    return {
      id: d.id,
      name: String(data.name ?? ""),
      code: String(data.code ?? ""),
      status: (data.status === "closed" ? "closed" : "active") as ProjectStatus,
      lotCount,
      createdAt: data.createdAt ?? null,
    };
  });
}

export async function countProjects(companyId: string): Promise<number> {
  const snap = await getDocs(projectsCol(companyId));
  return snap.size;
}
