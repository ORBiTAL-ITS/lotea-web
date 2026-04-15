import type { Movement } from "@/features/movements/models/movement-types";
import { LOTEA_LOGO_HEIGHT, LOTEA_LOGO_PATH, LOTEA_LOGO_WIDTH } from "@/lib/brand";
import {
  movementDateForAccounting,
  formatMovementDay,
  formatMovementInvoice,
  moneyFmt,
} from "@/features/movements/utils/movements-display";

export type InvoicePrintSheetProps = {
  companyName: string | null;
  projectName: string;
  projectCode: string;
  projectImageUrl?: string | null;
  movement: Movement;
  /** Si el usuario escribe un nombre, tiene prioridad sobre `movement.personName`. */
  personDisplayOverride?: string;
  /** Texto opcional impreso bajo el concepto de firma. */
  delivererCaption?: string;
  receiverCaption?: string;
};

function kindTitle(kind: Movement["kind"]) {
  return kind === "income" ? "Ingreso" : "Egreso";
}

function formatLongDate(m: Movement) {
  const ts = movementDateForAccounting(m);
  if (!ts?.seconds) return "—";
  return new Intl.DateTimeFormat("es-CO", {
    timeZone: "America/Bogota",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(ts.seconds * 1000));
}

export function InvoicePrintSheet({
  companyName,
  projectName,
  projectCode,
  projectImageUrl = null,
  movement,
  personDisplayOverride = "",
  delivererCaption = "",
  receiverCaption = "",
}: InvoicePrintSheetProps) {
  const inv = formatMovementInvoice(movement);
  const personResolved =
    personDisplayOverride.trim() ||
    movement.personName?.trim() ||
    "";
  const kind = kindTitle(movement.kind);
  const lotLine =
    movement.linkedToLot && movement.lotNumber != null
      ? `Lote ${movement.lotNumber}`
      : "Sin imputación a lote específico";

  return (
    <article
      className="invoice-print-sheet box-border flex h-[5.5in] max-h-[5.5in] w-full max-w-[7.5in] flex-col break-inside-avoid rounded-sm border-2 border-zinc-800/85 bg-white px-8 py-6 text-zinc-900 shadow-lg print:h-[5.5in] print:max-h-[5.5in] print:shadow-none print:border-zinc-900"
      aria-label="Comprobante para impresión"
    >
      <header className="shrink-0 border-b-2 border-amber-700/90 pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            {/* eslint-disable-next-line @next/next/no-img-element -- impresión: img evita problemas con optimización */}
            <img
              src={LOTEA_LOGO_PATH}
              alt="Lotea"
              width={LOTEA_LOGO_WIDTH}
              height={LOTEA_LOGO_HEIGHT}
              className="mb-2 h-8 w-auto max-w-[140px] object-contain object-left"
            />
            <p className="font-heading text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
              Comprobante de operación
            </p>
            <p className="mt-0.5 font-heading text-lg font-bold leading-tight tracking-tight text-zinc-900">
              {companyName?.trim() || "Empresa"}
            </p>
            <p className="mt-0.5 text-[11px] text-zinc-600">Comprobante de movimiento</p>
          </div>
          <div className="shrink-0 text-right">
            {projectImageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- impresión: img evita problemas con optimización
              <img
                src={projectImageUrl}
                alt={`Imagen de ${projectName}`}
                className="mb-2 ml-auto h-10 w-auto max-w-[150px] rounded border border-zinc-200 object-contain"
              />
            ) : null}
            <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
              Documento N.º
            </p>
            <p className="font-mono text-2xl font-bold tabular-nums tracking-tight text-zinc-900">{inv}</p>
            <p
              className={
                movement.kind === "income"
                  ? "mt-1 inline-block rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide bg-emerald-100 text-emerald-900"
                  : "mt-1 inline-block rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide bg-rose-100 text-rose-900"
              }
            >
              {kind}
            </p>
          </div>
        </div>
      </header>

      <div className="mt-4 min-h-0 flex-1 space-y-3 text-sm leading-snug">
        <div className="grid grid-cols-[6.5rem_1fr] gap-x-3 gap-y-2 text-[13px]">
          <span className="font-medium text-zinc-500">Proyecto</span>
          <span className="font-medium text-zinc-900">
            {projectName}{" "}
            <span className="font-mono text-zinc-600 tabular-nums">({projectCode})</span>
          </span>

          <span className="font-medium text-zinc-500">Fecha</span>
          <span className="capitalize text-zinc-900">{formatLongDate(movement)}</span>

          <span className="font-medium text-zinc-500">Concepto</span>
          <span className="text-balance text-zinc-900">{movement.concept}</span>

          <span className="font-medium text-zinc-500">Imputación</span>
          <span className="text-zinc-800">{lotLine}</span>

          <span className="font-medium text-zinc-500">Persona</span>
          <span className="text-zinc-800">{personResolved || "—"}</span>

          {movement.kind === "income" &&
          movement.linkedToLot &&
          movement.lotValue != null &&
          movement.lotValue > 0 ? (
            <>
              <span className="font-medium text-zinc-500">Valor del lote</span>
              <span className="tabular-nums font-medium text-zinc-900">
                {moneyFmt.format(movement.lotValue)}
              </span>
            </>
          ) : null}

          <span className="font-medium text-zinc-500">Monto</span>
          <span className="text-lg font-semibold tabular-nums text-zinc-900">
            {moneyFmt.format(movement.amount)}
          </span>
        </div>

        <p className="border-t border-dashed border-zinc-300 pt-2 text-[11px] leading-relaxed text-zinc-500">
          Fecha contable (para control interno): {formatMovementDay(movementDateForAccounting(movement))}.{" "}
          Documento generado desde Lotea; válido como soporte interno según políticas de la empresa.
        </p>
      </div>

      <footer className="mt-auto shrink-0 border-t border-zinc-200 pt-4">
        <div className="grid grid-cols-2 gap-8">
          <div className="text-center">
            <div className="mb-1 min-h-11 border-b border-zinc-800">
              {delivererCaption ? (
                <p className="pb-1 text-xs font-medium text-zinc-800">{delivererCaption}</p>
              ) : null}
            </div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
              Firma quien entrega
            </p>
            <p className="text-[10px] text-zinc-400">Nombre, cargo o razón social</p>
          </div>
          <div className="text-center">
            <div className="mb-1 min-h-11 border-b border-zinc-800">
              {receiverCaption ? (
                <p className="pb-1 text-xs font-medium text-zinc-800">{receiverCaption}</p>
              ) : null}
            </div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
              Firma quien recibe
            </p>
            <p className="text-[10px] text-zinc-400">Nombre, cargo o razón social</p>
          </div>
        </div>
      </footer>
    </article>
  );
}
