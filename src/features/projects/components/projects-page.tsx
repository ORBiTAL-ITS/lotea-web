"use client";

import { useCallback, useEffect, useState } from "react";
import { Building2, Layers, Pencil } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  useEffectiveCompanyId,
  clearStoredCompanyId,
} from "@/features/session/hooks/use-effective-company-id";
import { useAppSelector } from "@/shared/store/hooks";
import { selectSessionUser } from "@/features/session/models/session-selectors";
import { fetchCompanyById } from "@/features/companies/services/companies-service";
import { CompanyPickerSection } from "@/features/companies/components/company-picker-section";
import { isGastosProjectId } from "../constants/gastos-project";
import { fetchProjects } from "../services/projects-service";
import type { Project } from "../models/project-types";
import { EditProjectDialog } from "./edit-project-dialog";
import { QuickNewProjectButton } from "./quick-new-project-button";
import { LOTEA_PROJECTS_UPDATED_EVENT } from "../projects-events";
import { getProjectInvoiceImageSrc } from "../utils/project-invoice-image";

export function ProjectsPage() {
  const user = useAppSelector(selectSessionUser);
  const [tick, setTick] = useState(0);
  const { companyId } = useEffectiveCompanyId(tick);
  const [list, setList] = useState<Project[]>([]);
  const [loading, setLoading] = useState(false);
  const [companyName, setCompanyName] = useState<string | null>(null);
  const [editing, setEditing] = useState<Project | null>(null);

  const refresh = useCallback(async () => {
    if (!companyId) {
      setList([]);
      return;
    }
    setLoading(true);
    try {
      const raw = await fetchProjects(companyId);
      setList(raw.filter((p) => !isGastosProjectId(p.id)));
    } catch {
      setList([]);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void refresh();
  }, [refresh, tick]);

  useEffect(() => {
    const bump = () => setTick((t) => t + 1);
    window.addEventListener(LOTEA_PROJECTS_UPDATED_EVENT, bump);
    return () => window.removeEventListener(LOTEA_PROJECTS_UPDATED_EVENT, bump);
  }, []);

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

  const isMaster = user?.globalRole === "master";
  const canSwitchCompany = isMaster;

  return (
    <div className="p-6 lg:px-8 lg:py-8">
      <div className="mx-auto max-w-7xl">
        <div className="flex w-full flex-wrap items-start gap-4">
          <div className="min-w-0 flex-1">
            <h1 className="font-heading text-2xl font-semibold tracking-tight sm:text-3xl">Proyectos</h1>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground sm:text-[0.9375rem]">
              Lotes, urbanizaciones u obras bajo una misma empresa. Crea uno nuevo con el botón{" "}
              <span className="font-medium text-foreground">+</span> de esta pantalla.
            </p>
          </div>
          <div className="ml-auto flex shrink-0 flex-wrap items-center justify-end gap-2">
            {canSwitchCompany && companyId ? (
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
            <QuickNewProjectButton />
          </div>
        </div>

        <div className="mt-6 space-y-6">
          {!companyId ? (
            isMaster ? (
              <CompanyPickerSection
                revision={tick}
                onCompanySelected={() => setTick((t) => t + 1)}
              />
            ) : (
              <Card className="border-border/80">
                <CardHeader>
                  <CardTitle className="text-base">Proyectos</CardTitle>
                  <CardDescription>
                    Usa el botón <span className="font-medium text-foreground">+</span> arriba para
                    crear un proyecto (nombre y lotes opcionales). Si el master aún no te
                    vinculó a una empresa en el alta, al crear el primer proyecto se prepara tu espacio
                    automáticamente. Si ya tienes empresa en el token y no ves el listado, cierra sesión
                    y entra de nuevo.
                  </CardDescription>
                </CardHeader>
              </Card>
            )
          ) : (
            <>
              <div className="rounded-xl border border-border/80 bg-muted/25 px-4 py-3 text-sm">
                <p className="font-medium text-foreground">
                  <span className="text-muted-foreground">Empresa: </span>
                  {companyName ?? "…"}
                </p>
              </div>

              <div className="space-y-4">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Cartera de proyectos
                    </p>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {loading ? "Cargando…" : `${list.length} proyecto(s)`}
                    </p>
                  </div>
                </div>

                {!loading && list.length === 0 ? (
                  <Card className="border-dashed border-border/80 bg-muted/10">
                    <CardContent className="flex flex-col items-center justify-center gap-3 py-14 text-center">
                      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                        <Building2 className="h-7 w-7" strokeWidth={1.5} />
                      </div>
                      <p className="max-w-sm text-sm text-muted-foreground">
                        Aún no hay proyectos. Pulsa el botón redondo{" "}
                        <span className="font-medium text-foreground">+</span> junto al título para abrir el
                        formulario.
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {list.map((p) => {
                      const coverSrc = getProjectInvoiceImageSrc(p);
                      return (
                      <li key={p.id}>
                        <Card className="group h-full overflow-hidden border-border/80 bg-card/95 shadow-sm transition-[box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:shadow-md">
                          <div className="relative aspect-16/10 overflow-hidden bg-muted">
                            {coverSrc ? (
                              // eslint-disable-next-line @next/next/no-img-element -- data URL o URL externa
                              <img
                                src={coverSrc}
                                alt=""
                                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                              />
                            ) : (
                              <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-linear-to-br from-muted via-muted/80 to-primary/5 text-muted-foreground">
                                <Building2 className="h-10 w-10 opacity-40" strokeWidth={1.25} />
                                <span className="text-xs font-medium opacity-60">Sin imagen</span>
                              </div>
                            )}
                            <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/55 to-transparent pt-10 pb-2 px-3">
                              <Badge
                                variant={p.status === "active" ? "default" : "secondary"}
                                className="shadow-sm"
                              >
                                {p.status === "active" ? "Activo" : "Cerrado"}
                              </Badge>
                            </div>
                          </div>
                          <CardHeader className="space-y-1 pb-2 pt-4">
                            <CardTitle className="line-clamp-2 text-lg leading-snug">{p.name}</CardTitle>
                            <CardDescription className="flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-xs">
                              <span>/{p.code}</span>
                              <span className="text-border">·</span>
                              <span className="inline-flex items-center gap-1 tabular-nums">
                                <Layers className="h-3.5 w-3.5 shrink-0" aria-hidden />
                                {p.lotCount} lotes
                              </span>
                            </CardDescription>
                          </CardHeader>
                          <CardContent className="pt-0 pb-4">
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              className="w-full gap-2"
                              onClick={() => setEditing(p)}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                              Editar proyecto
                            </Button>
                          </CardContent>
                        </Card>
                      </li>
                    );
                    })}
                  </ul>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      <EditProjectDialog
        open={editing !== null && Boolean(companyId)}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
        companyId={companyId ?? ""}
        project={editing}
        onSaved={() => setTick((t) => t + 1)}
      />
    </div>
  );
}
