import type { Movement, MovementKind, MovementTimestamp } from "../models/movement-types";

/** Misma zona que muestra la consola de Firestore para Colombia (UTC-5). */
const BOGOTA_TZ = "America/Bogota";

export const moneyFmt = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

/** Fecha contable efectiva (movementDate o, en legado, createdAt). */
export function effectiveMovementTimestamp(m: Movement): MovementTimestamp {
  return m.movementDate ?? m.createdAt ?? null;
}

/**
 * Timestamp contable para filtros y tabla: prioriza `movementDate` de Firestore
 * (igual que guardaste el movimiento); si no existe, `.createdAt`.
 */
function finiteSeconds(ts: MovementTimestamp | null | undefined): number | null {
  if (ts == null) return null;
  const s = Number(ts.seconds);
  return Number.isFinite(s) ? s : null;
}

/** Prioriza `movementDate`; `seconds` puede venir como número o string desde Firestore. */
export function movementDateForAccounting(m: Movement): MovementTimestamp {
  const md = finiteSeconds(m.movementDate);
  if (md != null) {
    return {
      seconds: md,
      nanoseconds: Number.isFinite(Number(m.movementDate!.nanoseconds))
        ? Number(m.movementDate!.nanoseconds)
        : 0,
    };
  }
  const ca = finiteSeconds(m.createdAt);
  if (ca != null && m.createdAt != null) {
    return {
      seconds: ca,
      nanoseconds: Number.isFinite(Number(m.createdAt.nanoseconds))
        ? Number(m.createdAt.nanoseconds)
        : 0,
    };
  }
  return null;
}

/** Texto comparable en búsqueda (minúsculas, sin tildes, espacios colapsados). */
function normalizeForSearch(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[\u00A0\u202F]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Valor válido para input type="month" (yyyy-mm, mes 01-12). Basura → "" (sin filtro).
 */
export function normalizeYearMonthInput(ym: string): string {
  const t = ym.trim();
  if (!t) return "";
  const m = /^(\d{4})-(\d{1,2})$/.exec(t);
  if (!m) return "";
  const year = Number.parseInt(m[1], 10);
  const monthNum = Number.parseInt(m[2], 10);
  if (!Number.isFinite(year) || !Number.isFinite(monthNum) || monthNum < 1 || monthNum > 12) {
    return "";
  }
  if (year < 1990 || year > 2120) return "";
  return `${m[1]}-${m[2].padStart(2, "0")}`;
}

/** Fecha civil en Colombia (mismo criterio que `movementDate` en consola). */
function bogotaCalendarYmd(ts: MovementTimestamp): { y: number; m: number; d: number } | null {
  const sec = finiteSeconds(ts);
  if (sec == null) return null;
  const instant = new Date(sec * 1000);
  const raw = new Intl.DateTimeFormat("en-CA", {
    timeZone: BOGOTA_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instant);
  const p = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw.trim());
  if (p) {
    return { y: Number(p[1]), m: Number(p[2]), d: Number(p[3]) };
  }
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: BOGOTA_TZ,
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(instant);
  const y = Number(parts.find((x) => x.type === "year")?.value);
  const mo = Number(parts.find((x) => x.type === "month")?.value);
  const d = Number(parts.find((x) => x.type === "day")?.value);
  if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d)) return null;
  return { y, m: mo, d };
}

/** yyyy-mm alineado al calendario en Colombia (como `movementDate` en consola). */
export function movementCalendarMonthKey(ts: MovementTimestamp): string | null {
  const c = bogotaCalendarYmd(ts);
  if (!c) return null;
  return `${c.y}-${String(c.m).padStart(2, "0")}`;
}

export function movementInCalendarMonth(m: Movement, ym: string): boolean {
  const norm = normalizeYearMonthInput(ym);
  if (!norm || !/^\d{4}-\d{2}$/.test(norm)) return true;
  const key = movementCalendarMonthKey(movementDateForAccounting(m));
  if (key === null) return true;
  return key === norm;
}

