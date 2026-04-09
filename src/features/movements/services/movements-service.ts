import {
  Timestamp,
  collection,
  deleteDoc,
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
} from "firebase/firestore";
import { db } from "@/shared/firebase/firebase-client";
import type { Movement, MovementKind, MovementTimestamp } from "../models/movement-types";

function movementsCol(companyId: string, projectId: string) {
  return collection(db, "companies", companyId, "projects", projectId, "movements");
}

function invoiceCountersRef(companyId: string, projectId: string) {
  return doc(
    db,
    "companies",
    companyId,
    "projects",
    projectId,
    "invoiceCounters",
    "default",
  );
}

export type CreateMovementInput = {
  concept: string;
  amount: number;
  kind: MovementKind;
  /** Fecha del movimiento (contable); se guarda a mediodía local del día para evitar desfaces TZ. */
  movementDate: Date;
  /** Para validar lote cuando `linkedToLot` es true en un ingreso. */
  projectLotCount: number;
  /** Ingreso o egreso: si true, `lotNumber` obligatorio (1..projectLotCount). */
  linkedToLot?: boolean;
  lotNumber?: number | null;
  /** Ingreso con lote: valor de referencia del lote (opcional). */
  lotValue?: number | null;
};

function readTimestamp(raw: unknown): MovementTimestamp {
  if (raw == null) return null;
  if (raw instanceof Timestamp) {
    const s = Number(raw.seconds);
    if (!Number.isFinite(s)) return null;
    const n = Number(raw.nanoseconds);
    return { seconds: s, nanoseconds: Number.isFinite(n) ? n : 0 };
  }
  if (typeof raw === "object" && raw !== null && "seconds" in raw) {
    const s = Number((raw as { seconds: unknown }).seconds);
    const n = (raw as { nanoseconds?: unknown }).nanoseconds;
    if (Number.isFinite(s)) {
      const nn = Number(n);
      return {
        seconds: s,
        nanoseconds: Number.isFinite(nn) ? nn : 0,
      };
    }
  }
  return null;
}

function mapMovementDoc(id: string, data: Record<string, unknown>): Movement {
  const raw = data.amount;
  const amount =
    typeof raw === "number" && Number.isFinite(raw) && raw >= 0 ? raw : 0;
  const kind: MovementKind = data.kind === "expense" ? "expense" : "income";

  const rawLot = data.lotNumber;
  const rawLinked = data.linkedToLot;

  let linkedToLot = false;
  let lotNumber: number | null = null;

  if (kind === "income") {
    if (rawLinked === true) {
      linkedToLot = true;
      if (
        typeof rawLot === "number" &&
        Number.isInteger(rawLot) &&
        rawLot >= 1
      ) {
        lotNumber = rawLot;
      }
    } else if (rawLinked === false) {
      linkedToLot = false;
      lotNumber = null;
    } else {
      if (
        typeof rawLot === "number" &&
        Number.isInteger(rawLot) &&
        rawLot >= 1
      ) {
        linkedToLot = true;
        lotNumber = rawLot;
      } else {
        linkedToLot = false;
        lotNumber = null;
      }
    }
  } else {
    if (rawLinked === true) {
      linkedToLot = true;
      if (
        typeof rawLot === "number" &&
        Number.isInteger(rawLot) &&
        rawLot >= 1
      ) {
        lotNumber = rawLot;
      }
    } else if (rawLinked === false) {
      linkedToLot = false;
      lotNumber = null;
    } else {
      if (
        typeof rawLot === "number" &&
        Number.isInteger(rawLot) &&
        rawLot >= 1
      ) {
        linkedToLot = true;
        lotNumber = rawLot;
      } else {
        linkedToLot = false;
        lotNumber = null;
      }
    }
  }

  const createdAt = readTimestamp(data.createdAt);
  const movementDate = readTimestamp(data.movementDate) ?? createdAt;

  const rawInv = data.invoiceNumber;
  const invoiceNumber =
    typeof rawInv === "number" && Number.isInteger(rawInv) && rawInv >= 1 ? rawInv : null;

  const rawLotValue = data.lotValue;
  let lotValue: number | null = null;
  if (kind === "income" && linkedToLot) {
    if (
      typeof rawLotValue === "number" &&
      Number.isFinite(rawLotValue) &&
      rawLotValue > 0
    ) {
      lotValue = rawLotValue;
    }
  }

  return {
    id,
    concept: String(data.concept ?? ""),
    amount,
    kind,
    linkedToLot,
    lotNumber,
    lotValue,
    invoiceNumber,
    movementDate,
    createdAt,
  };
}

function effectiveSeconds(m: Movement): number {
  return m.movementDate?.seconds ?? m.createdAt?.seconds ?? 0;
}

function sortMovementsChronoAsc(a: Movement, b: Movement): number {
  const sa = a.createdAt?.seconds ?? a.movementDate?.seconds ?? 0;
  const sb = b.createdAt?.seconds ?? b.movementDate?.seconds ?? 0;
  if (sa !== sb) return sa - sb;
  return a.id.localeCompare(b.id);
}

