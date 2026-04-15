import type { LotTransfer } from "@/features/lots/models/lot-types";
import type { Movement } from "../models/movement-types";

/**
 * Por cada lote, primer `personId` no vacío encontrado en movimientos imputados a lote
 * (un lote "ocupado" por un cliente en el proyecto).
 */
export function buildLotOwnerMap(movements: readonly Movement[]): Map<number, string> {
  const map = new Map<number, string>();
  for (const m of movements) {
    if (!m.linkedToLot || m.lotNumber == null) continue;
    const pid = m.personId?.trim();
    if (!pid) continue;
    const ln = m.lotNumber;
    if (!map.has(ln)) map.set(ln, pid);
  }
  return map;
}

/** Lotes sin dueño en el mapa (1…lotCount). No incluye lotes ya asignados a otra persona. */
export function freeLotNumbers(lotCount: number, ownerByLot: Map<number, string>): number[] {
  if (lotCount < 1) return [];
  const out: number[] = [];
  for (let n = 1; n <= lotCount; n++) {
    if (!ownerByLot.has(n)) out.push(n);
  }
  return out;
}

/** Lotes donde ya hay al menos un movimiento con esta persona (historial del proyecto). */
export function lotNumbersForPerson(movements: readonly Movement[], personId: string): number[] {
  const id = personId.trim();
  if (!id) return [];
  const s = new Set<number>();
  for (const m of movements) {
    if (!m.linkedToLot || m.lotNumber == null) continue;
    if (m.personId?.trim() === id) s.add(m.lotNumber);
  }
  return [...s].sort((a, b) => a - b);
}

/**
 * Lotes donde esta persona fue cedente en una cesión (ex titular), aunque ya no tenga movimientos
 * recientes con ese lote. Sirve para devoluciones/egresos al ex titular.
 */
export function lotNumbersWherePersonWasFormerOwner(
  transfers: readonly LotTransfer[],
  personId: string,
): number[] {
  const id = personId.trim();
  if (!id) return [];
  const s = new Set<number>();
  for (const t of transfers) {
    if (t.fromOwnerId?.trim() !== id) continue;
    const n = t.lotNumber;
    if (n != null && Number.isInteger(n) && n >= 1) s.add(n);
  }
  return [...s].sort((a, b) => a - b);
}

/**
 * Lotes que la persona puede asociar en movimientos: por historial de movimientos o por haber sido titular
 * y cedido (cesiones del proyecto).
 */
export function lotNumbersAssociableToPerson(
  movements: readonly Movement[],
  transfers: readonly LotTransfer[],
  personId: string,
): number[] {
  const a = new Set<number>();
  for (const n of lotNumbersForPerson(movements, personId)) a.add(n);
  for (const n of lotNumbersWherePersonWasFormerOwner(transfers, personId)) a.add(n);
  return [...a].sort((x, y) => x - y);
}

/** Lote libre (sin dueño registrado) o ya asignado a esta persona. */
export function isLotSelectableForPerson(
  lotNumber: number,
  ownerByLot: Map<number, string>,
  personId: string | null | undefined,
): boolean {
  const owner = ownerByLot.get(lotNumber);
  if (!owner) return true;
  const pid = personId?.trim();
  if (!pid) return false;
  return owner === pid;
}
