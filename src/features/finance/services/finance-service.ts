import {
  Timestamp,
  addDoc,
  collection,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  type QueryDocumentSnapshot,
  type DocumentData,
} from "firebase/firestore";
import { db } from "@/shared/firebase/firebase-client";
import { fetchProjects } from "@/features/projects/services/projects-service";
import { isGastosProjectId } from "@/features/projects/constants/gastos-project";
import { createMovement, fetchMovements } from "@/features/movements/services/movements-service";
import type { Project } from "@/features/projects/models/project-types";
import type { Movement } from "@/features/movements/models/movement-types";
import type { MonthlyRefund, OwnerPayment, OwnerPortfolioSummary, WorkerPayment } from "../models/finance-types";

function ownerPaymentsCol(companyId: string, projectId: string) {
  return collection(db, "companies", companyId, "projects", projectId, "ownerPayments");
}

function monthlyRefundsCol(companyId: string, projectId: string) {
  return collection(db, "companies", companyId, "projects", projectId, "monthlyRefunds");
}

function workerPaymentsCol(companyId: string, projectId: string) {
  return collection(db, "companies", companyId, "projects", projectId, "workerPayments");
}

type CreateOwnerPaymentInput = {
  ownerId: string;
  ownerName: string;
  lotNumber?: number | null;
  amount: number;
  concept: string;
  paymentDate: Date;
  projectLotCount: number;
};

type CreateMonthlyRefundInput = {
  cedenteId: string;
  cedenteName: string;
  lotNumber?: number | null;
  amount: number;
  concept: string;
  refundMonth: string;
  refundDate: Date;
  projectLotCount: number;
};

type CreateWorkerPaymentInput = {
  workerName: string;
  contractorId?: string;
  workerPhone?: string | null;
  amount: number;
  concept: string;
  paymentDate: Date;
  projectLotCount: number;
};

function parseTs(raw: unknown): { seconds: number; nanoseconds: number } | null {
  if (!raw) return null;
  if (raw instanceof Timestamp) return { seconds: raw.seconds, nanoseconds: raw.nanoseconds };
  if (typeof raw === "object" && raw !== null && "seconds" in raw) {
    const v = raw as { seconds: unknown; nanoseconds?: unknown };
    const sec = Number(v.seconds);
    const n = Number(v.nanoseconds ?? 0);
    if (Number.isFinite(sec)) return { seconds: sec, nanoseconds: Number.isFinite(n) ? n : 0 };
  }
  return null;
}

function mapMonthlyRefundDoc(d: QueryDocumentSnapshot<DocumentData>): MonthlyRefund {
  const data = d.data();
  return {
    id: d.id,
    cedenteId: String(data.cedenteId ?? ""),
    cedenteName: String(data.cedenteName ?? ""),
    lotNumber: typeof data.lotNumber === "number" && Number.isInteger(data.lotNumber) ? data.lotNumber : null,
    amount: typeof data.amount === "number" && Number.isFinite(data.amount) ? data.amount : 0,
    concept: typeof data.concept === "string" ? data.concept : "",
    refundMonth: String(data.refundMonth ?? ""),
    refundDate: parseTs(data.refundDate),
    createdAt: parseTs(data.createdAt),
  };
}

function mapOwnerPaymentDoc(d: QueryDocumentSnapshot<DocumentData>): OwnerPayment {
  const data = d.data();
  return {
    id: d.id,
    ownerId: String(data.ownerId ?? ""),
    ownerName: String(data.ownerName ?? ""),
    lotNumber: typeof data.lotNumber === "number" && Number.isInteger(data.lotNumber) ? data.lotNumber : null,
    amount: typeof data.amount === "number" && Number.isFinite(data.amount) ? data.amount : 0,
    concept: typeof data.concept === "string" ? data.concept : "",
    paymentDate: parseTs(data.paymentDate),
    createdAt: parseTs(data.createdAt),
  };
}

function mapWorkerPaymentDoc(d: QueryDocumentSnapshot<DocumentData>): WorkerPayment {
  const data = d.data();
  return {
    id: d.id,
    workerName: String(data.workerName ?? ""),
    contractorId:
      typeof data.contractorId === "string" && data.contractorId.trim() ? data.contractorId.trim() : undefined,
    workerPhone:
      typeof data.workerPhone === "string" && data.workerPhone.trim() ? data.workerPhone.trim() : undefined,
    amount: typeof data.amount === "number" && Number.isFinite(data.amount) ? data.amount : 0,
    concept: typeof data.concept === "string" ? data.concept : "",
    paymentDate: parseTs(data.paymentDate),
    createdAt: parseTs(data.createdAt),
  };
}

