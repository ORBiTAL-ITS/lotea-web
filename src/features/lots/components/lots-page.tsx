"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeftRight,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  History,
  Loader2,
  Search,
  UserPlus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
import { useAppSelector } from "@/shared/store/hooks";
import { selectSessionUser } from "@/features/session/models/session-selectors";
import { useEffectiveCompanyId, clearStoredCompanyId } from "@/features/session/hooks/use-effective-company-id";
import { CompanyPickerSection } from "@/features/companies/components/company-picker-section";
import { fetchCompanyById } from "@/features/companies/services/companies-service";
import { fetchProjects } from "@/features/projects/services/projects-service";
import { isGastosProjectId } from "@/features/projects/constants/gastos-project";
import type { Project } from "@/features/projects/models/project-types";
import type { Movement } from "@/features/movements/models/movement-types";
import { moneyFmt } from "@/features/movements/utils/movements-display";
import { fetchProjectLotsDashboard } from "../services/lots-service";
import { downloadProjectLotsDetailXlsx } from "../utils/write-project-lots-detail-xlsx";
import type { Lot, LotPaymentSummary, LotTransfer } from "../models/lot-types";
import type { ProjectLotsAvailability } from "../models/lot-types";
import { AssignLotOwnerDialog } from "./assign-lot-owner-dialog";
import { LotPersonHistoryDialog } from "./lot-person-history-dialog";
import { TransferLotOwnerDialog } from "./transfer-lot-owner-dialog";

function lotStatusLabel(status: Lot["status"]): string {
  switch (status) {
    case "available":
      return "Disponible";
    case "reserved":
      return "Reservado";
    case "sold":
      return "Vendido";
    case "returned":
      return "Devuelto";
    default:
      return status;
  }
}

function fmtAssigned(ts: Lot["assignedAt"]): string {
  if (!ts?.seconds) return "—";
  return new Date(ts.seconds * 1000).toLocaleDateString("es-CO");
}

function fmtTransfer(ts: LotTransfer["transferDate"] | LotTransfer["createdAt"]): string {
  const s = ts?.seconds;
  if (!s) return "—";
  return new Date(s * 1000).toLocaleString("es-CO");
}

const LOTS_TABLE_PAGE_SIZE = 5;

/** Lote “libre” de titular: sin id ni nombre de persona inscrita. */
function lotHasNoInscribedOwner(lot: Lot): boolean {
  const id = typeof lot.currentOwnerId === "string" ? lot.currentOwnerId.trim() : lot.currentOwnerId;
  const name = (lot.currentOwnerName ?? "").trim();
  return !id && !name;
}

