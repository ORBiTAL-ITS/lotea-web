"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useEffectiveCompanyId } from "@/features/session/hooks/use-effective-company-id";
import { CompanyPickerSection } from "@/features/companies/components/company-picker-section";
import { fetchDeleteAuditRecords, type DeleteAuditRecord } from "../services/delete-audit-service";

function fmtDate(ts: DeleteAuditRecord["deletedAt"]): string {
  if (!ts) return "—";
  return new Date(ts.seconds * 1000).toLocaleString("es-CO");
}

export function DeleteHistoryPage() {
  const [tick, setTick] = useState(0);
  const { companyId } = useEffectiveCompanyId(tick);
  const [rows, setRows] = useState<DeleteAuditRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    setError(null);
    try {
      setRows(await fetchDeleteAuditRecords(companyId));
    } catch {
      setRows([]);
      setError("No se pudo cargar el historial.");
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="p-6 lg:px-8 lg:py-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">Historial de borrados</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Registros eliminados lógicamente con trazabilidad de fecha y origen.
          </p>
        </div>

        {!companyId ? (
          <CompanyPickerSection revision={tick} onCompanySelected={() => setTick((t) => t + 1)} />
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Bitácora</CardTitle>
              <CardDescription>{rows.length} registro(s)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {error ? (
                <p className="text-sm text-destructive" role="alert">
                  {error}
                </p>
              ) : null}
              {loading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Cargando…
                </div>
              ) : rows.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sin elementos eliminados.</p>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-border/70">
                  <table className="w-full min-w-4xl text-sm">
                    <thead className="bg-muted/40">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium">Fecha</th>
                        <th className="px-3 py-2 text-left font-medium">Entidad</th>
                        <th className="px-3 py-2 text-left font-medium">ID</th>
                        <th className="px-3 py-2 text-left font-medium">Proyecto</th>
                        <th className="px-3 py-2 text-left font-medium">Módulo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row) => (
                        <tr key={row.id} className="border-t border-border/50">
                          <td className="px-3 py-2">{fmtDate(row.deletedAt)}</td>
                          <td className="px-3 py-2">{row.entityType}</td>
                          <td className="px-3 py-2 font-mono text-xs">{row.entityId}</td>
                          <td className="px-3 py-2 font-mono text-xs">{row.projectId}</td>
                          <td className="px-3 py-2">{row.originModule}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
