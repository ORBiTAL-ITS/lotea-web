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