export function LotsPage() {
  const user = useAppSelector(selectSessionUser);
  const isMaster = user?.globalRole === "master";
  const canWrite = isMaster || (user?.globalRole === "company_user" && user?.companyRole === "admin");
  const [tick, setTick] = useState(0);
  const { companyId } = useEffectiveCompanyId(tick);
  const [companyName, setCompanyName] = useState<string | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [filterDraft, setFilterDraft] = useState("");
  const [appliedFilter, setAppliedFilter] = useState("");
  const [onlyFreeDraft, setOnlyFreeDraft] = useState(false);
  const [appliedOnlyFree, setAppliedOnlyFree] = useState(false);

  const [availability, setAvailability] = useState<ProjectLotsAvailability | null>(null);
  const [lots, setLots] = useState<Lot[]>([]);
  const [paymentSummaries, setPaymentSummaries] = useState<LotPaymentSummary[]>([]);
  const [transfers, setTransfers] = useState<LotTransfer[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [lotsTablePage, setLotsTablePage] = useState(1);
  const [assignLotTarget, setAssignLotTarget] = useState<Lot | null>(null);
  const [transferLotTarget, setTransferLotTarget] = useState<Lot | null>(null);
  const [historyLotTarget, setHistoryLotTarget] = useState<Lot | null>(null);

  const latestProjectIdRef = useRef<string | null>(projectId);
  latestProjectIdRef.current = projectId;

  useEffect(() => {
    if (!companyId) {
      setCompanyName(null);
      return;
    }
    let cancelled = false;
    void fetchCompanyById(companyId).then((c) => {
      if (!cancelled) setCompanyName(c?.name ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, [companyId]);

  const loadProjects = useCallback(async () => {
    if (!companyId) {
      setProjects([]);
      setProjectId(null);
      return;
    }
    setLoadingProjects(true);
    try {
      const raw = await fetchProjects(companyId);
      const list = raw.filter((p) => !isGastosProjectId(p.id));
      setProjects(list);
      setProjectId((prev) => {
        if (prev && list.some((p) => p.id === prev)) return prev;
        return list[0]?.id ?? null;
      });
    } catch {
      setProjects([]);
      setProjectId(null);
    } finally {
      setLoadingProjects(false);
    }
  }, [companyId]);

  useEffect(() => {
    void loadProjects();
  }, [loadProjects, tick]);

  useEffect(() => {
    setLotsTablePage(1);
    setLoadingDetail(false);
    if (!companyId || !projectId) {
      setAvailability(null);
      setLots([]);
      setPaymentSummaries([]);
      setTransfers([]);
      setMovements([]);
      setDetailError(null);
      setFilterDraft("");
      setAppliedFilter("");
      setOnlyFreeDraft(false);
      setAppliedOnlyFree(false);
      return;
    }
    setAvailability(null);
    setLots([]);
    setPaymentSummaries([]);
    setTransfers([]);
    setMovements([]);
    setDetailError(null);
    setFilterDraft("");
    setAppliedFilter("");
    setOnlyFreeDraft(false);
    setAppliedOnlyFree(false);
  }, [companyId, projectId]);

  const payByLot = useMemo(() => {
    const m = new Map<number, LotPaymentSummary>();
    for (const p of paymentSummaries) m.set(p.lotNumber, p);
    return m;
  }, [paymentSummaries]);

  const filteredLots = useMemo(() => {
    let list = appliedOnlyFree ? lots.filter(lotHasNoInscribedOwner) : lots;
    const q = appliedFilter.trim().toLowerCase();
    if (!q) return list;
    return list.filter((lot) => {
      const n = String(lot.lotNumber);
      const owner = (lot.currentOwnerName ?? "").toLowerCase();
      return n.includes(q) || owner.includes(q);
    });
  }, [lots, appliedFilter, appliedOnlyFree]);

  const lotsTotalPages = Math.max(1, Math.ceil(filteredLots.length / LOTS_TABLE_PAGE_SIZE));
  const lotsPageSafe = Math.min(Math.max(1, lotsTablePage), lotsTotalPages);

  useEffect(() => {
    setLotsTablePage((p) => Math.min(Math.max(1, p), lotsTotalPages));
  }, [lotsTotalPages]);

  useEffect(() => {
    setLotsTablePage(1);
  }, [appliedFilter, appliedOnlyFree]);

  const pagedLots = useMemo(() => {
    const start = (lotsPageSafe - 1) * LOTS_TABLE_PAGE_SIZE;
    return filteredLots.slice(start, start + LOTS_TABLE_PAGE_SIZE);
  }, [filteredLots, lotsPageSafe]);

  const reloadProjectDashboard = useCallback(async () => {
    if (!companyId || !projectId) return;
    const requestedProjectId = projectId;
    setLoadingDetail(true);
    setDetailError(null);
    try {
      const d = await fetchProjectLotsDashboard(companyId, requestedProjectId);
      if (latestProjectIdRef.current !== requestedProjectId) return;
      setAvailability(d.availability);
      setLots(d.lots);
      setPaymentSummaries(d.paymentSummaries);
      setTransfers(d.transfers);
      setMovements(d.movements);
    } catch (err) {
      if (latestProjectIdRef.current !== requestedProjectId) return;
      setAvailability(null);
      setLots([]);
      setPaymentSummaries([]);
      setTransfers([]);
      setMovements([]);
      setDetailError(err instanceof Error ? err.message : "No se pudo cargar el proyecto.");
    } finally {
      if (latestProjectIdRef.current === requestedProjectId) {
        setLoadingDetail(false);
      }
    }
  }, [companyId, projectId]);

  const handleBuscar = useCallback(async () => {
    if (!companyId || !projectId || loadingDetail) return;
    setAppliedFilter(filterDraft.trim());
    setAppliedOnlyFree(onlyFreeDraft);

    if (availability?.projectId === projectId) {
      return;
    }

    await reloadProjectDashboard();
  }, [
    companyId,
    projectId,
    filterDraft,
    onlyFreeDraft,
    availability?.projectId,
    loadingDetail,
    reloadProjectDashboard,
  ]);

  const clearTableFilters = useCallback(() => {
    setFilterDraft("");
    setAppliedFilter("");
    setOnlyFreeDraft(false);
    setAppliedOnlyFree(false);
    setLotsTablePage(1);
  }, []);

  const projectSelectItems = useMemo(
    () =>
      projects.map((p) => ({
        value: p.id,
        label: (
          <>
            <span className="truncate font-medium">{p.name}</span>
            <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{p.code}</span>
          </>
        ),
      })),
    [projects],
  );

  async function handleExport() {
    if (!availability || exporting) return;
    setExporting(true);
    try {
      await downloadProjectLotsDetailXlsx({
        companyName,
        availability,
        lots,
        paymentSummaries,
        transfers,
      });
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="p-6 lg:px-8 lg:py-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-heading text-2xl font-semibold tracking-tight sm:text-3xl">Lotes</h1>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground sm:text-[0.9375rem]">
              Elige un proyecto y pulsa Buscar: solo entonces se consultan lotes, movimientos y cesiones de ese
              proyecto. El resto de proyectos no se consulta hasta que lo pidas.
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
              disabled={!availability || lots.length === 0 || exporting}
              onClick={() => void handleExport()}
            >
              {exporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileSpreadsheet className="mr-2 h-4 w-4" />}
              Exportar Excel (proyecto)
            </Button>
          </div>
        </div>

        {!companyId ? (
          isMaster ? (
            <CompanyPickerSection revision={tick} onCompanySelected={() => setTick((t) => t + 1)} />
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Lotes</CardTitle>
                <CardDescription>Necesitas una empresa activa.</CardDescription>
              </CardHeader>
            </Card>
          )
        ) : (
          <div className="space-y-6">
            <Card className="border-border/80 bg-muted/15">
              <CardContent className="px-4 py-4 sm:px-6">
                <p className="text-sm sm:text-[0.9375rem]">
                  <span className="text-muted-foreground">Empresa: </span>
                  <span className="font-medium text-foreground">{companyName ?? "…"}</span>
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Proyecto</CardTitle>
                <CardDescription>
                  Pulsa Buscar para enviar la solicitud a Firestore y cargar el proyecto. El texto y “lotes libres”
                  filtran en el navegador sobre ese resultado; si ya cargaste este proyecto, Buscar solo actualiza
                  filtros sin volver a consultar.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end">
                  <div className="min-w-0 flex-1 space-y-2 sm:max-w-md">
                    <Label htmlFor="lots-project">Filtrar por proyecto</Label>
                    <Select
                      value={projectId}
                      items={projectSelectItems}
                      onValueChange={(v) => {
                        setProjectId(v);
                      }}
                      disabled={loadingProjects || projects.length === 0}
                      modal={false}
                    >
                      <SelectTrigger id="lots-project" size="default" className="h-10 w-full min-w-0 max-w-full">
                        <SelectValue
                          placeholder={loadingProjects ? "Cargando…" : "Elige un proyecto"}
                        />
                      </SelectTrigger>
                      <SelectContent align="start" sideOffset={6} alignItemWithTrigger={false}>
                        {projects.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            <span className="truncate font-medium">{p.name}</span>
                            <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{p.code}</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="w-full min-w-0 flex-1 space-y-2 sm:max-w-md">
                    <Label htmlFor="lots-search">Buscar en tabla (lote o dueño)</Label>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
                      <div className="relative min-w-0 flex-1">
                        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          id="lots-search"
                          className="h-10 pl-9"
                          placeholder="Ej. 12 o María…"
                          value={filterDraft}
                          onChange={(e) => setFilterDraft(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              void handleBuscar();
                            }
                          }}
                          disabled={!projectId || loadingDetail}
                          aria-label="Texto para buscar por número de lote o nombre de dueño"
                        />
                      </div>
                      <div className="flex shrink-0 gap-2">
                        <Button
                          type="button"
                          className="h-10 sm:min-w-26"
                          disabled={!projectId || loadingDetail}
                          onClick={() => void handleBuscar()}
                        >
                          {loadingDetail ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Cargando…
                            </>
                          ) : (
                            "Buscar"
                          )}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          className="h-10"
                          disabled={!projectId || loadingDetail}
                          onClick={() => clearTableFilters()}
                        >
                          Limpiar
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex items-start gap-3 rounded-lg border border-border/70 bg-muted/15 px-3 py-3">
                  <input
                    id="lots-only-free"
                    type="checkbox"
                    aria-label="Solo lotes sin titular inscrito (se aplica al pulsar Buscar, sobre datos ya cargados)"
                    checked={onlyFreeDraft}
                    disabled={!projectId || loadingDetail}
                    onChange={(e) => setOnlyFreeDraft(e.target.checked)}
                    className="mt-0.5 size-4 shrink-0 rounded border-input accent-primary disabled:opacity-50"
                  />
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <Label htmlFor="lots-only-free" className="cursor-pointer font-medium leading-snug">
                      Solo lotes libres (sin persona inscrita)
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Oculta lotes que ya tienen titular con id o nombre registrado. Se aplica al pulsar Buscar (o
                      Enter): la primera vez carga el proyecto; después solo refina la tabla en el navegador.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {detailError ? (
              <p className="text-sm text-destructive" role="alert">
                {detailError}
              </p>
            ) : null}

            {!projectId ? (
              <p className="text-sm text-muted-foreground">No hay proyectos con lotes en esta empresa.</p>
            ) : loadingDetail ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Consultando datos del proyecto…
              </div>
            ) : availability ? (
              <>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                  {(
                    [
                      ["Total", availability.totalLots],
                      ["Disponibles", availability.availableLots],
                      ["Vendidos", availability.soldLots],
                      ["Reservados", availability.reservedLots],
                      ["Devueltos", availability.returnedLots],
                    ] as const
                  ).map(([label, n]) => (
                    <Card key={label} className="border-border/80">
                      <CardHeader className="pb-2 pt-4">
                        <CardDescription>{label}</CardDescription>
                        <CardTitle className="text-2xl tabular-nums">{n}</CardTitle>
                      </CardHeader>
                    </Card>
                  ))}
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Inventario de lotes</CardTitle>
                    <CardDescription>
                      Pagos lote: todos los ingresos imputados a ese número de lote. Pagos titular actual: ingresos a
                      ese lote con la persona dueña actual y fecha contable desde la titularidad vigente. Puedes
                      asignar titular, registrar cesión e imprimir el historial por persona y periodo. La tabla muestra{" "}
                      {LOTS_TABLE_PAGE_SIZE} lotes por página.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="overflow-x-auto rounded-lg border border-border/70">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-16">Lote</TableHead>
                            <TableHead>Estado</TableHead>
                            <TableHead>Dueño actual</TableHead>
                            <TableHead>Desde</TableHead>
                            <TableHead className="text-right">Valor ref.</TableHead>
                            <TableHead className="text-right">Pagos lote</TableHead>
                            <TableHead className="text-right">Pagos titular</TableHead>
                            <TableHead className="w-[1%] whitespace-nowrap text-right">Acciones</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredLots.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={8} className="text-center text-muted-foreground">
                                Ningún lote coincide con el filtro.
                              </TableCell>
                            </TableRow>
                          ) : (
                            pagedLots.map((lot) => {
                              const pay = payByLot.get(lot.lotNumber);
                              const free = lotHasNoInscribedOwner(lot);
                              return (
                                <TableRow key={lot.id}>
                                  <TableCell className="font-mono font-medium tabular-nums">{lot.lotNumber}</TableCell>
                                  <TableCell>
                                    <Badge
                                      variant={
                                        lot.status === "available"
                                          ? "secondary"
                                          : lot.status === "sold"
                                            ? "default"
                                            : "outline"
                                      }
                                    >
                                      {lotStatusLabel(lot.status)}
                                    </Badge>
                                  </TableCell>
                                  <TableCell>{lot.currentOwnerName ?? "—"}</TableCell>
                                  <TableCell className="text-muted-foreground">{fmtAssigned(lot.assignedAt)}</TableCell>
                                  <TableCell className="text-right tabular-nums text-muted-foreground">
                                    {lot.declaredLotValue != null && lot.declaredLotValue > 0
                                      ? moneyFmt.format(lot.declaredLotValue)
                                      : "—"}
                                  </TableCell>
                                  <TableCell className="text-right tabular-nums">
                                    {moneyFmt.format(pay?.totalPaidOnLot ?? 0)}
                                  </TableCell>
                                  <TableCell className="text-right tabular-nums">
                                    {moneyFmt.format(pay?.totalPaidAsCurrentOwner ?? 0)}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    <div className="flex flex-wrap justify-end gap-1">
                                      {canWrite && free ? (
                                        <Button
                                          type="button"
                                          variant="outline"
                                          size="sm"
                                          className="h-8 gap-1 px-2"
                                          onClick={() => setAssignLotTarget(lot)}
                                        >
                                          <UserPlus className="size-3.5" />
                                          Titular
                                        </Button>
                                      ) : null}
                                      {canWrite && !free ? (
                                        <Button
                                          type="button"
                                          variant="outline"
                                          size="sm"
                                          className="h-8 gap-1 px-2"
                                          onClick={() => setTransferLotTarget(lot)}
                                        >
                                          <ArrowLeftRight className="size-3.5" />
                                          Ceder
                                        </Button>
                                      ) : null}
                                      <Button
                                        type="button"
                                        variant="secondary"
                                        size="sm"
                                        className="h-8 gap-1 px-2"
                                        onClick={() => setHistoryLotTarget(lot)}
                                      >
                                        <History className="size-3.5" />
                                        Historial
                                      </Button>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              );
                            })
                          )}
                        </TableBody>
                      </Table>
                    </div>
                    {filteredLots.length > 0 ? (
                      <div className="flex flex-col gap-3 border-t border-border/70 pt-4 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-sm text-muted-foreground">
                          Mostrando{" "}
                          <span className="font-medium text-foreground tabular-nums">
                            {(lotsPageSafe - 1) * LOTS_TABLE_PAGE_SIZE + 1}
                          </span>
                          –
                          <span className="font-medium text-foreground tabular-nums">
                            {Math.min(lotsPageSafe * LOTS_TABLE_PAGE_SIZE, filteredLots.length)}
                          </span>{" "}
                          de <span className="tabular-nums">{filteredLots.length}</span>
                        </p>
                        <div className="flex flex-wrap items-center gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="gap-1"
                            disabled={lotsPageSafe <= 1}
                            onClick={() => setLotsTablePage((p) => Math.max(1, p - 1))}
                            aria-label="Página anterior"
                          >
                            <ChevronLeft className="size-4" />
                            Anterior
                          </Button>
                          <span className="min-w-28 text-center text-sm tabular-nums text-muted-foreground">
                            Página {lotsPageSafe} de {lotsTotalPages}
                          </span>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="gap-1"
                            disabled={lotsPageSafe >= lotsTotalPages}
                            onClick={() => setLotsTablePage((p) => Math.min(lotsTotalPages, p + 1))}
                            aria-label="Página siguiente"
                          >
                            Siguiente
                            <ChevronRight className="size-4" />
                          </Button>
                        </div>
                      </div>
                    ) : null}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Cesiones recientes</CardTitle>
                    <CardDescription>
                      Historial de traspasos de titularidad en este proyecto ({transfers.length}).
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {transfers.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Aún no hay cesiones registradas.</p>
                    ) : (
                      <div className="overflow-x-auto rounded-lg border border-border/70">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Fecha</TableHead>
                              <TableHead>Lote</TableHead>
                              <TableHead>Cedente (id)</TableHead>
                              <TableHead>Cesionario</TableHead>
                              <TableHead>Notas</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {transfers.map((t) => (
                              <TableRow key={t.id}>
                                <TableCell className="whitespace-nowrap text-muted-foreground">
                                  {fmtTransfer(t.transferDate ?? t.createdAt)}
                                </TableCell>
                                <TableCell className="font-mono tabular-nums">{t.lotNumber ?? "—"}</TableCell>
                                <TableCell className="max-w-40 truncate font-mono text-xs">{t.fromOwnerId}</TableCell>
                                <TableCell>{t.toOwnerName || t.toOwnerId}</TableCell>
                                <TableCell className="max-w-xs text-muted-foreground">{t.notes ?? "—"}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </>
            ) : (
              <Card className="border-dashed">
                <CardHeader>
                  <CardTitle className="text-base">Sin datos cargados</CardTitle>
                  <CardDescription>
                    Selecciona el proyecto arriba y pulsa <span className="font-medium text-foreground">Buscar</span>{" "}
                    para traer lotes, resúmenes, pagos y cesiones. Cambiar de proyecto borra la vista hasta una nueva
                    búsqueda.
                  </CardDescription>
                </CardHeader>
              </Card>
            )}

            {companyId && projectId ? (
              <>
                <AssignLotOwnerDialog
                  open={assignLotTarget !== null}
                  onOpenChange={(o) => {
                    if (!o) setAssignLotTarget(null);
                  }}
                  companyId={companyId}
                  projectId={projectId}
                  lot={assignLotTarget}
                  onAssigned={() => reloadProjectDashboard()}
                />
                <TransferLotOwnerDialog
                  open={transferLotTarget !== null}
                  onOpenChange={(o) => {
                    if (!o) setTransferLotTarget(null);
                  }}
                  companyId={companyId}
                  projectId={projectId}
                  lot={transferLotTarget}
                  onTransferred={() => reloadProjectDashboard()}
                />
                <LotPersonHistoryDialog
                  open={historyLotTarget !== null}
                  onOpenChange={(o) => {
                    if (!o) setHistoryLotTarget(null);
                  }}
                  companyName={companyName}
                  projectName={
                    availability?.projectName ?? projects.find((p) => p.id === projectId)?.name ?? "—"
                  }
                  lot={historyLotTarget}
                  movements={movements}
                  transfers={transfers}
                />
              </>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
