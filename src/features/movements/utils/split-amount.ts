/**
 * Reparte `total` COP en partes enteras lo más iguales posible (resto en las primeras filas).
 * Ej. 301 / 2 → [151, 150]; 100 / 3 → [34, 33, 33].
 */
export function splitAmountEqually(total: number, parts: number): number[] {
  const n = Math.max(1, Math.floor(parts));
  if (!Number.isFinite(total) || total <= 0) {
    return Array.from({ length: n }, () => 0);
  }
  const base = Math.floor(total / n);
  const rem = total - base * n;
  return Array.from({ length: n }, (_, i) => base + (i < rem ? 1 : 0));
}
