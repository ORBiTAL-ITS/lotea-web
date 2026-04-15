"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Loader2, HardHat, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatMovementDay, moneyFmt } from "@/features/movements/utils/movements-display";
import {
  fetchCompanyWorkerPaymentsWithProject,
  type WorkerPaymentWithProject,
} from "@/features/finance/services/finance-service";

const PAGE_SIZE = 50;
const DEFAULT_CAP = 100;

function paymentSec(w: WorkerPaymentWithProject): number {
  return w.paymentDate?.seconds ?? w.createdAt?.seconds ?? 0;
}

type WorkersPaymentsSectionProps = {
  companyId: string;
};

export function WorkersPaymentsSection({ companyId }: WorkersPaymentsSectionProps) {
  const [allRows, setAllRows] = useState<WorkerPaymentWithProject[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [workerFilter, setWorkerFilter] = useState("");
  const [page, setPage] = useState(1);
  const [hasFetched, setHasFetched] = useState(false);

  const load = useCallback(async () => {
    if (!companyId) {
      setAllRows([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const list = await fetchCompanyWorkerPaymentsWithProject(companyId);
      setAllRows(list);
      setHasFetched(true);
    } catch {
      setAllRows([]);
      setError("No se pudo cargar los pagos a trabajadores.");
      setHasFetched(true);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    setHasFetched(false);
    setAllRows([]);
    setError(null);
    setPage(1);
    setDateFrom("");
    setDateTo("");
    setWorkerFilter("");
  }, [companyId]);

  useEffect(() => {
    setPage(1);
  }, [dateFrom, dateTo, workerFilter, allRows.length]);

  const hasDateFilter = Boolean(dateFrom.trim() || dateTo.trim());

  const filteredRows = useMemo(() => {
    let list = allRows;
    const q = workerFilter.trim().toLowerCase();
    if (q) {
      list = list.filter((r) => {
        const name = r.workerName.toLowerCase();
        const phone = (r.workerPhone ?? "").toLowerCase();
        return name.includes(q) || phone.includes(q);
      });
    }
    if (dateFrom.trim()) {
      const d = new Date(`${dateFrom.trim()}T00:00:00`);
      const sec = Math.floor(d.getTime() / 1000);
      if (!Number.isNaN(sec)) {
        list = list.filter((r) => paymentSec(r) >= sec);
      }
    }
    if (dateTo.trim()) {
      const d = new Date(`${dateTo.trim()}T23:59:59`);
      const sec = Math.floor(d.getTime() / 1000);
      if (!Number.isNaN(sec)) {
        list = list.filter((r) => paymentSec(r) <= sec);
      }
    }
    return list;
  }, [allRows, dateFrom, dateTo, workerFilter]);

  const displayRows = useMemo(() => {
    if (hasDateFilter) return filteredRows;
    return filteredRows.slice(0, DEFAULT_CAP);
  }, [filteredRows, hasDateFilter]);

  const totalShownAmount = useMemo(
    () => displayRows.reduce((s, r) => s + r.amount, 0),
    [displayRows],
  );

  const totalPages = Math.max(1, Math.ceil(displayRows.length / PAGE_SIZE));
  const pageSafe = Math.min(Math.max(1, page), totalPages);
  const pagedRows = useMemo(() => {
    const start = (pageSafe - 1) * PAGE_SIZE;
    return displayRows.slice(start, start + PAGE_SIZE);
  }, [displayRows, pageSafe]);

  useEffect(() => {
    setPage((p) => Math.min(Math.max(1, p), totalPages));
  }, [totalPages]);

  return (
    <Card className="border-border/80">
      <CardHeader className="space-y-1">
        <div className="flex items-center gap-2">
          <HardHat className="h-5 w-5 text-muted-foreground" aria-hidden />
          <CardTitle className="text-lg">Trabajadores</CardTitle>
        </div>
        <CardDescription>
          Pagos registrados como egreso a trabajador o contratista (desde el FAB de Egresos). Pulsa{" "}
          <span className="font-medium text-foreground">Buscar</span> para consultar Firestore (no se carga al entrar).
          Sin filtro de fechas se muestran los {DEFAULT_CAP} más recientes; con rango de fechas, todos los que entren
          en el período. Filtra por nombre para ver totales de una persona en las fechas elegidas.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
          <Button
            type="button"
            className="h-10 gap-2"
            disabled={loading}
            onClick={() => void load()}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Search className="h-4 w-4" />
            )}
            Buscar
          </Button>
          <div className="space-y-2 sm:max-w-[11rem]">
            <Label htmlFor="worker-filter">Nombre (opcional)</Label>
            <Input
              id="worker-filter"
              value={workerFilter}
              onChange={(e) => setWorkerFilter(e.target.value)}
              placeholder="Contiene…"
              disabled={loading}
            />
          </div>
          <div className="space-y-2 sm:max-w-[11rem]">
            <Label htmlFor="worker-pay-from">Desde</Label>
            <Input
              id="worker-pay-from"
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              disabled={loading}
            />
          </div>
          <div className="space-y-2 sm:max-w-[11rem]">
            <Label htmlFor="worker-pay-to">Hasta</Label>
            <Input
              id="worker-pay-to"
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              disabled={loading}
            />
          </div>
        </div>

        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}

        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" aria-hidden />
          </div>
        ) : !hasFetched ? (
          <p className="text-sm text-muted-foreground">
            Pulsa <span className="font-medium text-foreground">Buscar</span> para cargar los pagos a trabajadores.
          </p>
        ) : displayRows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No hay pagos a trabajadores registrados
            {workerFilter.trim() || hasDateFilter ? " con los filtros actuales" : ""}.
          </p>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <p className="text-muted-foreground">
                {displayRows.length} registro{displayRows.length === 1 ? "" : "s"}
                {!hasDateFilter && filteredRows.length > DEFAULT_CAP ? (
                  <span className="text-amber-800 dark:text-amber-100/90">
                    {" "}
                    (mostrando los {DEFAULT_CAP} más recientes; usa fechas para ver más antiguos)
                  </span>
                ) : null}
              </p>
              <p className="font-medium tabular-nums text-foreground">
                Suma mostrada: {moneyFmt.format(totalShownAmount)}
              </p>
            </div>

            <div className="overflow-x-auto rounded-lg border border-border/80">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha pago</TableHead>
                    <TableHead>Contratista</TableHead>
                    <TableHead>Teléfono</TableHead>
                    <TableHead>Proyecto</TableHead>
                    <TableHead className="text-right">Monto</TableHead>
                    <TableHead>Concepto</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagedRows.map((r) => (
                    <TableRow key={`${r.projectId}-${r.id}`}>
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        {r.paymentDate
                          ? formatMovementDay(r.paymentDate)
                          : r.createdAt
                            ? formatMovementDay(r.createdAt)
                            : "—"}
                      </TableCell>
                      <TableCell className="font-medium">{r.workerName}</TableCell>
                      <TableCell className="tabular-nums text-muted-foreground">
                        {r.workerPhone?.trim() || "—"}
                      </TableCell>
                      <TableCell>
                        <span className="text-foreground">{r.projectName}</span>{" "}
                        <span className="font-mono text-xs text-muted-foreground">{r.projectCode}</span>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{moneyFmt.format(r.amount)}</TableCell>
                      <TableCell className="max-w-[200px] truncate text-muted-foreground" title={r.concept}>
                        {r.concept || "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {totalPages > 1 ? (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-muted-foreground">
                  Página {pageSafe} de {totalPages}
                </p>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={pageSafe <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Anterior
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={pageSafe >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  >
                    Siguiente
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}
