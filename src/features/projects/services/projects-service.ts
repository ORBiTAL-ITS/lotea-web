import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "@/shared/firebase/firebase-client";
import { GASTOS_PROJECT_DOC_ID } from "../constants/gastos-project";
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
  invoiceImageUrl?: string | null;
  invoiceImageData?: string | null;
};

export type UpdateProjectInput = {
  name?: string;
  lotCount?: number;
  status?: ProjectStatus;
  invoiceImageUrl?: string | null;
  invoiceImageData?: string | null;
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

  const embedded =
    typeof input.invoiceImageData === "string" && input.invoiceImageData.startsWith("data:image/")
      ? input.invoiceImageData
      : null;
  const externalUrl = input.invoiceImageUrl?.trim() ? input.invoiceImageUrl.trim() : null;

  await addDoc(projectsCol(companyId), {
    name,
    code,
    status: input.status,
    lotCount,
    invoiceImageData: embedded,
    invoiceImageUrl: embedded ? null : externalUrl,
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

  if (input.invoiceImageUrl !== undefined) {
    const value = input.invoiceImageUrl?.trim();
    patch.invoiceImageUrl = value ? value : null;
  }

  if (input.invoiceImageData !== undefined) {
    const raw = input.invoiceImageData;
    if (raw === null) {
      patch.invoiceImageData = null;
    } else if (typeof raw === "string" && raw.startsWith("data:image/")) {
      patch.invoiceImageData = raw;
    } else {
      patch.invoiceImageData = null;
    }
  }

  if (Object.keys(patch).length === 0) return;

  await updateDoc(doc(db, "companies", companyId, "projects", projectId), patch);
}

function mapProjectDoc(id: string, data: Record<string, unknown>): Project {
  const rawLots = data.lotCount;
  const lotCount =
    typeof rawLots === "number" && Number.isFinite(rawLots) && rawLots >= 0
      ? Math.floor(rawLots)
      : 0;

  return {
    id,
    name: String(data.name ?? ""),
    code: String(data.code ?? ""),
    status: (data.status === "closed" ? "closed" : "active") as ProjectStatus,
    lotCount,
    invoiceImageUrl:
      typeof data.invoiceImageUrl === "string" && data.invoiceImageUrl.trim().length > 0
        ? data.invoiceImageUrl.trim()
        : null,
    invoiceImageData:
      typeof data.invoiceImageData === "string" && data.invoiceImageData.startsWith("data:image/")
        ? data.invoiceImageData
        : null,
    createdAt: (data.createdAt as Project["createdAt"]) ?? null,
  };
}

export async function fetchProjectById(companyId: string, projectId: string): Promise<Project | null> {
  const snap = await getDoc(doc(db, "companies", companyId, "projects", projectId));
  if (!snap.exists()) return null;
  return mapProjectDoc(snap.id, snap.data() as Record<string, unknown>);
}

export async function fetchProjects(companyId: string): Promise<Project[]> {
  const mapSnap = (snap: Awaited<ReturnType<typeof getDocs>>) =>
    snap.docs.map((d) => mapProjectDoc(d.id, d.data() as Record<string, unknown>));

  try {
    const q = query(projectsCol(companyId), orderBy("createdAt", "desc"));
    const snap = await getDocs(q);
    return mapSnap(snap);
  } catch {
    /** Sin índice o datos antiguos sin `createdAt`: lista completa y orden local. */
    const snap = await getDocs(projectsCol(companyId));
    const list = mapSnap(snap);
    return list.sort((a, b) => {
      const sa = a.createdAt?.seconds ?? 0;
      const sb = b.createdAt?.seconds ?? 0;
      if (sa !== sb) return sb - sa;
      return a.name.localeCompare(b.name, "es");
    });
  }
}

/** Espera a que Firebase Auth tenga usuario (p. ej. tras recargar la página). */
function waitForAuthReady(maxMs = 12000): Promise<void> {
  if (auth.currentUser) return Promise.resolve();
  return new Promise((resolve) => {
    const t = setTimeout(() => resolve(), maxMs);
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) {
        clearTimeout(t);
        unsub();
        resolve();
      }
    });
  });
}

async function ensureGastosProjectViaServer(companyId: string): Promise<boolean> {
  await waitForAuthReady();
  const user = auth.currentUser;
  if (!user) return false;
  let token: string;
  try {
    token = await user.getIdToken(true);
  } catch {
    return false;
  }
  try {
    const res = await fetch("/api/company/ensure-gastos", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ companyId }),
    });
    const data = (await res.json().catch(() => ({}))) as { ok?: boolean };
    if (res.ok && data.ok === true) return true;
    return false;
  } catch {
    return false;
  }
}

/**
 * Garantiza el documento interno de «Gasto» (numeración E- aparte).
 * Orden: lectura → API (Admin, ignora reglas de cliente) → setDoc en cliente → reintento API si hace falta.
 */
export async function ensureGastosProject(companyId: string): Promise<Project | null> {
  await waitForAuthReady();

  const ref = doc(db, "companies", companyId, "projects", GASTOS_PROJECT_DOC_ID);

  async function readMapped(): Promise<Project | null> {
    try {
      const s = await getDoc(ref);
      if (!s.exists()) return null;
      return mapProjectDoc(s.id, s.data() as Record<string, unknown>);
    } catch {
      return null;
    }
  }

  let p = await readMapped();
  if (p) return p;

  try {
    await auth.currentUser?.getIdToken(true);
  } catch {
    /* vacío */
  }

  await ensureGastosProjectViaServer(companyId);
  p = await readMapped();
  if (p) return p;

  try {
    await setDoc(ref, {
      name: "Gastos",
      code: "GASTOS",
      status: "active",
      lotCount: 0,
      createdAt: serverTimestamp(),
    });
  } catch {
    await ensureGastosProjectViaServer(companyId);
  }

  return readMapped();
}

export async function countProjects(companyId: string): Promise<number> {
  const snap = await getDocs(projectsCol(companyId));
  return snap.docs.filter((d) => d.id !== GASTOS_PROJECT_DOC_ID).length;
}
