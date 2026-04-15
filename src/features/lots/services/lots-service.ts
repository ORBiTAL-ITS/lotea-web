import {
  Timestamp,
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
  type DocumentData,
} from "firebase/firestore";
import { db } from "@/shared/firebase/firebase-client";
import { fetchProjects } from "@/features/projects/services/projects-service";
import { isGastosProjectId } from "@/features/projects/constants/gastos-project";
import { fetchMovements } from "@/features/movements/services/movements-service";
import type { Movement } from "@/features/movements/models/movement-types";
import type { Project } from "@/features/projects/models/project-types";
import { fetchProjectById } from "@/features/projects/services/projects-service";
import type { Lot, LotPaymentSummary, LotStatus, LotTransfer, ProjectLotsAvailability } from "../models/lot-types";

function lotsCol(companyId: string, projectId: string) {
  return collection(db, "companies", companyId, "projects", projectId, "lots");
}

function parseTimestamp(raw: unknown): { seconds: number; nanoseconds: number } | null {
  if (!raw) return null;
  if (raw instanceof Timestamp) {
    return { seconds: Number(raw.seconds), nanoseconds: Number(raw.nanoseconds) };
  }
  if (typeof raw === "object" && raw !== null && "seconds" in raw) {
    const value = raw as { seconds: unknown; nanoseconds?: unknown };
    const seconds = Number(value.seconds);
    const nanos = Number(value.nanoseconds ?? 0);
    if (!Number.isFinite(seconds)) return null;
    return { seconds, nanoseconds: Number.isFinite(nanos) ? nanos : 0 };
  }
  return null;
}

function mapLotDoc(id: string, data: DocumentData): Lot {
  const rawStatus = String(data.status ?? "available");
  const status: LotStatus =
    rawStatus === "sold" || rawStatus === "reserved" || rawStatus === "returned"
      ? rawStatus
      : "available";
  return {
    id,
    lotNumber:
      typeof data.lotNumber === "number" && Number.isInteger(data.lotNumber) && data.lotNumber >= 1
        ? data.lotNumber
        : 0,
    status,
    currentOwnerId:
      typeof data.currentOwnerId === "string" && data.currentOwnerId.trim().length > 0
        ? data.currentOwnerId.trim()
        : null,
    currentOwnerName:
      typeof data.currentOwnerName === "string" && data.currentOwnerName.trim().length > 0
        ? data.currentOwnerName.trim()
        : null,
    assignedAt: parseTimestamp(data.assignedAt),
    declaredLotValue:
      typeof data.declaredLotValue === "number" && Number.isFinite(data.declaredLotValue)
        ? data.declaredLotValue
        : null,
    createdAt: parseTimestamp(data.createdAt),
    updatedAt: parseTimestamp(data.updatedAt),
  };
}

function lotTransfersCol(companyId: string, projectId: string) {
  return collection(db, "companies", companyId, "projects", projectId, "lotTransfers");
}

function lotOwnershipHistoryCol(companyId: string, projectId: string) {
  return collection(db, "companies", companyId, "projects", projectId, "lotOwnershipHistory");
}

function lotReturnsCol(companyId: string, projectId: string) {
  return collection(db, "companies", companyId, "projects", projectId, "lotReturns");
}

