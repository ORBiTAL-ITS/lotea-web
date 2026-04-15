"use client";

import { useCallback, useEffect, useState } from "react";
import { IdCard, Loader2, Pencil, Phone, Search, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useEffectiveCompanyId } from "@/features/session/hooks/use-effective-company-id";
import { useAppSelector } from "@/shared/store/hooks";
import { selectSessionUser } from "@/features/session/models/session-selectors";
import type { Person } from "../models/person-types";
import { createPerson, fetchPeople, updatePerson } from "../services/people-service";
import { CompanyPickerSection } from "@/features/companies/components/company-picker-section";
import { fetchCompanyById } from "@/features/companies/services/companies-service";
import { WorkersPaymentsSection } from "./workers-payments-section";

type FormState = {
  name: string;
  idNumber: string;
  phone: string;
};

const emptyForm: FormState = { name: "", idNumber: "", phone: "" };

export function PeoplePage() {
  const user = useAppSelector(selectSessionUser);
  const [tick, setTick] = useState(0);
  const { companyId } = useEffectiveCompanyId(tick);
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<Person | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);

  const isViewer = user?.companyRole === "viewer";
  const isMaster = user?.globalRole === "master";
  const canWrite =
    isMaster || (user?.globalRole === "company_user" && user?.companyRole === "admin");

  const [companyLabel, setCompanyLabel] = useState<string | null>(null);
  useEffect(() => {
    if (!companyId) {
      setCompanyLabel(null);
      return;
    }
    let cancelled = false;
    void fetchCompanyById(companyId).then((c) => {
      if (!cancelled) setCompanyLabel(c?.name ?? companyId);
    });
    return () => {
      cancelled = true;
    };
  }, [companyId]);

  const load = useCallback(async () => {
    if (!companyId) {
      setPeople([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const list = await fetchPeople(companyId);
      setPeople(list);
      setHasFetched(true);
    } catch {
      setError("No se pudo cargar el listado de personas.");
      setPeople([]);
      setHasFetched(true);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    setPeople([]);
    setHasFetched(false);
    setError(null);
  }, [companyId]);

  function openCreate() {
    setForm(emptyForm);
    setError(null);
    setCreateOpen(true);
  }

  function openEdit(p: Person) {
    setEditing(p);
    setForm({
      name: p.name,
      idNumber: p.idNumber,
      phone: p.phone,
    });
    setError(null);
    setEditOpen(true);
  }

  async function submitCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!companyId || saving) return;
    setSaving(true);
    setError(null);
    try {
      await createPerson(companyId, form);
      setCreateOpen(false);
      setForm(emptyForm);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar.");
    } finally {
      setSaving(false);
    }
  }

  async function submitEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!companyId || !editing || saving) return;
    setSaving(true);
    setError(null);
    try {
      await updatePerson(companyId, editing.id, form);
      setEditOpen(false);
      setEditing(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8">
      <header className="space-y-2">
        <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          Personas
        </h1>
        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-[0.9375rem]">
          Catálogo de personas para vincular a movimientos imputados a lote (nombre en comprobantes y
          trazabilidad). Pulsa <span className="font-medium text-foreground">Buscar</span> para cargar el listado
          (no se consulta al entrar). Debajo, pagos a trabajadores con el mismo criterio. Crea o edita personas
          aquí; también puedes dar de alta una persona al registrar un ingreso o egreso con lote.
        </p>
      </header>

      {!companyId ? (
        isMaster ? (
          <CompanyPickerSection
            revision={tick}
            onCompanySelected={() => setTick((t) => t + 1)}
          />
        ) : (
          <Card className="border-dashed">
            <CardHeader>
              <CardTitle className="text-lg">Empresa activa</CardTitle>
              <CardDescription>
                Elige la empresa en Proyectos para usar Personas y el resto de módulos.
              </CardDescription>
            </CardHeader>
          </Card>
        )
      ) : (
        <>
          {isMaster ? (
            <CompanyPickerSection
              revision={tick}
              onCompanySelected={() => setTick((t) => t + 1)}
            />
          ) : (
            <Card className="border-border/80 bg-muted/15">
              <CardContent className="px-4 py-4 sm:px-6">
                <p className="text-sm text-muted-foreground">
                  Empresa activa:{" "}
                  <span className="font-medium text-foreground">{companyLabel ?? companyId}</span>
                </p>
              </CardContent>
            </Card>
          )}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              {loading
                ? "Cargando…"
                : hasFetched
                  ? `${people.length} persona${people.length === 1 ? "" : "s"}`
                  : "Pulsa Buscar para cargar el catálogo."}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                className="gap-2"
                disabled={loading}
                onClick={() => void load()}
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  <Search className="h-4 w-4" aria-hidden />
                )}
                Buscar
              </Button>
              {canWrite && !isViewer ? (
                <Button type="button" className="gap-2" onClick={openCreate}>
                  <UserPlus className="h-4 w-4" aria-hidden />
                  Nueva persona
                </Button>
              ) : null}
            </div>
          </div>

          {error && !createOpen && !editOpen ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}

          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" aria-hidden />
            </div>
          ) : !hasFetched ? (
            <Card className="border-dashed border-border/80 bg-muted/15">
              <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
                <p className="max-w-md text-sm text-muted-foreground">
                  Pulsa <span className="font-medium text-foreground">Buscar</span> arriba para consultar el
                  catálogo en Firestore. No se cargan datos solo por entrar a esta página.
                </p>
              </CardContent>
            </Card>
          ) : people.length === 0 ? (
            <Card className="border-dashed bg-muted/20">
              <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
                <p className="max-w-sm text-sm text-muted-foreground">
                  Aún no hay personas. Añade la primera para usarla al imputar movimientos a lotes.
                </p>
                {canWrite && !isViewer ? (
                  <Button type="button" onClick={openCreate} className="gap-2">
                    <UserPlus className="h-4 w-4" aria-hidden />
                    Crear persona
                  </Button>
                ) : null}
              </CardContent>
            </Card>
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2">
              {people.map((p) => (
                <li key={p.id}>
                  <Card className="h-full border-border/80 transition-shadow hover:shadow-md">
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between gap-2">
                        <CardTitle className="text-base leading-snug">{p.name}</CardTitle>
                        {canWrite && !isViewer ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 shrink-0"
                            aria-label={`Editar ${p.name}`}
                            onClick={() => openEdit(p)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        ) : null}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm text-muted-foreground">
                      <p className="flex items-center gap-2">
                        <IdCard className="h-4 w-4 shrink-0 opacity-70" aria-hidden />
                        <span className="tabular-nums">{p.idNumber}</span>
                      </p>
                      <p className="flex items-center gap-2">
                        <Phone className="h-4 w-4 shrink-0 opacity-70" aria-hidden />
                        <span className="tabular-nums">{p.phone}</span>
                      </p>
                    </CardContent>
                  </Card>
                </li>
              ))}
            </ul>
          )}

          <WorkersPaymentsSection companyId={companyId} />
        </>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md" showCloseButton>
          <form onSubmit={submitCreate}>
            <DialogHeader>
              <DialogTitle>Nueva persona</DialogTitle>
              <DialogDescription>
                Los datos se guardan en la empresa activa y podrás seleccionarlos al registrar movimientos
                con lote.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-3 py-2">
              {error && createOpen ? (
                <p className="text-sm text-destructive" role="alert">
                  {error}
                </p>
              ) : null}
              <div className="space-y-2">
                <Label htmlFor="p-name">Nombre completo</Label>
                <Input
                  id="p-name"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  required
                  disabled={saving}
                  autoComplete="name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="p-id">Cédula</Label>
                <Input
                  id="p-id"
                  value={form.idNumber}
                  onChange={(e) => setForm((f) => ({ ...f, idNumber: e.target.value }))}
                  required
                  disabled={saving}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="p-phone">Teléfono</Label>
                <Input
                  id="p-phone"
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  required
                  disabled={saving}
                  inputMode="tel"
                />
              </div>
            </div>
            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" disabled={saving} onClick={() => setCreateOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Guardando…
                  </>
                ) : (
                  "Guardar"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={editOpen}
        onOpenChange={(o) => {
          setEditOpen(o);
          if (!o) setEditing(null);
        }}
      >
        <DialogContent className="sm:max-w-md" showCloseButton>
          <form onSubmit={submitEdit}>
            <DialogHeader>
              <DialogTitle>Editar persona</DialogTitle>
              <DialogDescription>
                Los cambios no modifican movimientos ya guardados (conservan el nombre que tenían al
                registrar).
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-3 py-2">
              {error && editOpen ? (
                <p className="text-sm text-destructive" role="alert">
                  {error}
                </p>
              ) : null}
              <div className="space-y-2">
                <Label htmlFor="pe-name">Nombre completo</Label>
                <Input
                  id="pe-name"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  required
                  disabled={saving}
                  autoComplete="name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pe-id">Cédula</Label>
                <Input
                  id="pe-id"
                  value={form.idNumber}
                  onChange={(e) => setForm((f) => ({ ...f, idNumber: e.target.value }))}
                  required
                  disabled={saving}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pe-phone">Teléfono</Label>
                <Input
                  id="pe-phone"
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  required
                  disabled={saving}
                  inputMode="tel"
                />
              </div>
            </div>
            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={saving}
                onClick={() => setEditOpen(false)}
              >
                Cancelar
              </Button>
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
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