/** Variantes de texto para buscar por fecha (día/mes/año en Colombia, sin usar la hora en la UI). */
function movementDateSearchExtras(ts: MovementTimestamp): string {
  const sec = finiteSeconds(ts);
  if (sec == null) return "";
  const instant = new Date(sec * 1000);
  const long = new Intl.DateTimeFormat("es-CO", {
    timeZone: BOGOTA_TZ,
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(instant);
  const shortMonth = new Intl.DateTimeFormat("es-CO", {
    timeZone: BOGOTA_TZ,
    month: "short",
    year: "numeric",
  }).format(instant);
  const key = movementCalendarMonthKey(ts);
  const c = bogotaCalendarYmd(ts);
  if (!c) return `${long} ${shortMonth}`;
  const y = String(c.y);
  const mo = String(c.m).padStart(2, "0");
  const mNum = String(c.m);
  const slashMy = `${mo}/${y}`;
  const slashMMy = `${mNum}/${y}`;
  const ymd = `${String(c.d).padStart(2, "0")}/${mo}/${y}`;
  return [long, shortMonth, key ?? "", slashMy, slashMMy, ymd].filter(Boolean).join(" ");
}

/** Etiqueta de factura: misma numeración por tipo dentro del proyecto (p. ej. I-12, E-3). */
export function formatMovementInvoice(m: { kind: MovementKind; invoiceNumber?: number | null }) {
  const n = m.invoiceNumber;
  if (typeof n !== "number" || !Number.isInteger(n) || n < 1) return "—";
  return m.kind === "income" ? `I-${n}` : `E-${n}`;
}

/**
 * Misma fecha civil que usa el filtro por mes (día/mes/año), sin depender de la hora del timestamp.
 */
export function formatMovementDay(ts: MovementTimestamp) {
  const c = bogotaCalendarYmd(ts);
  if (!c) return "—";
  const anchor = new Date(Date.UTC(c.y, c.m - 1, c.d, 12, 0, 0));
  return new Intl.DateTimeFormat("es-CO", {
    timeZone: "UTC",
    dateStyle: "medium",
  }).format(anchor);
}

/** Alias: misma fecha contable sin hora. */
export function formatMovementDateTime(ts: MovementTimestamp) {
  return formatMovementDay(ts);
}

export type MovementQueryOptions = {
  /** yyyy-mm activo en el filtro de mes: no exige ese token otra vez en el cuadro de búsqueda. */
  activeMonthKey?: string;
};

/** Busca en concepto, id, monto, tipo, fechas y lote. Varios términos = deben aparecer todos (en cualquier orden). */
export function movementMatchesQuery(
  m: Movement,
  rawQuery: string,
  options?: MovementQueryOptions,
): boolean {
  const trimmed = rawQuery.trim();
  if (!trimmed) return true;

  const kindLabel = m.kind === "income" ? "ingreso" : "egreso";
  const contable = movementDateForAccounting(m);
  const regSec = finiteSeconds(m.createdAt);
  const movSec = finiteSeconds(m.movementDate);
  const includeRegistrationDate =
    regSec != null && movSec != null && regSec !== movSec && m.createdAt != null;
  const haystack = normalizeForSearch(
    [
      m.concept,
      m.id,
      String(m.amount),
      moneyFmt.format(m.amount),
      m.kind === "income" && m.lotValue != null && m.lotValue > 0
        ? [String(m.lotValue), moneyFmt.format(m.lotValue)].join(" ")
        : "",
      kindLabel,
      formatMovementDay(contable),
      movementDateSearchExtras(contable),
      formatMovementInvoice(m),
      m.invoiceNumber != null ? String(m.invoiceNumber) : "",
      includeRegistrationDate && m.createdAt
        ? formatMovementDay(m.createdAt)
        : "",
      includeRegistrationDate && m.createdAt
        ? movementDateSearchExtras(m.createdAt)
        : "",
      movementCalendarMonthKey(contable) ?? "",
      m.linkedToLot ? `lote ${m.lotNumber ?? ""}` : "",
      m.linkedToLot ? String(m.lotNumber ?? "") : "",
      !m.linkedToLot ? "general proyecto sin lote" : "",
    ].join(" "),
  );

  let tokens = normalizeForSearch(trimmed)
    .split(/\s+/)
    .filter(Boolean);
  const activeMonth = normalizeYearMonthInput(options?.activeMonthKey ?? "");
  if (activeMonth && /^\d{4}-\d{2}$/.test(activeMonth)) {
    const [y, mo] = activeMonth.split("-");
    const variants = new Set(
      normalizeForSearch(
        [
          activeMonth,
          `${mo}/${y}`,
          `${String(parseInt(mo, 10))}/${y}`,
        ].join(" "),
      )
        .split(/\s+/)
        .filter(Boolean),
    );
    tokens = tokens.filter((t) => !variants.has(t));
  }
  if (tokens.length === 0) return true;
  return tokens.every((t) => haystack.includes(t));
}
