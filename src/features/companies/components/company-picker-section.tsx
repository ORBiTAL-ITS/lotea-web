"use client";

/**
 * Solo para usuario **master**: elegir o crear empresa en esta sesión.
 * Los administradores de empresa no deben ver este bloque en Proyectos.
 */

import { useCallback, useEffect, useState } from "react";
import { Building2, Loader2, Plus } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MagicCard } from "@/components/ui/magic-card";
import { BorderBeam } from "@/components/ui/border-beam";
import { useAppSelector } from "@/shared/store/hooks";
import { selectSessionUser } from "@/features/session/models/session-selectors";
import { cn } from "@/lib/utils";
import type { Company } from "../models/company-types";
import { createCompany, fetchAccessibleCompanies } from "../services/companies-service";
import { setStoredCompanyId } from "@/features/session/hooks/use-effective-company-id";

const ease = [0.22, 1, 0.36, 1] as const;

type Props = {
  onCompanySelected: () => void;
  revision: number;
};

export function CompanyPickerSection({ onCompanySelected, revision }: Props) {
  const user = useAppSelector(selectSessionUser);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) {
      setCompanies([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      setCompanies(await fetchAccessibleCompanies(user));
    } catch {
      setCompanies([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void load();
  }, [load, revision]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (creating) return;
    if (!user) return;
    setCreateError(null);
    setCreating(true);
    try {
      const id = await createCompany(newName, user.uid);
      setNewName("");
      await load();
      setStoredCompanyId(id);
      onCompanySelected();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "No se pudo crear la empresa");
    } finally {
      setCreating(false);
    }
  }

  function pickCompany(id: string) {
    setStoredCompanyId(id);
    onCompanySelected();
  }

  return (
    <div className="space-y-8">
      <div className="rounded-xl border border-border/80 bg-card/50 p-4 shadow-sm backdrop-blur-sm sm:p-5">
        <h2 className="font-heading text-base font-semibold text-foreground">
          Empresa con la que trabajarás
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Elige una empresa o crea una nueva. Después podrás usar proyectos y el resto del menú con el
          botón <span className="font-semibold text-foreground">+</span> del encabezado.
        </p>
      </div>

      <form
        onSubmit={handleCreate}
        className="rounded-xl border border-border bg-card p-4 shadow-sm sm:p-5"
      >
        <div className="flex items-center gap-2 text-foreground">
          <Plus className="h-4 w-4 text-primary" />
          <h3 className="font-heading text-sm font-semibold">Nueva empresa</h3>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">Nombre comercial de la organización.</p>
        {createError ? (
          <p className="mt-2 text-sm text-destructive" role="alert">
            {createError}
          </p>
        ) : null}
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-1.5">
            <Label htmlFor="new-company-name">Nombre</Label>
            <Input
              id="new-company-name"
              placeholder="Ej. Constructora Lotea S.A.S."
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              disabled={creating}
            />
          </div>
          <Button type="submit" disabled={creating || !newName.trim()}>
            {creating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creando…
              </>
            ) : (
              "Crear empresa"
            )}
          </Button>
        </div>
      </form>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Cargando empresas…
        </div>
      ) : companies.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Aún no hay empresas. Puedes registrar la primera con el formulario de arriba.
        </p>
      ) : (
        <div>
          <p className="mb-3 text-sm font-medium text-foreground">Empresas disponibles</p>
          <ul className="grid gap-4 sm:grid-cols-2">
            {companies.map((c, index) => (
              <li key={c.id}>
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.04, ease }}
                  className="relative"
                >
                  <button
                    type="button"
                    disabled={creating}
                    onClick={() => pickCompany(c.id)}
                    className={cn(
                      "group relative w-full rounded-xl border border-border/70 bg-transparent p-px text-left shadow-sm transition-shadow duration-200",
                      "hover:border-primary/35 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                      creating && "pointer-events-none opacity-60",
                    )}
                  >
                    <MagicCard
                      className="rounded-xl"
                      gradientSize={160}
                      gradientFrom="oklch(0.52 0.08 198 / 0.22)"
                      gradientTo="oklch(0.42 0.06 230 / 0.12)"
                    >
                      <div className="rounded-xl bg-card/95 px-4 py-4 backdrop-blur-sm dark:bg-card/90">
                        <div className="flex items-start gap-3">
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/12 text-primary">
                            <Building2 className="h-5 w-5" strokeWidth={1.75} />
                          </span>
                          <div className="min-w-0">
                            <p className="font-heading truncate text-sm font-semibold text-foreground">
                              {c.name}
                            </p>
                            <p className="mt-2 text-xs font-medium text-primary/90 opacity-0 transition-opacity group-hover:opacity-100">
                              Trabajar en esta empresa →
                            </p>
                          </div>
                        </div>
                      </div>
                    </MagicCard>
                    <BorderBeam
                      size={48}
                      duration={12}
                      borderWidth={1}
                      colorFrom="oklch(0.52 0.1 198)"
                      colorTo="oklch(0.58 0.08 205)"
                      className="opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-focus-visible:opacity-100"
                    />
                  </button>
                </motion.div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
