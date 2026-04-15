import type { Movement } from "@/features/movements/models/movement-types";
import { movementDateForAccounting } from "@/features/movements/utils/movements-display";
import type { Lot, LotTransfer } from "../models/lot-types";

export type LotOwnershipSegment = {
  ownerId: string;
  ownerName: string | null;
  fromSec: number;
  /** Fin exclusivo: el instante del traspaso abre el periodo del siguiente titular. null = titularidad actual. */
  endExclusiveSec: number | null;
};

function movementSeconds(m: Movement): number {
  const t = movementDateForAccounting(m);
  return t?.seconds ?? 0;
}

/**
 * Periodos de titularidad a partir del lote y cesiones.
 * Tras una cesión, cada titular solo “ve” movimientos en su ventana temporal con su `personId`.
 */
export function buildLotOwnershipSegments(lot: Lot, transfers: readonly LotTransfer[]): LotOwnershipSegment[] {
  const lotN = lot.lotNumber;
  const forLot = transfers
    .filter((t) => t.lotNumber === lotN)
    .sort((a, b) => (a.transferDate?.seconds ?? 0) - (b.transferDate?.seconds ?? 0));

  if (forLot.length === 0) {
    const id = lot.currentOwnerId?.trim();
    if (!id) return [];
    const fromSec = lot.assignedAt?.seconds ?? 0;
    return [
      {
        ownerId: id,
        ownerName: lot.currentOwnerName,
        fromSec,
        endExclusiveSec: null,
      },
    ];
  }

  const out: LotOwnershipSegment[] = [];
  const t0 = forLot[0]!;
  const startFirst = lot.assignedAt?.seconds ?? t0.transferDate?.seconds ?? 0;
  const t0sec = t0.transferDate?.seconds ?? startFirst;
  out.push({
    ownerId: t0.fromOwnerId,
    ownerName: null,
    fromSec: startFirst,
    endExclusiveSec: t0sec,
  });
  for (let i = 0; i < forLot.length; i++) {
    const t = forLot[i]!;
    const next = forLot[i + 1];
    const tsec = t.transferDate?.seconds ?? 0;
    const nextSec = next?.transferDate?.seconds ?? null;
    out.push({
      ownerId: t.toOwnerId,
      ownerName: t.toOwnerName?.trim() ? t.toOwnerName.trim() : null,
      fromSec: tsec,
      endExclusiveSec: nextSec,
    });
  }
  const last = out[out.length - 1];
  if (last && lot.currentOwnerId?.trim() === last.ownerId) {
    last.ownerName = lot.currentOwnerName?.trim() ? lot.currentOwnerName.trim() : last.ownerName;
  }
  return out;
}

/** Ingresos y egresos imputados al lote, en la ventana del titular y con su `personId`. */
export function filterMovementsForLotOwnerSegment(
  movements: readonly Movement[],
  lotNumber: number,
  ownerId: string,
  fromSec: number,
  endExclusiveSec: number | null,
): Movement[] {
  const id = ownerId.trim();
  return movements
    .filter((m) => {
      if (m.status === "deleted") return false;
      if (!m.linkedToLot || m.lotNumber !== lotNumber) return false;
      const ts = movementSeconds(m);
      if (ts < fromSec) return false;
      if (endExclusiveSec != null && ts >= endExclusiveSec) return false;
      if (m.personId?.trim() !== id) return false;
      return true;
    })
    .sort((a, b) => movementSeconds(a) - movementSeconds(b));
}

/** Sin titular en lote: todos los movimientos imputados al número de lote. */
export function filterMovementsForLotAll(movements: readonly Movement[], lotNumber: number): Movement[] {
  return movements
    .filter((m) => m.status !== "deleted" && m.linkedToLot && m.lotNumber === lotNumber)
    .sort((a, b) => movementSeconds(a) - movementSeconds(b));
}
