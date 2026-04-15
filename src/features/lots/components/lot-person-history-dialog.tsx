"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Printer } from "lucide-react";
import { useReactToPrint } from "react-to-print";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Movement } from "@/features/movements/models/movement-types";
import {
  formatMovementDay,
  moneyFmt,
  movementDateForAccounting,
} from "@/features/movements/utils/movements-display";
import type { Lot, LotTransfer } from "../models/lot-types";
import {
  buildLotOwnershipSegments,
  filterMovementsForLotAll,
  filterMovementsForLotOwnerSegment,
  type LotOwnershipSegment,
} from "../utils/lot-ownership-segments";
import { LotPersonHistoryPrint } from "./lot-person-history-print";

function formatRangeLabel(seg: LotOwnershipSegment): string {
  const a = new Date(seg.fromSec * 1000).toLocaleDateString("es-CO");
  if (seg.endExclusiveSec == null) {
    return `${a} → actualidad`;
  }
  const b = new Date(seg.endExclusiveSec * 1000).toLocaleDateString("es-CO");
  return `${a} → ${b}`;
}

function kindLabel(kind: Movement["kind"]): string {
  return kind === "income" ? "Ingreso" : "Egreso";
}

const HISTORY_TABLE_PAGE_SIZE = 12;

export type LotPersonHistoryDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyName: string | null;
  projectName: string;
  lot: Lot | null;
  movements: Movement[];
  transfers: LotTransfer[];
};

