import type { Movement } from "../models/movement-types";
import { effectiveMovementTimestamp } from "./movements-display";

/**
 * Valor de lote ya registrado en otro ingreso del mismo número de lote (el más reciente por fecha contable).
 */
export function lotValueHintFromProjectIncomes(
  movements: readonly Movement[],
  lotNumber: number,
  options?: { excludeMovementId?: string },
): number | null {
  let best: { seconds: number; value: number } | null = null;
  for (const m of movements) {
    if (m.kind !== "income" || !m.linkedToLot || m.lotNumber !== lotNumber) continue;
    if (options?.excludeMovementId && m.id === options.excludeMovementId) continue;
    if (m.lotValue == null || m.lotValue <= 0) continue;
    const sec = effectiveMovementTimestamp(m)?.seconds ?? 0;
    if (!best || sec >= best.seconds) {
      best = { seconds: sec, value: m.lotValue };
    }
  }
  return best?.value ?? null;
}