/**
 * Asigna `invoiceNumber` a movimientos que no lo tienen, ordenados por fecha de creación,
 * y sincroniza `invoiceCounters/default` para que los nuevos movimientos no dupliquen números.
 */
export async function backfillProjectInvoiceNumbers(
  companyId: string,
  projectId: string,
): Promise<{ assigned: number; incomeLast: number; expenseLast: number }> {
  const q = query(movementsCol(companyId, projectId), orderBy("createdAt", "asc"));
  const snap = await getDocs(q);
  const list = snap.docs.map((d) => mapMovementDoc(d.id, d.data()));
  const incomeSorted = list.filter((m) => m.kind === "income").sort(sortMovementsChronoAsc);
  const expenseSorted = list.filter((m) => m.kind === "expense").sort(sortMovementsChronoAsc);

  let incomeSeq = Math.max(
    0,
    ...incomeSorted.map((m) => (m.invoiceNumber != null && m.invoiceNumber >= 1 ? m.invoiceNumber : 0)),
  );
  let expenseSeq = Math.max(
    0,
    ...expenseSorted.map((m) => (m.invoiceNumber != null && m.invoiceNumber >= 1 ? m.invoiceNumber : 0)),
  );

  const toUpdate: { id: string; n: number }[] = [];
  for (const m of incomeSorted) {
    if (m.invoiceNumber != null && m.invoiceNumber >= 1) continue;
    incomeSeq += 1;
    toUpdate.push({ id: m.id, n: incomeSeq });
  }
  for (const m of expenseSorted) {
    if (m.invoiceNumber != null && m.invoiceNumber >= 1) continue;
    expenseSeq += 1;
    toUpdate.push({ id: m.id, n: expenseSeq });
  }

  const chunk = 450;
  for (let i = 0; i < toUpdate.length; i += chunk) {
    const batch = writeBatch(db);
    for (const u of toUpdate.slice(i, i + chunk)) {
      batch.update(
        doc(db, "companies", companyId, "projects", projectId, "movements", u.id),
        { invoiceNumber: u.n },
      );
    }
    await batch.commit();
  }

  await setDoc(
    invoiceCountersRef(companyId, projectId),
    { incomeLast: incomeSeq, expenseLast: expenseSeq },
    { merge: true },
  );

  return { assigned: toUpdate.length, incomeLast: incomeSeq, expenseLast: expenseSeq };
}

export async function fetchMovements(companyId: string, projectId: string): Promise<Movement[]> {
  const q = query(movementsCol(companyId, projectId), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  const list = snap.docs.map((d) => mapMovementDoc(d.id, d.data()));
  list.sort((a, b) => effectiveSeconds(b) - effectiveSeconds(a));
  return list;
}

export async function createMovement(
  companyId: string,
  projectId: string,
  input: CreateMovementInput,
): Promise<void> {
  const concept = input.concept.trim();
  if (!concept) throw new Error("El concepto es obligatorio");
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    throw new Error("El monto debe ser mayor que cero");
  }
  if (!(input.movementDate instanceof Date) || Number.isNaN(input.movementDate.getTime())) {
    throw new Error("La fecha del movimiento no es válida.");
  }

  const movementTs = Timestamp.fromDate(input.movementDate);

  const maxLot = Math.max(0, Math.floor(Number(input.projectLotCount) || 0));

  let movementPayload: {
    concept: string;
    amount: number;
    kind: MovementKind;
    linkedToLot: boolean;
    lotNumber: number | null;
    lotValue: number | null;
    movementDate: Timestamp;
  };

  if (input.kind === "expense") {
    const linkedToLot = input.linkedToLot === true;
    let lotNumber: number | null = null;
    if (linkedToLot) {
      if (maxLot < 1) {
        throw new Error(
          "Este proyecto no tiene lotes configurados. Edita el proyecto o desmarca «Asociar a un lote».",
        );
      }
      const ln = input.lotNumber;
      if (ln === undefined || ln === null || !Number.isInteger(ln) || ln < 1 || ln > maxLot) {
        throw new Error(`El número de lote debe ser un entero entre 1 y ${maxLot}.`);
      }
      lotNumber = ln;
    }
    movementPayload = {
      concept,
      amount: input.amount,
      kind: "expense",
      linkedToLot,
      lotNumber: linkedToLot ? lotNumber : null,
      lotValue: null,
      movementDate: movementTs,
    };
  } else {
    const linkedToLot = input.linkedToLot === true;
    let lotNumber: number | null = null;
    let incomeLotValue: number | null = null;

    if (linkedToLot) {
      if (maxLot < 1) {
        throw new Error(
          "Este proyecto no tiene lotes configurados. Edita el proyecto o desmarca «Asociar a un lote».",
        );
      }
      const ln = input.lotNumber;
      if (ln === undefined || ln === null || !Number.isInteger(ln) || ln < 1 || ln > maxLot) {
        throw new Error(`El número de lote debe ser un entero entre 1 y ${maxLot}.`);
      }
      lotNumber = ln;
      const lv = input.lotValue;
      if (lv != null && Number.isFinite(lv) && lv > 0) {
        incomeLotValue = lv;
      }
    }

    movementPayload = {
      concept,
      amount: input.amount,
      kind: "income",
      linkedToLot,
      lotNumber,
      lotValue: linkedToLot ? incomeLotValue : null,
      movementDate: movementTs,
    };
  }

  await runTransaction(db, async (transaction) => {
    const counterRef = invoiceCountersRef(companyId, projectId);
    const cSnap = await transaction.get(counterRef);
    let incomeLast = 0;
    let expenseLast = 0;
    if (cSnap.exists()) {
      const d = cSnap.data() as { incomeLast?: unknown; expenseLast?: unknown };
      if (typeof d.incomeLast === "number" && Number.isFinite(d.incomeLast)) {
        incomeLast = Math.max(0, Math.floor(d.incomeLast));
      }
      if (typeof d.expenseLast === "number" && Number.isFinite(d.expenseLast)) {
        expenseLast = Math.max(0, Math.floor(d.expenseLast));
      }
    }
    const isIncome = movementPayload.kind === "income";
    const nextInvoice = isIncome ? incomeLast + 1 : expenseLast + 1;
    transaction.set(
      counterRef,
      {
        incomeLast: isIncome ? nextInvoice : incomeLast,
        expenseLast: isIncome ? expenseLast : nextInvoice,
      },
      { merge: true },
    );
    const movRef = doc(movementsCol(companyId, projectId));
    transaction.set(movRef, {
      ...movementPayload,
      invoiceNumber: nextInvoice,
      createdAt: serverTimestamp(),
    });
  });
}

