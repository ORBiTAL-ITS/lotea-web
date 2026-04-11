"use client";

import { useCallback, useEffect, useState } from "react";
import { Pencil } from "lucide-react";
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
      <div className="mx-auto max-w-3xl">
        <div className="flex w-full flex-wrap items-start gap-4">
          <div className="min-w-0 flex-1">
            <h1 className="font-heading text-2xl font-semibold tracking-tight">Proyectos</h1>
            <p className="mt-1 text-sm text-muted-foreground">
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

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Listado</CardTitle>
                  <CardDescription>
                    {loading ? "Cargando…" : `${list.length} proyecto(s)`}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {!loading && list.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Aún no hay proyectos. Pulsa el botón redondo <span className="font-medium text-foreground">+</span>{" "}
                      junto al título para abrir el formulario.
                    </p>
                  ) : null}
                  {list.map((p) => (
                    <div
                      key={p.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/80 px-3 py-2.5 transition-colors hover:bg-muted/30"
                    >
                      <div className="min-w-0">
                        <p className="font-medium">{p.name}</p>
                        <p className="text-xs text-muted-foreground">
                          /{p.code} · {p.lotCount} lotes
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={p.status === "active" ? "default" : "secondary"}>
                          {p.status === "active" ? "Activo" : "Cerrado"}
                        </Badge>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="gap-1"
                          onClick={() => setEditing(p)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          Editar
                        </Button>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
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
