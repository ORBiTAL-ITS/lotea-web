"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
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
import type { Project } from "../models/project-types";
import { updateProject } from "../services/projects-service";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
  project: Project | null;
  onSaved: () => void;
};

export function EditProjectDialog({ open, onOpenChange, companyId, project, onSaved }: Props) {
  const [name, setName] = useState("");
  const [lotCount, setLotCount] = useState("0");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!project) return;
    setName(project.name);
    setLotCount(String(project.lotCount));
    setError(null);
  }, [project]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    if (!project) return;
    setError(null);
    const lots = Number.parseInt(lotCount, 10);
    if (Number.isNaN(lots) || lots < 0) {
      setError("Indica un número de lotes válido (0 o mayor).");
      return;
    }
    setLoading(true);
    try {
      await updateProject(companyId, project.id, {
        name: name.trim(),
        lotCount: lots,
      });
      onSaved();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && loading) return;
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-md" showCloseButton>
        <DialogHeader>
          <DialogTitle>Editar proyecto</DialogTitle>
          <DialogDescription>
            Nombre y cantidad de lotes. El código ({project?.code}) no se modifica aquí.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
          <div className="space-y-2">
            <Label htmlFor="edit-proj-name">Nombre</Label>
            <Input
              id="edit-proj-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              disabled={loading}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-proj-lots">Cantidad de lotes</Label>
            <Input
              id="edit-proj-lots"
              type="number"
              min={0}
              step={1}
              inputMode="numeric"
              value={lotCount}
              onChange={(e) => setLotCount(e.target.value)}
              required
              disabled={loading}
            />
          </div>
          <DialogFooter className="gap-2 sm:justify-end">
            <Button type="button" variant="outline" disabled={loading} onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? (
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
  );
}