export async function ensureProjectLots(companyId: string, project: Project): Promise<void> {
  const desired = Math.max(0, Math.floor(project.lotCount || 0));
  if (desired < 1) return;

  const snap = await getDocs(lotsCol(companyId, project.id));
  const existing = new Set<number>();
  snap.forEach((d) => {
    const lotNumber = Number((d.data() as { lotNumber?: unknown }).lotNumber);
    if (Number.isInteger(lotNumber) && lotNumber >= 1) existing.add(lotNumber);
  });

  const missing: number[] = [];
  for (let n = 1; n <= desired; n += 1) {
    if (!existing.has(n)) missing.push(n);
  }
  if (missing.length === 0) return;

  const batch = writeBatch(db);
  for (const lotNumber of missing) {
    const ref = doc(lotsCol(companyId, project.id), `L${lotNumber}`);
    batch.set(ref, {
      lotNumber,
      status: "available",
      currentOwnerId: null,
      currentOwnerName: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }
  await batch.commit();
}

export async function fetchProjectLots(companyId: string, projectId: string): Promise<Lot[]> {
  const snap = await getDocs(query(lotsCol(companyId, projectId), orderBy("lotNumber", "asc")));
  return snap.docs.map((d) => mapLotDoc(d.id, d.data()));
}

function movementAccountingSeconds(m: Movement): number {
  return m.movementDate?.seconds ?? m.createdAt?.seconds ?? 0;
}

/** Resumen de ingresos por lote: total en el lote vs total imputado al titular actual desde `assignedAt`. */
export function computeLotPaymentSummaries(lots: Lot[], movements: readonly Movement[]): LotPaymentSummary[] {
  const incomes = movements.filter(
    (m) => m.kind === "income" && m.linkedToLot && m.lotNumber != null && Number.isFinite(m.amount),
  );
  return lots
    .map((lot) => {
      const ln = lot.lotNumber;
      let totalPaidOnLot = 0;
      let totalPaidAsCurrentOwner = 0;
      for (const m of incomes) {
        if (m.lotNumber !== ln) continue;
        totalPaidOnLot += m.amount;
        const owner = lot.currentOwnerId?.trim();
        const from = lot.assignedAt?.seconds;
        if (
          owner &&
          from != null &&
          m.personId?.trim() === owner &&
          movementAccountingSeconds(m) >= from
        ) {
          totalPaidAsCurrentOwner += m.amount;
        }
      }
      return { lotNumber: ln, totalPaidOnLot, totalPaidAsCurrentOwner };
    })
    .sort((a, b) => a.lotNumber - b.lotNumber);
}

export function computeProjectLotsAvailability(
  project: Project,
  lots: Lot[],
  movements: readonly Movement[],
): ProjectLotsAvailability {
  const soldByMovement = new Set<number>();
  for (const m of movements) {
    if (m.kind !== "income") continue;
    if (!m.linkedToLot || m.lotNumber == null) continue;
    if (!m.personId?.trim()) continue;
    soldByMovement.add(m.lotNumber);
  }
  const totalLots = Math.max(project.lotCount, lots.length);
  const soldLots = new Set([
    ...lots.filter((l) => l.status === "sold").map((l) => l.lotNumber),
    ...soldByMovement,
  ]).size;
  const reservedLots = lots.filter((l) => l.status === "reserved").length;
  const returnedLots = lots.filter((l) => l.status === "returned").length;
  const availableLots = Math.max(0, totalLots - soldLots - reservedLots);
  return {
    projectId: project.id,
    projectName: project.name,
    projectCode: project.code,
    totalLots,
    availableLots,
    soldLots,
    reservedLots,
    returnedLots,
  };
}

function mapLotTransferDoc(id: string, data: DocumentData): LotTransfer {
  return {
    id,
    lotId: typeof data.lotId === "string" ? data.lotId : null,
    lotNumber:
      typeof data.lotNumber === "number" && Number.isInteger(data.lotNumber) ? data.lotNumber : null,
    fromOwnerId: String(data.fromOwnerId ?? "").trim(),
    toOwnerId: String(data.toOwnerId ?? "").trim(),
    toOwnerName: String(data.toOwnerName ?? "").trim(),
    transferDate: parseTimestamp(data.transferDate),
    notes: typeof data.notes === "string" && data.notes.trim() ? data.notes.trim() : null,
    createdAt: parseTimestamp(data.createdAt),
  };
}

export async function fetchLotTransfers(companyId: string, projectId: string): Promise<LotTransfer[]> {
  try {
    const snap = await getDocs(query(lotTransfersCol(companyId, projectId), orderBy("createdAt", "desc")));
    return snap.docs.map((d) => mapLotTransferDoc(d.id, d.data()));
  } catch {
    const snap = await getDocs(lotTransfersCol(companyId, projectId));
    const list = snap.docs.map((d) => mapLotTransferDoc(d.id, d.data()));
    return list.sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0));
  }
}

/** Carga lotes, movimientos y cesiones solo de un proyecto (evita lecturas masivas). */
export async function fetchProjectLotsDashboard(companyId: string, projectId: string): Promise<{
  project: Project;
  lots: Lot[];
  movements: Movement[];
  availability: ProjectLotsAvailability;
  transfers: LotTransfer[];
  paymentSummaries: LotPaymentSummary[];
}> {
  if (isGastosProjectId(projectId)) {
    throw new Error("Este proyecto no tiene lotes comerciales.");
  }
  const project = await fetchProjectById(companyId, projectId);
  if (!project) {
    throw new Error("Proyecto no encontrado.");
  }
  await ensureProjectLots(companyId, project);
  const [lots, movements, transfers] = await Promise.all([
    fetchProjectLots(companyId, projectId),
    fetchMovements(companyId, projectId),
    fetchLotTransfers(companyId, projectId),
  ]);
  const availability = computeProjectLotsAvailability(project, lots, movements);
  const paymentSummaries = computeLotPaymentSummaries(lots, movements);
  return { project, lots, movements, availability, transfers, paymentSummaries };
}