export async function createOwnerPayment(
  companyId: string,
  projectId: string,
  input: CreateOwnerPaymentInput,
): Promise<void> {
  await addDoc(ownerPaymentsCol(companyId, projectId), {
    ownerId: input.ownerId.trim(),
    ownerName: input.ownerName.trim(),
    lotNumber: input.lotNumber ?? null,
    amount: input.amount,
    concept: input.concept.trim(),
    paymentDate: Timestamp.fromDate(input.paymentDate),
    createdAt: serverTimestamp(),
    status: "active",
  });

  await createMovement(companyId, projectId, {
    concept: input.concept.trim(),
    amount: input.amount,
    kind: "income",
    movementDate: input.paymentDate,
    projectLotCount: input.projectLotCount,
    linkedToLot: input.lotNumber != null,
    lotNumber: input.lotNumber ?? null,
    personId: input.ownerId.trim(),
    personName: input.ownerName.trim(),
  });
}

export async function createMonthlyRefund(
  companyId: string,
  projectId: string,
  input: CreateMonthlyRefundInput,
): Promise<void> {
  await addDoc(monthlyRefundsCol(companyId, projectId), {
    cedenteId: input.cedenteId.trim(),
    cedenteName: input.cedenteName.trim(),
    lotNumber: input.lotNumber ?? null,
    amount: input.amount,
    concept: input.concept.trim(),
    refundMonth: input.refundMonth,
    refundDate: Timestamp.fromDate(input.refundDate),
    createdAt: serverTimestamp(),
    status: "active",
  });

  await createMovement(companyId, projectId, {
    concept: `Devolución: ${input.concept.trim()}`,
    amount: input.amount,
    kind: "expense",
    movementDate: input.refundDate,
    projectLotCount: input.projectLotCount,
    linkedToLot: input.lotNumber != null,
    lotNumber: input.lotNumber ?? null,
    personId: input.cedenteId.trim(),
    personName: input.cedenteName.trim(),
  });
}

export async function createWorkerPayment(
  companyId: string,
  projectId: string,
  input: CreateWorkerPaymentInput,
): Promise<void> {
  await addDoc(workerPaymentsCol(companyId, projectId), {
    workerName: input.workerName.trim(),
    ...(input.contractorId?.trim()
      ? { contractorId: input.contractorId.trim() }
      : {}),
    ...(input.workerPhone?.trim()
      ? { workerPhone: input.workerPhone.trim() }
      : {}),
    amount: input.amount,
    concept: input.concept.trim(),
    paymentDate: Timestamp.fromDate(input.paymentDate),
    createdAt: serverTimestamp(),
    status: "active",
  });

  await createMovement(companyId, projectId, {
    concept: `Pago trabajador: ${input.concept.trim()}`,
    amount: input.amount,
    kind: "expense",
    movementDate: input.paymentDate,
    projectLotCount: input.projectLotCount,
    linkedToLot: false,
  });
}

export async function fetchProjectMonthlyRefunds(
  companyId: string,
  projectId: string,
): Promise<MonthlyRefund[]> {
  const snap = await getDocs(query(monthlyRefundsCol(companyId, projectId), orderBy("createdAt", "desc")));
  return snap.docs.map(mapMonthlyRefundDoc).filter((r) => r.amount > 0);
}

export async function fetchProjectOwnerPayments(
  companyId: string,
  projectId: string,
): Promise<OwnerPayment[]> {
  const snap = await getDocs(query(ownerPaymentsCol(companyId, projectId), orderBy("createdAt", "desc")));
  return snap.docs.map(mapOwnerPaymentDoc).filter((r) => r.amount > 0);
}

export async function fetchProjectWorkerPayments(
  companyId: string,
  projectId: string,
): Promise<WorkerPayment[]> {
  const snap = await getDocs(query(workerPaymentsCol(companyId, projectId), orderBy("createdAt", "desc")));
  return snap.docs.map(mapWorkerPaymentDoc).filter((r) => r.amount > 0);
}

export async function fetchOwnerPortfolio(companyId: string): Promise<
  Array<{
    ownerId: string;
    ownerName: string;
    lotRefs: string[];
    totalPaid: number;
    totalRefunds: number;
    net: number;
  }>
