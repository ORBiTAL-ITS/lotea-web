"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { FileSpreadsheet, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  clearStoredCompanyId,
  useEffectiveCompanyId,
} from "@/features/session/hooks/use-effective-company-id";
import { fetchCompanyById } from "@/features/companies/services/companies-service";
import { CompanyPickerSection } from "@/features/companies/components/company-picker-section";
import { GASTOS_PROJECT_DOC_ID } from "@/features/projects/constants/gastos-project";
import {
  ensureGastosProject,
  fetchProjects,
} from "@/features/projects/services/projects-service";
import type { Project } from "@/features/projects/models/project-types";
import type { Movement } from "@/features/movements/models/movement-types";
import { fetchMovements } from "@/features/movements/services/movements-service";
import { useAppSelector } from "@/shared/store/hooks";
import { selectSessionUser } from "@/features/session/models/session-selectors";
import { movementInDateRangeInclusive } from "../utils/movement-in-date-range";
import {
  defaultExportFileBase,
  downloadFinancialExportXlsx,
} from "../utils/write-financial-export-xlsx";

function todayYmd(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function firstDayOfMonthYmd(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}-01`;
}

function periodoLabelFromRange(startYmd: string, endYmd: string): string {
  return `${startYmd} a ${endYmd}`;
}

export function ExportExcelPage() {
  const user = useAppSelector(selectSessionUser);
  const isMaster = user?.globalRole === "master";
  const canSwitchCompany = isMaster;
  const [tick, setTick] = useState(0);
  const { companyId } = useEffectiveCompanyId(tick);
  const [companyName, setCompanyName] = useState<string | null>(null);

  const [projects, setProjects] = useState<Project[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [startYmd, setStartYmd] = useState(firstDayOfMonthYmd);
  const [endYmd, setEndYmd] = useState(todayYmd);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  useEffect(() => {
    if (!companyId) {
      setProjects([]);
      return;
    }
    let cancelled = false;
    setLoadingProjects(true);
    void (async () => {
      try {
        await ensureGastosProject(companyId);
        const list = await fetchProjects(companyId);
        if (cancelled) return;
        const real = list.filter((p) => p.id !== GASTOS_PROJECT_DOC_ID);
        setProjects(real);
      } catch {
        if (!cancelled) setProjects([]);
      } finally {
        if (!cancelled) setLoadingProjects(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [companyId, tick]);

  const toggleProject = useCallback((id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const selectedProjectsOrdered = useMemo(() => {
    const set = selectedIds;
    return projects.filter((p) => set.has(p.id));
  }, [projects, selectedIds]);

  const handleExport = useCallback(async () => {
    if (!companyId) return;
    if (startYmd > endYmd) {
      setError("La fecha inicial no puede ser posterior a la fecha final.");
      return;
    }
    setError(null);
    setExporting(true);
    try {
      await ensureGastosProject(companyId);

      const gastosSnap = await fetchMovements(companyId, GASTOS_PROJECT_DOC_ID);
      const gastos: Movement[] = gastosSnap.filter(
        (m) =>
          m.kind === "expense" && movementInDateRangeInclusive(m, startYmd, endYmd),
      );

      const proyectos: {
        project: Project;
        egresos: Movement[];
        ingresos: Movement[];
      }[] = [];

      for (const p of selectedProjectsOrdered) {
        const all = await fetchMovements(companyId, p.id);
        const inRange = (m: Movement) =>
          movementInDateRangeInclusive(m, startYmd, endYmd);
        const egresos = all.filter((m) => m.kind === "expense" && inRange(m));
        const ingresos = all.filter((m) => m.kind === "income" && inRange(m));
        proyectos.push({ project: p, egresos, ingresos });
      }

      const periodoLabel = periodoLabelFromRange(startYmd, endYmd);
      const base = defaultExportFileBase(periodoLabel);
      await downloadFinancialExportXlsx(
        { periodoLabel, gastos, proyectos },
        base,
      );
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "No se pudo generar el archivo.",
      );
    } finally {
      setExporting(false);
    }
  }, [companyId, endYmd, selectedProjectsOrdered, startYmd]);

  return (
    <div className="w-full px-4 py-6 sm:px-6 md:px-8 lg:px-10 xl:px-12 lg:py-8 xl:py-10">
      <div className="mx-auto w-full max-w-3xl space-y-8">
        <div className="space-y-2">
          <h1 className="font-heading text-2xl font-semibold tracking-tight sm:text-3xl">
            Exportar a Excel
          </h1>
          <p className="max-w-prose text-pretty text-sm leading-relaxed text-muted-foreground sm:text-[0.9375rem]">
            Elige el rango de fechas (día, mes y año) y los proyectos. Se incluyen
            los gastos generales de la empresa y, por cada proyecto, egresos e
            ingresos con sus comprobantes. Al final se calculan totales y el
            resultado (ingresos menos salidas).
          </p>
        </div>

        {!companyId ? (
          isMaster ? (
            <CompanyPickerSection
              revision={tick}
              onCompanySelected={() => setTick((t) => t + 1)}
            />
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Empresa</CardTitle>
                <CardDescription>
                  Necesitas una empresa activa para exportar. Configúrala desde el
                  panel o proyectos.
                </CardDescription>
              </CardHeader>
            </Card>
          )
        ) : (
          <>
            <Card className="border-border/80 bg-muted/15">
              <CardContent className="px-4 py-5 sm:px-6 sm:py-6">
                <p className="text-sm sm:text-[0.9375rem]">
                  <span className="text-muted-foreground">Empresa activa: </span>
                  <span className="font-medium text-foreground">
                    {companyName ?? "…"}
                  </span>
                </p>
              </CardContent>
            </Card>

            {canSwitchCompany ? (
              <Button
                type="button"
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

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Rango de fechas</CardTitle>
                <CardDescription>
                  Fecha contable inclusive en cada extremo (calendario Colombia).
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="export-start">Fecha inicial</Label>
                    <input
                      id="export-start"
                      type="date"
                      value={startYmd}
                      onChange={(e) => setStartYmd(e.target.value)}
                      aria-label="Fecha inicial del informe"
                      className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="export-end">Fecha final</Label>
                    <input
                      id="export-end"
                      type="date"
                      value={endYmd}
                      onChange={(e) => setEndYmd(e.target.value)}
                      aria-label="Fecha final del informe"
                      className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Proyectos</CardTitle>
                <CardDescription>
                  Marca uno o varios para incluir sus egresos e ingresos en el
                  periodo. Los gastos generales (empresa) siempre se incluyen si
                  existen en el rango.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {loadingProjects ? (
                  <p className="text-sm text-muted-foreground">Cargando proyectos…</p>
                ) : projects.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No hay proyectos en esta empresa además del registro interno de
                    gastos.
                  </p>
                ) : (
                  <ul className="max-h-64 space-y-3 overflow-y-auto pr-1">
                    {projects.map((p) => (
                      <li
                        key={p.id}
                        className="flex items-start gap-3 rounded-lg border border-border/60 bg-muted/20 px-3 py-2.5"
                      >
                        <input
                          id={`proj-${p.id}`}
                          type="checkbox"
                          checked={selectedIds.has(p.id)}
                          onChange={(e) =>
                            toggleProject(p.id, e.target.checked)
                          }
                          className="border-primary text-primary focus-visible:ring-ring mt-1 size-4 shrink-0 rounded border"
                        />
                        <label
                          htmlFor={`proj-${p.id}`}
                          className="min-w-0 flex-1 cursor-pointer text-sm leading-snug"
                        >
                          <span className="font-medium">{p.name}</span>
                          <span className="text-muted-foreground">
                            {" "}
                            · <span className="font-mono text-xs">{p.code}</span>
                          </span>
                        </label>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            {error ? (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            ) : null}

            <Button
              type="button"
              className="gap-2"
              disabled={exporting || loadingProjects}
              onClick={() => void handleExport()}
            >
              {exporting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FileSpreadsheet className="h-4 w-4" />
              )}
              Descargar Excel
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