export async function fetchLotsAvailability(companyId: string): Promise<ProjectLotsAvailability[]> {
  const projects = await fetchProjects(companyId);
  const realProjects = projects.filter((p) => !isGastosProjectId(p.id));

  const out: ProjectLotsAvailability[] = [];
  for (const project of realProjects) {
    await ensureProjectLots(companyId, project);
    const [lots, movements] = await Promise.all([
      fetchProjectLots(companyId, project.id),
      fetchMovements(companyId, project.id),
    ]);
    out.push(computeProjectLotsAvailability(project, lots, movements));
  }
  return out.sort((a, b) => a.projectName.localeCompare(b.projectName, "es"));
}

export async function assignLotOwner(
  companyId: string,
  projectId: string,
  lotId: string,
  owner: { id: string; name: string },
  options?: { declaredLotValue?: number | null },
): Promise<void> {
  const ref = doc(db, "companies", companyId, "projects", projectId, "lots", lotId);
  const now = Timestamp.now();
  const patch: Record<string, unknown> = {
    currentOwnerId: owner.id.trim(),
    currentOwnerName: owner.name.trim(),
    status: "sold",
    assignedAt: now,
    updatedAt: now,
  };
  const v = options?.declaredLotValue;
  if (v != null && Number.isFinite(v) && v > 0) {
    patch.declaredLotValue = v;
  }
  await updateDoc(ref, patch);
  await setDoc(doc(lotOwnershipHistoryCol(companyId, projectId)), {
    lotId,
    ownerId: owner.id.trim(),
    ownerName: owner.name.trim(),
    validFrom: now,
    validTo: null,
    sourceTransferId: null,
    createdAt: serverTimestamp(),
  });
}

export async function transferLotOwner(
  companyId: string,
  projectId: string,
  lotId: string,
  fromOwnerId: string,
  toOwner: { id: string; name: string },
  transferDate: Date,
  notes?: string,
): Promise<void> {
  const ref = doc(db, "companies", companyId, "projects", projectId, "lots", lotId);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error("El lote no existe.");
    const data = snap.data();
    const currentOwnerId =
      typeof data.currentOwnerId === "string" ? data.currentOwnerId.trim() : "";
    if (currentOwnerId !== fromOwnerId.trim()) {
      throw new Error("El cedente no coincide con el dueño actual del lote.");
    }
    const transferRef = doc(lotTransfersCol(companyId, projectId));
    tx.set(transferRef, {
      lotId,
      lotNumber: data.lotNumber ?? null,
      fromOwnerId: fromOwnerId.trim(),
      toOwnerId: toOwner.id.trim(),
      toOwnerName: toOwner.name.trim(),
      transferDate: Timestamp.fromDate(transferDate),
      notes: notes?.trim() ? notes.trim() : null,
      createdAt: serverTimestamp(),
    });
    tx.update(ref, {
      currentOwnerId: toOwner.id.trim(),
      currentOwnerName: toOwner.name.trim(),
      status: "sold",
      assignedAt: Timestamp.fromDate(transferDate),
      updatedAt: serverTimestamp(),
    });
    tx.set(doc(lotOwnershipHistoryCol(companyId, projectId)), {
      lotId,
      ownerId: toOwner.id.trim(),
      ownerName: toOwner.name.trim(),
      validFrom: Timestamp.fromDate(transferDate),
      validTo: null,
      sourceTransferId: transferRef.id,
      createdAt: serverTimestamp(),
    });
  });
}

export async function returnLot(
  companyId: string,
  projectId: string,
  lotId: string,
  refundAmount: number,
  reason: string,
): Promise<void> {
  const ref = doc(db, "companies", companyId, "projects", projectId, "lots", lotId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("El lote no existe.");
  const data = snap.data();
  await setDoc(doc(lotReturnsCol(companyId, projectId)), {
    lotId,
    ownerId: data.currentOwnerId ?? null,
    ownerName: data.currentOwnerName ?? null,
    lotNumber: data.lotNumber ?? null,
    returnDate: serverTimestamp(),
    refundAmount,
    reason: reason.trim(),
    status: "active",
    createdAt: serverTimestamp(),
  });
  await updateDoc(ref, {
    status: "returned",
    currentOwnerId: null,
    currentOwnerName: null,
    updatedAt: serverTimestamp(),
  });
}
