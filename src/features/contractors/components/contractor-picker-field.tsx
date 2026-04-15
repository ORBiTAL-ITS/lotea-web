"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Search, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import type { Contractor } from "../models/contractor-types";
import { createContractor, fetchContractors } from "../services/contractors-service";

export type ContractorPickerValue = { id: string; name: string; phone: string };

export type ContractorPickerFieldProps = {
  companyId: string;
  value: ContractorPickerValue | null;
  onChange: (next: ContractorPickerValue | null) => void;
  disabled?: boolean;
  id?: string;
  required?: boolean;
};

function normalize(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .trim();
}

export function ContractorPickerField({
  companyId,
  value,
  onChange,
  disabled,
  id = "contractor-picker",
  required,
}: ContractorPickerFieldProps) {
  const [rows, setRows] = useState<Contractor[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [newOpen, setNewOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const list = await fetchContractors(companyId);
      setRows(list);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = normalize(search);
    if (!q) return rows;
    return rows.filter((c) => {
      const hay = normalize([c.name, c.phone].join(" "));
      return hay.includes(q);
    });
  }, [rows, search]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (creating) return;
    setFormError(null);
    setCreating(true);
    try {
      const cid = await createContractor(companyId, {
        name: newName,
        phone: newPhone.trim() || undefined,
      });
      const name = newName.trim();
      const phone = newPhone.trim();
      onChange({ id: cid, name, phone });
      setNewOpen(false);
      setNewName("");
      setNewPhone("");
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "No se pudo crear el contratista.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <Label htmlFor={id} className="text-foreground">
          Contratista o trabajador
          {required ? <span className="text-destructive"> *</span> : null}
        </Label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 gap-1"
          disabled={disabled || loading}
          onClick={() => {
            setFormError(null);
            setNewOpen(true);
          }}
        >
          <UserPlus className="h-3.5 w-3.5" aria-hidden />
          Nuevo
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Catálogo propio de contratistas (nombre y teléfono opcional). No requiere cédula.
      </p>

      <div className="relative">
        <Search
          className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          id={id ? `${id}-search` : undefined}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nombre o teléfono…"
          disabled={disabled || loading}
          className="h-10 pl-9"
          autoComplete="off"
        />
      </div>

      {value ? (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-primary/25 bg-primary/5 px-3 py-2 text-sm">
          <span className="font-medium text-foreground">{value.name}</span>
          {value.phone ? (
            <span className="text-xs text-muted-foreground tabular-nums">{value.phone}</span>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-muted-foreground"
            disabled={disabled}
            onClick={() => onChange(null)}
          >
            Quitar
          </Button>
        </div>
      ) : null}

      <div className="max-h-[200px] overflow-y-auto rounded-lg border border-border/80 bg-background/80">
        {loading ? (
          <div className="flex items-center gap-2 px-3 py-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Cargando…
          </div>
        ) : filtered.length === 0 ? (
          <p className="px-3 py-6 text-center text-sm text-muted-foreground">
            {rows.length === 0
              ? "Aún no hay contratistas. Usa «Nuevo»."
              : "Ningún resultado. Prueba otra búsqueda."}
          </p>
        ) : (
          <ul className="divide-y divide-border/60 p-1">
            {filtered.map((c) => {
              const selected = value?.id === c.id;
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() =>
                      onChange({ id: c.id, name: c.name, phone: c.phone })
                    }
                    className={
                      selected
                        ? "w-full rounded-md bg-primary/12 px-3 py-2.5 text-left text-sm transition-colors"
                        : "w-full rounded-md px-3 py-2.5 text-left text-sm transition-colors hover:bg-muted/80"
                    }
                  >
                    <span className="font-medium text-foreground">{c.name}</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {c.phone ? c.phone : "Sin teléfono"}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent className="sm:max-w-md" showCloseButton>
          <form onSubmit={handleCreate}>
            <DialogHeader>
              <DialogTitle>Nuevo contratista</DialogTitle>
              <DialogDescription>
                Quedará en el catálogo de la empresa para elegirlo en pagos a trabajador sin escribir el nombre cada
                vez.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-3 py-2">
              {formError ? (
                <p className="text-sm text-destructive" role="alert">
                  {formError}
                </p>
              ) : null}
              <div className="space-y-2">
                <Label htmlFor="new-contractor-name">
                  Nombre <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="new-contractor-name"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Ej. Constructora XY"
                  required
                  disabled={creating}
                  autoComplete="name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-contractor-phone">Teléfono (opcional)</Label>
                <Input
                  id="new-contractor-phone"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  placeholder="Celular o fijo"
                  disabled={creating}
                  inputMode="tel"
                  autoComplete="tel"
                />
              </div>
            </div>
            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" disabled={creating} onClick={() => setNewOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={creating}>
                {creating ? (
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
    </div>
  );
}
