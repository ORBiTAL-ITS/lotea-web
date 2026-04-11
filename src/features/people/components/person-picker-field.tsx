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
import type { Person } from "../models/person-types";
import { createPerson, fetchPeople } from "../services/people-service";

export type PersonPickerValue = { id: string; name: string };

export type PersonPickerFieldProps = {
  companyId: string;
  value: PersonPickerValue | null;
  onChange: (next: PersonPickerValue | null) => void;
  disabled?: boolean;
  /** id del control visible (accesibilidad). */
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

export function PersonPickerField({
  companyId,
  value,
  onChange,
  disabled,
  id = "person-picker",
  required,
}: PersonPickerFieldProps) {
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [newOpen, setNewOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [newIdNumber, setNewIdNumber] = useState("");
  const [newPhone, setNewPhone] = useState("");

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const list = await fetchPeople(companyId);
      setPeople(list);
    } catch {
      setPeople([]);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = normalize(search);
    if (!q) return people;
    return people.filter((p) => {
      const hay = normalize([p.name, p.idNumber, p.phone].join(" "));
      return hay.includes(q);
    });
  }, [people, search]);

  async function handleCreatePerson(e: React.FormEvent) {
    e.preventDefault();
    if (creating) return;
    setFormError(null);
    setCreating(true);
    try {
      const pid = await createPerson(companyId, {
        name: newName,
        idNumber: newIdNumber,
        phone: newPhone,
      });
      const name = newName.trim();
      onChange({ id: pid, name });
      setNewOpen(false);
      setNewName("");
      setNewIdNumber("");
      setNewPhone("");
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "No se pudo crear la persona.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <Label htmlFor={id} className="text-foreground">
          Persona vinculada al lote
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
          Nueva persona
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Quien figura en este movimiento imputado a lote (nombre en comprobantes y listados).
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
          placeholder="Buscar por nombre, cédula o teléfono…"
          disabled={disabled || loading}
          className="h-10 pl-9"
          autoComplete="off"
        />
      </div>

      {value ? (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-primary/25 bg-primary/5 px-3 py-2 text-sm">
          <span className="font-medium text-foreground">{value.name}</span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-muted-foreground"
            disabled={disabled}
            onClick={() => onChange(null)}
          >
            Quitar selección
          </Button>
        </div>
      ) : null}

      <div className="max-h-[220px] overflow-y-auto rounded-lg border border-border/80 bg-background/80">
        {loading ? (
          <div className="flex items-center gap-2 px-3 py-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Cargando personas…
          </div>
        ) : filtered.length === 0 ? (
          <p className="px-3 py-6 text-center text-sm text-muted-foreground">
            {people.length === 0
              ? "Aún no hay personas registradas. Usa «Nueva persona»."
              : "Ningún resultado. Prueba otra búsqueda."}
          </p>
        ) : (
          <ul className="divide-y divide-border/60 p-1">
            {filtered.map((p) => {
              const selected = value?.id === p.id;
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => onChange({ id: p.id, name: p.name })}
                    className={
                      selected
                        ? "w-full rounded-md bg-primary/12 px-3 py-2.5 text-left text-sm transition-colors"
                        : "w-full rounded-md px-3 py-2.5 text-left text-sm transition-colors hover:bg-muted/80"
                    }
                  >
                    <span className="font-medium text-foreground">{p.name}</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      CC {p.idNumber} · {p.phone}
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
          <form onSubmit={handleCreatePerson}>
            <DialogHeader>
              <DialogTitle>Nueva persona</DialogTitle>
              <DialogDescription>
                Quedará guardada en el catálogo de la empresa para reutilizarla en otros movimientos.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-3 py-2">
              {formError ? (
                <p className="text-sm text-destructive" role="alert">
                  {formError}
                </p>
              ) : null}
              <div className="space-y-2">
                <Label htmlFor="new-person-name">Nombre completo</Label>
                <Input
                  id="new-person-name"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Ej. María López"
                  required
                  disabled={creating}
                  autoComplete="name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-person-id">Cédula</Label>
                <Input
                  id="new-person-id"
                  value={newIdNumber}
                  onChange={(e) => setNewIdNumber(e.target.value)}
                  placeholder="Documento de identidad"
                  required
                  disabled={creating}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-person-phone">Teléfono</Label>
                <Input
                  id="new-person-phone"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  placeholder="Celular o fijo"
                  required
                  disabled={creating}
                  inputMode="tel"
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
                  "Guardar persona"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
