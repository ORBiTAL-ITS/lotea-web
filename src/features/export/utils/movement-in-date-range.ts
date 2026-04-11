import type { Movement } from "@/features/movements/models/movement-types";
import { movementAccountingCalendarKey } from "@/features/movements/utils/movements-display";

/** Incluye ambos extremos (`yyyy-mm-dd` contable Bogotá). */
export function movementInDateRangeInclusive(
  m: Movement,
  startYmd: string,
  endYmd: string,
): boolean {
  const k = movementAccountingCalendarKey(m);
  if (k === "0000-00-00") return false;
  return k >= startYmd && k <= endYmd;
}
