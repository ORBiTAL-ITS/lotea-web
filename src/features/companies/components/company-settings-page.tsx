"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAppSelector } from "@/shared/store/hooks";
import { selectSessionUser } from "@/features/session/models/session-selectors";
import { useEffectiveCompanyId } from "@/features/session/hooks/use-effective-company-id";
import { CompanyPickerSection } from "./company-picker-section";
import { fetchCompanyById, updateCompany } from "../services/companies-service";

export function CompanySettingsPage() {
  const user = useAppSelector(selectSessionUser);
  const isMaster = user?.globalRole === "master";
  const [tick, setTick] = useState(0);
  const { companyId } = useEffectiveCompanyId(tick);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [legalName, setLegalName] = useState("");
  const [nit, setNit] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");

  useEffect(() => {
    if (!companyId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setOk(null);
    void fetchCompanyById(companyId)
      .then((company) => {
        if (cancelled || !company) return;
        setName(company.name ?? "");
        setLegalName(company.legalName ?? "");
        setNit(company.nit ?? "");
        setPhone(company.phone ?? "");
        setEmail(company.email ?? "");
      })
      .catch(() => {
        if (!cancelled) setError("No se pudo cargar la empresa.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [companyId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!companyId || saving) return;
    setSaving(true);
    setError(null);
    setOk(null);
    try {
      await updateCompany(companyId, {
        name,
        legalName,
        nit,
        phone,
        email,
      });
      setOk("Datos de empresa actualizados.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-6 lg:px-8 lg:py-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">Empresa</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Actualiza el nombre y datos comerciales de la empresa activa.
          </p>
        </div>

        {!companyId ? (
          isMaster ? (
            <CompanyPickerSection revision={tick} onCompanySelected={() => setTick((t) => t + 1)} />
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Empresa</CardTitle>
                <CardDescription>Necesitas una empresa activa para editar estos datos.</CardDescription>
              </CardHeader>
            </Card>
          )
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Perfil de empresa</CardTitle>
              <CardDescription>Estos datos se usan en cabeceras y comprobantes.</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Cargando…
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  {error ? (
                    <p className="text-sm text-destructive" role="alert">
                      {error}
                    </p>
                  ) : null}
                  {ok ? <p className="text-sm text-emerald-700">{ok}</p> : null}
                  <div className="space-y-2">
                    <Label htmlFor="company-name">Nombre comercial *</Label>
                    <Input
                      id="company-name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      disabled={saving}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="company-legal-name">Razón social</Label>
                    <Input
                      id="company-legal-name"
                      value={legalName}
                      onChange={(e) => setLegalName(e.target.value)}
                      disabled={saving}
                    />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="company-nit">NIT / documento</Label>
                      <Input
                        id="company-nit"
                        value={nit}
                        onChange={(e) => setNit(e.target.value)}
                        disabled={saving}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="company-phone">Teléfono</Label>
                      <Input
                        id="company-phone"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        disabled={saving}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="company-email">Email</Label>
                    <Input
                      id="company-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={saving}
                    />
                  </div>
                  <Button type="submit" disabled={saving}>
                    {saving ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Guardando…
                      </>
                    ) : (
                      "Guardar cambios"
                    )}
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
