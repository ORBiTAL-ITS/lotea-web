"use client";

import type { Movement } from "@/features/movements/models/movement-types";
import {
  formatMovementDay,
  moneyFmt,
  movementDateForAccounting,
} from "@/features/movements/utils/movements-display";

export type LotPersonHistoryPrintProps = {
  companyName: string | null;
  projectName: string;
  lotNumber: number;
  /** Título del periodo / titular */
  headline: string;
  /** Subtítulo (periodo de titularidad) */
  subtitle: string | null;
  movements: Movement[];
};

function kindLabel(kind: Movement["kind"]): string {
  return kind === "income" ? "Ingreso" : "Egreso";
}

export function LotPersonHistoryPrint({
  companyName,
  projectName,
  lotNumber,
  headline,
  subtitle,
  movements,
}: LotPersonHistoryPrintProps) {
  return (
    <div className="lot-person-history-print text-zinc-900">
      <header className="mb-4 border-b border-zinc-400 pb-3">
        <h1 className="text-lg font-semibold tracking-tight">Historial por lote y titular</h1>
        <p className="mt-1 text-sm text-zinc-600">
          {companyName ?? "Empresa"} · Proyecto: {projectName} · Lote{" "}
          <span className="font-mono tabular-nums">{lotNumber}</span>
        </p>
        <p className="mt-2 text-sm font-medium text-zinc-800">{headline}</p>
        {subtitle ? <p className="text-xs text-zinc-600">{subtitle}</p> : null}
        <p className="mt-2 text-xs text-zinc-500">
          Solo se listan movimientos imputados a este lote con la persona indicada en el registro (ingresos y egresos
          vinculados). En egresos, el concepto describe a quién corresponde el pago o el rubro.
        </p>
      </header>
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-zinc-400 text-left text-xs uppercase tracking-wide text-zinc-600">
            <th className="py-2 pr-2">Fecha</th>
            <th className="py-2 pr-2">Tipo</th>
            <th className="py-2 pr-2">Concepto</th>
            <th className="py-2 pr-2">Persona (registro)</th>
            <th className="py-2 text-right">Monto</th>
          </tr>
        </thead>
        <tbody>
          {movements.length === 0 ? (
            <tr>
              <td colSpan={5} className="py-6 text-center text-zinc-500">
                No hay movimientos en este periodo para esta persona y este lote.
              </td>
            </tr>
          ) : (
            movements.map((m) => {
              const ts = movementDateForAccounting(m);
              return (
                <tr key={m.id} className="border-b border-zinc-200">
                  <td className="py-1.5 pr-2 align-top whitespace-nowrap tabular-nums">{formatMovementDay(ts)}</td>
                  <td className="py-1.5 pr-2 align-top">{kindLabel(m.kind)}</td>
                  <td className="py-1.5 pr-2 align-top">{m.concept || "—"}</td>
                  <td className="py-1.5 pr-2 align-top">{m.personName?.trim() || m.personId || "—"}</td>
                  <td className="py-1.5 text-right align-top font-medium tabular-nums">{moneyFmt.format(m.amount)}</td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