export async function updateMovement(
  companyId: string,
  projectId: string,
  movementId: string,
  input: CreateMovementInput,
): Promise<void> {
  const concept = input.concept.trim();
  if (!concept) throw new Error("El concepto es obligatorio");
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    throw new Error("El monto debe ser mayor que cero");
  }
  if (!(input.movementDate instanceof Date) || Number.isNaN(input.movementDate.getTime())) {
    throw new Error("La fecha del movimiento no es válida.");
  }

  const movementTs = Timestamp.fromDate(input.movementDate);
  const maxLot = Math.max(0, Math.floor(Number(input.projectLotCount) || 0));
  const ref = doc(db, "companies", companyId, "projects", projectId, "movements", movementId);
  const existingSnap = await getDoc(ref);
  const existingInv = existingSnap.exists()
    ? (existingSnap.data() as { invoiceNumber?: unknown }).invoiceNumber
    : undefined;
  const preserveInvoice =
    typeof existingInv === "number" && Number.isInteger(existingInv) && existingInv >= 1
      ? existingInv
      : undefined;

  if (input.kind === "expense") {
    const linkedToLot = input.linkedToLot === true;
    let lotNumber: number | null = null;
    if (linkedToLot) {
      if (maxLot < 1) {
        throw new Error(
          "Este proyecto no tiene lotes configurados. Edita el proyecto o desmarca «Asociar a un lote».",
        );
      }
      const ln = input.lotNumber;
      if (ln === undefined || ln === null || !Number.isInteger(ln) || ln < 1 || ln > maxLot) {
        throw new Error(`El número de lote debe ser un entero entre 1 y ${maxLot}.`);
      }
      lotNumber = ln;
    }
    await updateDoc(ref, {
      concept,
      amount: input.amount,
      kind: "expense",
      linkedToLot,
      lotNumber: linkedToLot ? lotNumber : null,
      lotValue: null,
      movementDate: movementTs,
      ...(preserveInvoice !== undefined ? { invoiceNumber: preserveInvoice } : {}),
    });
    return;
  }

  const linkedToLot = input.linkedToLot === true;
  let lotNumber: number | null = null;
  let incomeLotValue: number | null = null;

  if (linkedToLot) {
    if (maxLot < 1) {
      throw new Error(
        "Este proyecto no tiene lotes configurados. Edita el proyecto o desmarca «Asociar a un lote».",
      );
    }
    const ln = input.lotNumber;
    if (ln === undefined || ln === null || !Number.isInteger(ln) || ln < 1 || ln > maxLot) {
      throw new Error(`El número de lote debe ser un entero entre 1 y ${maxLot}.`);
    }
    lotNumber = ln;
    const lv = input.lotValue;
    if (lv != null && Number.isFinite(lv) && lv > 0) {
      incomeLotValue = lv;
    }
  }

  await updateDoc(ref, {
    concept,
    amount: input.amount,
    kind: "income",
    linkedToLot,
    lotNumber,
    lotValue: linkedToLot ? incomeLotValue : null,
    movementDate: movementTs,
    ...(preserveInvoice !== undefined ? { invoiceNumber: preserveInvoice } : {}),
  });
}

export async function deleteMovement(
  companyId: string,
  projectId: string,
  movementId: string,
): Promise<void> {
  await deleteDoc(doc(db, "companies", companyId, "projects", projectId, "movements", movementId));
}