export function LotPersonHistoryDialog({
  open,
  onOpenChange,
  companyName,
  projectName,
  lot,
  movements,
  transfers,
}: LotPersonHistoryDialogProps) {
  const printRef = useRef<HTMLDivElement>(null);
  const [segmentIndex, setSegmentIndex] = useState(0);
  const [mode, setMode] = useState<"byOwner" | "all">("byOwner");
  const [tablePage, setTablePage] = useState(1);

  const segments = useMemo(
    () => (lot ? buildLotOwnershipSegments(lot, transfers) : []),
    [lot, transfers],
  );

  useEffect(() => {
    if (open && lot) {
      setSegmentIndex(0);
      setMode(segments.length > 0 ? "byOwner" : "all");
    }
  }, [open, lot, segments.length]);

  const activeSegment = segments[segmentIndex] ?? null;

  const filtered = useMemo(() => {
    if (!lot) return [];
    if (mode === "all" || segments.length === 0) {
      return filterMovementsForLotAll(movements, lot.lotNumber);
    }
    if (!activeSegment) return [];
    return filterMovementsForLotOwnerSegment(
      movements,
      lot.lotNumber,
      activeSegment.ownerId,
      activeSegment.fromSec,
      activeSegment.endExclusiveSec,
    );
  }, [lot, movements, mode, segments.length, activeSegment]);

  useEffect(() => {
    setTablePage(1);
  }, [open, lot?.id, mode, segmentIndex]);

  const historyTotalPages = Math.max(1, Math.ceil(filtered.length / HISTORY_TABLE_PAGE_SIZE));
  const historyPageSafe = Math.min(Math.max(1, tablePage), historyTotalPages);

  useEffect(() => {
    setTablePage((p) => Math.min(Math.max(1, p), historyTotalPages));
  }, [historyTotalPages]);

  const pagedForTable = useMemo(() => {
    const start = (historyPageSafe - 1) * HISTORY_TABLE_PAGE_SIZE;
    return filtered.slice(start, start + HISTORY_TABLE_PAGE_SIZE);
  }, [filtered, historyPageSafe]);

  const printHeadline = useMemo(() => {
    if (!lot) return "";
    if (mode === "all" || segments.length === 0) {
      return "Todos los movimientos imputados al lote (varias personas posibles)";
    }
    if (!activeSegment) return "";
    const name = activeSegment.ownerName?.trim() || activeSegment.ownerId;
    return `${name} — periodo de titularidad`;
  }, [lot, mode, segments.length, activeSegment]);

  const printSubtitle = useMemo(() => {
    if (!lot) return null;
    if (mode === "all" || segments.length === 0) {
      return "Sin filtro por titular: incluye cualquier persona registrada en el movimiento.";
    }
    if (!activeSegment) return null;
    return formatRangeLabel(activeSegment);
  }, [lot, mode, segments.length, activeSegment]);

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: lot ? `Historial-lote-${lot.lotNumber}` : "Historial-lote",
    pageStyle: `@page { size: A4 portrait; margin: 12mm; }`,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[min(92vh,920px)] w-[min(1200px,calc(100vw-1.5rem))] max-w-[min(1200px,calc(100vw-1.5rem))] flex-col gap-0 overflow-hidden p-0 print:hidden sm:max-w-[min(1200px,calc(100vw-1.5rem))]">
        <div className="shrink-0 space-y-1.5 border-b border-border/70 px-5 pb-4 pt-5 pr-12">
          <DialogTitle className="text-lg">Historial del lote</DialogTitle>
          <DialogDescription className="text-[0.8125rem] leading-relaxed">
            Ingresos y egresos imputados al número de lote, acotados al periodo en que esa persona fue titular (tras
            una cesión, el anterior solo ve su ventana). Los egresos muestran en concepto a quién corresponde el pago.
          </DialogDescription>
        </div>

        {lot ? (
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden px-5 pb-5 pt-4">
            <p className="text-sm text-muted-foreground">
              Lote <span className="font-mono font-medium tabular-nums text-foreground">{lot.lotNumber}</span>
            </p>

            {segments.length > 0 ? (
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <div className="min-w-0 flex-1 space-y-2">
                  <Label>Vista</Label>
                  <Select
                    value={mode}
                    items={[
                      { value: "byOwner", label: "Por titular y periodo" },
                      { value: "all", label: "Todos los movimientos del lote" },
                    ]}
                    onValueChange={(v) => setMode(v as "byOwner" | "all")}
                    modal={false}
                  >
                    <SelectTrigger className="h-10 w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="byOwner">Por titular y periodo</SelectItem>
                      <SelectItem value="all">Todos los movimientos del lote</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {mode === "byOwner" ? (
                  <div className="min-w-0 flex-1 space-y-2">
                    <Label>Titular y periodo</Label>
                    <Select
                      value={String(segmentIndex)}
                      items={segments.map((seg, i) => ({
                        value: String(i),
                        label: (seg.ownerName?.trim() || seg.ownerId) + " · " + formatRangeLabel(seg),
                      }))}
                      onValueChange={(v) => setSegmentIndex(Number.parseInt(v ?? "0", 10))}
                      modal={false}
                    >
                      <SelectTrigger className="h-10 w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {segments.map((seg, i) => (
                          <SelectItem key={`${seg.ownerId}-${seg.fromSec}-${i}`} value={String(i)}>
                            {(seg.ownerName?.trim() || seg.ownerId) + " · " + formatRangeLabel(seg)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : null}
              </div>
            ) : (
              <p className="rounded-md border border-border/80 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                Este lote no tiene titular en el sistema: se muestran todos los movimientos imputados al número de
                lote. Asigna un titular para poder filtrar por persona y periodo.
              </p>
            )}

            <div className="flex shrink-0 justify-end border-t border-border/70 pt-1">
              <Button type="button" variant="outline" size="sm" className="gap-2" onClick={() => handlePrint()}>
                <Printer className="size-4" />
                Imprimir PDF / papel (lista completa)
              </Button>
            </div>

            <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
              <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden rounded-lg border border-border/70">
                <Table className="table-fixed w-full min-w-0 text-sm">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-26 shrink-0">Fecha</TableHead>
                      <TableHead className="w-22">Tipo</TableHead>
                      <TableHead className="min-w-0">Concepto</TableHead>
                      <TableHead className="min-w-0 w-[28%]">Persona</TableHead>
                      <TableHead className="w-30 text-right">Monto</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground">
                          Sin movimientos en esta selección.
                        </TableCell>
                      </TableRow>
                    ) : (
                      pagedForTable.map((m) => {
                        const ts = movementDateForAccounting(m);
                        return (
                          <TableRow key={m.id}>
                            <TableCell className="whitespace-nowrap align-top tabular-nums">
                              {formatMovementDay(ts)}
                            </TableCell>
                            <TableCell className="align-top">{kindLabel(m.kind)}</TableCell>
                            <TableCell className="min-w-0 wrap-break-word align-top text-[0.8125rem] leading-snug">
                              {m.concept || "—"}
                            </TableCell>
                            <TableCell className="min-w-0 wrap-break-word align-top text-[0.8125rem] leading-snug">
                              {m.personName?.trim() || m.personId || "—"}
                            </TableCell>
                            <TableCell className="whitespace-nowrap text-right align-top tabular-nums">
                              {moneyFmt.format(m.amount)}
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>

              {filtered.length > 0 ? (
                <div className="flex shrink-0 flex-col gap-2 border-t border-border/70 pt-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs text-muted-foreground sm:text-sm">
                    Mostrando{" "}
                    <span className="font-medium text-foreground tabular-nums">
                      {(historyPageSafe - 1) * HISTORY_TABLE_PAGE_SIZE + 1}
                    </span>
                    –
                    <span className="font-medium text-foreground tabular-nums">
                      {Math.min(historyPageSafe * HISTORY_TABLE_PAGE_SIZE, filtered.length)}
                    </span>{" "}
                    de <span className="tabular-nums">{filtered.length}</span> · Página {historyPageSafe} de{" "}
                    {historyTotalPages}
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-1"
                      disabled={historyPageSafe <= 1}
                      onClick={() => setTablePage((p) => Math.max(1, p - 1))}
                    >
                      <ChevronLeft className="size-4" />
                      Anterior
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-1"
                      disabled={historyPageSafe >= historyTotalPages}
                      onClick={() => setTablePage((p) => Math.min(historyTotalPages, p + 1))}
                    >
                      Siguiente
                      <ChevronRight className="size-4" />
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

        {/* Contenido para impresión: fuera de vista pero con layout real para react-to-print */}
        <div className="pointer-events-none fixed top-0 -left-[9999px] z-[-1] w-[190mm] bg-white p-4 text-black">
          <div ref={printRef}>
            {lot ? (
              <LotPersonHistoryPrint
                companyName={companyName}
                projectName={projectName}
                lotNumber={lot.lotNumber}
                headline={printHeadline}
                subtitle={printSubtitle}
                movements={filtered}
              />
            ) : null}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