> {
  const projects = (await fetchProjects(companyId)).filter((p) => !isGastosProjectId(p.id));
  const acc = new Map<string, OwnerPortfolioSummary>();

  for (const project of projects) {
    const movements = await fetchMovements(companyId, project.id);
    for (const m of movements) {
      const ownerId = m.personId?.trim();
      const ownerName = m.personName?.trim();
      if (!ownerId || !ownerName) continue;
      if (!m.linkedToLot || m.lotNumber == null) continue;
      const current =
        acc.get(ownerId) ??
        ({
          ownerId,
          ownerName,
          projects: new Set<string>(),
          lots: new Set<string>(),
          totalPaid: 0,
          totalRefunds: 0,
        } satisfies OwnerPortfolioSummary);
      current.projects.add(project.name);
      current.lots.add(`${project.code}-${m.lotNumber}`);
      if (m.kind === "income") current.totalPaid += m.amount;
      acc.set(ownerId, current);
    }

    const refunds = await fetchProjectMonthlyRefunds(companyId, project.id);
    for (const refund of refunds) {
      const ownerId = refund.cedenteId.trim();
      const ownerName = refund.cedenteName.trim();
      if (!ownerId || !ownerName) continue;
      const current =
        acc.get(ownerId) ??
        ({
          ownerId,
          ownerName,
          projects: new Set<string>(),
          lots: new Set<string>(),
          totalPaid: 0,
          totalRefunds: 0,
        } satisfies OwnerPortfolioSummary);
      if (refund.lotNumber != null) current.lots.add(`${project.code}-${refund.lotNumber}`);
      current.totalRefunds += refund.amount;
      acc.set(ownerId, current);
    }
  }

  return [...acc.values()]
    .map((v) => ({
      ownerId: v.ownerId,
      ownerName: v.ownerName,
      lotRefs: [...v.lots].sort((a, b) => a.localeCompare(b, "es")),
      totalPaid: v.totalPaid,
      totalRefunds: v.totalRefunds,
      net: v.totalPaid - v.totalRefunds,
    }))
    .sort((a, b) => a.ownerName.localeCompare(b.ownerName, "es"));
}

/** Todas las filas de egreso de la empresa (todos los proyectos), más recientes primero. */
export type CompanyExpenseMovementRow = {
  projectId: string;
  projectName: string;
  projectCode: string;
  movement: Movement;
};

export async function fetchCompanyExpenseMovementRows(companyId: string): Promise<CompanyExpenseMovementRow[]> {
  const projects = await fetchProjects(companyId);
  const rows: CompanyExpenseMovementRow[] = [];
  for (const p of projects) {
    const movements = await fetchMovements(companyId, p.id);
    for (const m of movements) {
      if (m.kind !== "expense" || m.status === "deleted") continue;
      rows.push({
        projectId: p.id,
        projectName: p.name,
        projectCode: p.code,
        movement: m,
      });
    }
  }
  rows.sort((a, b) => {
    const sa = a.movement.movementDate?.seconds ?? a.movement.createdAt?.seconds ?? 0;
    const sb = b.movement.movementDate?.seconds ?? b.movement.createdAt?.seconds ?? 0;
    return sb - sa;
  });
  return rows;
}

export type WorkerPaymentWithProject = WorkerPayment & {
  projectId: string;
  projectName: string;
  projectCode: string;
};

export async function fetchCompanyWorkerPaymentsWithProject(companyId: string): Promise<WorkerPaymentWithProject[]> {
  const projects = (await fetchProjects(companyId)).filter((p) => !isGastosProjectId(p.id));
  const out: WorkerPaymentWithProject[] = [];
  for (const p of projects) {
    const list = await fetchProjectWorkerPayments(companyId, p.id);
    for (const w of list) {
      out.push({
        ...w,
        projectId: p.id,
        projectName: p.name,
        projectCode: p.code,
      });
    }
  }
  out.sort((a, b) => (b.paymentDate?.seconds ?? 0) - (a.paymentDate?.seconds ?? 0));
  return out;
}

export function resolveProjectForFinancialExpense(projects: Project[], suggestedProjectId?: string | null): Project {
  if (suggestedProjectId) {
    const byId = projects.find((p) => p.id === suggestedProjectId);
    if (byId) return byId;
  }
  const first = projects.find((p) => !isGastosProjectId(p.id));
  if (!first) throw new Error("No hay proyecto disponible para registrar la operación.");
  return first;
}
