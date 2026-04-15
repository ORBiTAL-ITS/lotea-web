"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, FileSpreadsheet, Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { useAppSelector } from "@/shared/store/hooks";
import { selectSessionUser } from "@/features/session/models/session-selectors";
import { useEffectiveCompanyId, clearStoredCompanyId } from "@/features/session/hooks/use-effective-company-id";
import { CompanyPickerSection } from "@/features/companies/components/company-picker-section";
import { fetchCompanyById } from "@/features/companies/services/companies-service";
import { formatMovementDay, moneyFmt } from "@/features/movements/utils/movements-display";
import {
  fetchCompanyExpenseMovementRows,
  type CompanyExpenseMovementRow,
} from "../services/finance-service";
import { downloadCompanyExpensesXlsx } from "../utils/write-company-expenses-xlsx";

const PAGE_SIZE = 50;

function movementAccountingSec(m: CompanyExpenseMovementRow["movement"]): number {
  return m.movementDate?.seconds ?? m.createdAt?.seconds ?? 0;
}

export function OwnerPortfolioPage() {
  const user = useAppSelector(selectSessionUser);
  const isMaster = user?.globalRole === "master";
  const [tick, setTick] = useState(0);
  const { companyId } = useEffectiveCompanyId(tick);
  const [companyName, setCompanyName] = useState<string | null>(null);
  const [allRows, setAllRows] = useState<CompanyExpenseMovementRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  /** Evita lecturas al entrar: solo tras pulsar Buscar. */
  const [hasFetched, setHasFetched] = useState(false);

  const load = useCallback(async () => {
    if (!companyId) {
      setAllRows([]);
      setCompanyName(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [company, rows] = await Promise.all([
        fetchCompanyById(companyId),
        fetchCompanyExpenseMovementRows(companyId),
      ]);
      setCompanyName(company?.name ?? null);
      setAllRows(rows);
      setHasFetched(true);
    } catch {
      setAllRows([]);
      setError("No se pudo cargar los egresos.");
      setHasFetched(true);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    setHasFetched(false);
    setAllRows([]);
    setCompanyName(null);
    setError(null);
    setPage(1);
    setDateFrom("");
    setDateTo("");
  }, [companyId]);

  useEffect(() => {
    setPage(1);
  }, [dateFrom, dateTo, allRows.length]);

  const hasDateFilter = Boolean(dateFrom.trim() || dateTo.trim());

  const filteredRows = useMemo(() => {
    let list = allRows;
    if (dateFrom.trim()) {
      const d = new Date(`${dateFrom.trim()}T00:00:00`);
      const sec = Math.floor(d.getTime() / 1000);
      if (!Number.isNaN(sec)) {
        list = list.filter((r) => movementAccountingSec(r.movement) >= sec);
      }
    }
    if (dateTo.trim()) {
      const d = new Date(`${dateTo.trim()}T23:59:59`);
      const sec = Math.floor(d.getTime() / 1000);
      if (!Number.isNaN(sec)) {
        list = list.filter((r) => movementAccountingSec(r.movement) <= sec);
      }
    }
    return list;
  }, [allRows, dateFrom, dateTo]);

  const displayRows = useMemo(() => {
    if (hasDateFilter) return filteredRows;
    return filteredRows.slice(0, 100);
  }, [filteredRows, hasDateFilter]);

  const totalPages = Math.max(1, Math.ceil(displayRows.length / PAGE_SIZE));
  const pageSafe = Math.min(Math.max(1, page), totalPages);
  const pagedRows = useMemo(() => {
    const start = (pageSafe - 1) * PAGE_SIZE;
    return displayRows.slice(start, start + PAGE_SIZE);
  }, [displayRows, pageSafe]);

  useEffect(() => {
    setPage((p) => Math.min(Math.max(1, p), totalPages));
  }, [totalPages]);

  async function handleExport() {
    if (exporting) return;
    const toExport = hasDateFilter ? filteredRows : filteredRows.slice(0, 100);
    if (toExport.length === 0) return;
    setExporting(true);
    try {
      await downloadCompanyExpensesXlsx(toExport, companyName);
    } finally {
      setExporting(false);
    }
  }

  const totalAmount = useMemo(
    () => displayRows.reduce((s, r) => s + r.movement.amount, 0),
    [displayRows],
  );

  return (
    <div className="p-6 lg:px-8 lg:py-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="font-heading text-2xl font-semibold tracking-tight">Egresos consolidados</h1>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Todos los egresos de la empresa por proyecto. Pulsa{" "}
              <span className="font-medium text-foreground">Buscar información</span> para consultar Firestore (no se
              carga al entrar). Por defecto se muestran los{" "}
              <span className="font-medium text-foreground">100 más recientes</span>; si filtras por fechas se listan{" "}
              <span className="font-medium text-foreground">todos</span> los que entren en el rango. Registra nuevos
              egresos en <span className="font-medium text-foreground">Egresos</span> (botón +): elige tipo estándar,{" "}
              <span className="font-medium text-foreground">devolución</span> (dueño/cedente + lote opcional) o{" "}
              <span className="font-medium text-foreground">pago a trabajador</span>.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {isMaster && companyId ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  clearStoredCompanyId();
                  setTick((t) => t + 1);
                }}
              >
                Cambiar empresa
              </Button>
            ) : null}
            <Button
              type="button"
              disabled={!hasFetched || displayRows.length === 0 || exporting}
              onClick={() => void handleExport()}
            >
              {exporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileSpreadsheet className="mr-2 h-4 w-4" />}
              Exportar Excel
            </Button>
          </div>
        </div>

        {!companyId ? (
          isMaster ? (
            <CompanyPickerSection revision={tick} onCompanySelected={() => setTick((t) => t + 1)} />
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Egresos consolidados</CardTitle>
                <CardDescription>Necesitas una empresa activa.</CardDescription>
              </CardHeader>
            </Card>
          )
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Listado</CardTitle>
              <CardDescription>
                {hasFetched ? (
                  <>
                    Empresa: {companyName ?? "…"}
                    {!hasDateFilter ? (
                      <>
                        {" "}
                        · Mostrando hasta <span className="tabular-nums">100</span> movimientos más recientes (sin
                        filtro de fechas).
                      </>
                    ) : (
                      <>
                        {" "}
                        · Filtro por fechas: se incluyen todos los egresos en el rango ({displayRows.length} filas).
                      </>
                    )}
                  </>
                ) : (
                  <>Aún no se ha consultado. Pulsa Buscar información para cargar egresos desde Firestore.</>
                )}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end">
                <Button
                  type="button"
                  className="h-10 gap-2 sm:mr-2"
                  disabled={loading || !companyId}
                  onClick={() => void load()}
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="h-4 w-4" />
                  )}
                  Buscar información
                </Button>
                <div className="space-y-2">
                  <Label htmlFor="exp-from">Desde</Label>
                  <Input
                    id="exp-from"
                    type="date"
                    className="h-10 w-full sm:w-auto"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="exp-to">Hasta</Label>
                  <Input
                    id="exp-to"
                    type="date"
                    className="h-10 w-full sm:w-auto"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                  />
                </div>
                <Button type="button" variant="outline" size="sm" className="h-10" onClick={() => {
                  setDateFrom("");
                  setDateTo("");
                }}>
                  Limpiar fechas
                </Button>
              </div>

              {error ? (
                <p className="text-sm text-destructive" role="alert">
                  {error}
                </p>
              ) : null}
              {loading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Cargando egresos…
                </div>
              ) : !hasFetched ? (
                <p className="text-sm text-muted-foreground">
                  Pulsa <span className="font-medium text-foreground">Buscar información</span> para cargar el
                  consolidado (no se consulta al abrir la página).
                </p>
              ) : displayRows.length === 0 ? (
                <p className="text-sm text-muted-foreground">No hay egresos registrados.</p>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">
                    Suma del conjunto mostrado:{" "}
                    <span className="font-semibold text-foreground tabular-nums">{moneyFmt.format(totalAmount)}</span>
                  </p>
                  <div className="overflow-x-auto rounded-lg border border-border/70">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Fecha</TableHead>
                          <TableHead>Proyecto</TableHead>
                          <TableHead>Concepto</TableHead>
                          <TableHead className="text-right">Monto</TableHead>
                          <TableHead>Lote</TableHead>
                          <TableHead>Persona</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pagedRows.map((row) => {
                          const m = row.movement;
                          return (
                            <TableRow key={`${row.projectId}-${m.id}`}>
                              <TableCell className="whitespace-nowrap tabular-nums">
                                {formatMovementDay(m.movementDate ?? m.createdAt ?? null)}
                              </TableCell>
                              <TableCell>
                                <span className="font-medium">{row.projectName}</span>
                                <span className="ml-1 text-xs text-muted-foreground tabular-nums">({row.projectCode})</span>
                              </TableCell>
                              <TableCell className="max-w-xs wrap-break-word text-xs">{m.concept}</TableCell>
                              <TableCell className="text-right tabular-nums font-medium">
                                {moneyFmt.format(m.amount)}
                              </TableCell>
                              <TableCell className="font-mono tabular-nums">
                                {m.linkedToLot && m.lotNumber != null ? m.lotNumber : "—"}
                              </TableCell>
                              <TableCell className="max-w-[10rem] truncate text-xs">
                                {m.personName?.trim() || m.personId || "—"}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>

                  {displayRows.length > PAGE_SIZE ? (
                    <div className="flex flex-col gap-3 border-t border-border/70 pt-4 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-xs text-muted-foreground sm:text-sm">
                        Página {pageSafe} de {totalPages} · {displayRows.length} filas en esta vista
                      </p>
                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={pageSafe <= 1}
                          onClick={() => setPage((p) => Math.max(1, p - 1))}
                        >
                          <ChevronLeft className="mr-1 size-4" />
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
                          <ChevronRight className="ml-1 size-4" />
                        </Button>
                      </div>
                    </div>
                  ) : null}
                </>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
