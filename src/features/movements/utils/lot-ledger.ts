import type { Movement } from "../models/movement-types";

/**
 * Suma ingresos y egresos imputados a un lote (solo movimientos con `linkedToLot` y `lotNumber` coincidentes).
 * `excludeMovementId` excluye un movimiento (p. ej. el que se está editando).
 */
export function lotLedgerForMovements(
  movements: readonly Movement[],
  lotNumber: number,
  options?: { excludeMovementId?: string },
): { incomeTotal: number; expenseTotal: number; available: number } {
  const ex = options?.excludeMovementId;
  let incomeTotal = 0;
  let expenseTotal = 0;
  for (const m of movements) {
    if (ex && m.id === ex) continue;
    if (!m.linkedToLot || m.lotNumber !== lotNumber) continue;
    if (m.kind === "income") incomeTotal += m.amount;
    else expenseTotal += m.amount;
  }
  return {
    incomeTotal,
    expenseTotal,
    available: incomeTotal - expenseTotal,
  };
}

/** Comparación tolerante a decimales en montos COP. */
export function expenseAmountExceedsLotAvailable(amount: number, available: number): boolean {
  return amount > available + 0.5;
}
