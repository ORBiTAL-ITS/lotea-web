"use client";

import { useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { auth } from "@/shared/firebase/firebase-client";
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
import { useAppDispatch, useAppSelector } from "@/shared/store/hooks";
import { selectSessionUser } from "@/features/session/models/session-selectors";
import { setSessionUser } from "@/features/session/models/session-slice";
import { mapFirebaseUserToSession } from "@/features/session/services/session-service";
import {
  LOTEA_COMPANY_STORAGE_EVENT,
  useEffectiveCompanyId,
} from "@/features/session/hooks/use-effective-company-id";
import { createProject } from "../services/projects-service";
import { notifyProjectsUpdated } from "../projects-events";

export function QuickNewProjectButton() {
  const dispatch = useAppDispatch();
  const sessionUser = useAppSelector(selectSessionUser);
  const { companyId: effectiveCompanyId } = useEffectiveCompanyId(0);

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [lotCount, setLotCount] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isMaster = sessionUser?.globalRole === "master";
  const isViewer = sessionUser?.companyRole === "viewer";
  const isCompanyAdmin =
    sessionUser?.globalRole === "company_user" && sessionUser?.companyRole === "admin";
  const needsOrgBootstrap = !effectiveCompanyId && isCompanyAdmin;
  const showFab = isCompanyAdmin || (isMaster && Boolean(effectiveCompanyId));

  if (!sessionUser || isViewer || !showFab) return null;

  function reset() {
    setName("");
    setLotCount("");
    setError(null);
  }

  async function refreshSessionFromFirebase() {
    const u = auth.currentUser;
    if (!u) return;
    const tr = await u.getIdTokenResult(true);
    dispatch(setSessionUser(mapFirebaseUserToSession(u, tr.claims)));
    window.dispatchEvent(new Event(LOTEA_COMPANY_STORAGE_EVENT));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setError(null);

    const trimmedProject = name.trim();
    if (!trimmedProject) {
      setError("El nombre del proyecto es obligatorio.");
      return;
    }

    let lots: number | undefined;
    const lotStr = lotCount.trim();
    if (lotStr !== "") {
      const n = Number.parseInt(lotStr, 10);
      if (Number.isNaN(n) || n < 0) {
        setError("Si indicas lotes, debe ser un número mayor o igual a 0.");
        return;
      }
      lots = n;
    }

    setLoading(true);
    try {
      let cid = effectiveCompanyId;

      if (!cid && needsOrgBootstrap) {
        const u = auth.currentUser;
        if (!u) {
          setError("Sesión no válida. Vuelve a iniciar sesión.");
          setLoading(false);
          return;
        }
        const idToken = await u.getIdToken();
        const res = await fetch("/api/company/bootstrap", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify({}),
        });
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
          companyId?: string;
        };
        if (!res.ok) {
          throw new Error(data.error ?? "No se pudo preparar tu espacio de trabajo");
        }
        if (!data.companyId) {
          throw new Error("Respuesta inválida del servidor");
        }
        cid = data.companyId;
        await refreshSessionFromFirebase();
      }

      if (!cid) {
        throw new Error("No hay empresa activa. Si eres master, elige empresa en Proyectos.");
      }

      await createProject(cid, {
        name: trimmedProject,
        status: "active",
        ...(lots !== undefined ? { lotCount: lots } : {}),
      });

      reset();
      setOpen(false);
      notifyProjectsUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear el proyecto");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          reset();
          setOpen(true);
        }}
        title="Nuevo proyecto"
        aria-label="Nuevo proyecto"
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md ring-1 ring-primary/20 transition-[transform,box-shadow] hover:scale-105 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        <Plus className="h-5 w-5" strokeWidth={2.25} />
      </button>

      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!next && loading) return;
          setOpen(next);
          if (!next) reset();
        }}
      >
        <DialogContent className="sm:max-w-md" showCloseButton>
          <DialogHeader>
            <DialogTitle>Nuevo proyecto</DialogTitle>
            <DialogDescription>
              Nombre del proyecto obligatorio. Cantidad de lotes opcional (si la dejas vacía, queda en
              0).
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error ? (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            ) : null}
            <div className="space-y-2">
              <Label htmlFor="quick-proj-name">
                Nombre del proyecto <span className="text-destructive">*</span>
              </Label>
              <Input
                id="quick-proj-name"
                autoFocus
                placeholder="Ej. Parcelación Casa Real"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                disabled={loading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="quick-proj-lots">Cantidad de lotes (opcional)</Label>
              <Input
                id="quick-proj-lots"
                type="number"
                min={0}
                step={1}
                inputMode="numeric"
                placeholder="Ej. 120"
                value={lotCount}
                onChange={(e) => setLotCount(e.target.value)}
                disabled={loading}
              />
            </div>
            <DialogFooter className="gap-2 pt-2 sm:justify-end">
              <Button
                type="button"
                variant="outline"
                disabled={loading}
                onClick={() => {
                  reset();
                  setOpen(false);
                }}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Guardando…
                  </>
                ) : (
                  "Crear proyecto"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
