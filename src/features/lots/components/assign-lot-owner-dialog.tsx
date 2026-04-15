"use client";

import { useState } from "react";
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
import { PersonPickerField, type PersonPickerValue } from "@/features/people/components/person-picker-field";
import type { Lot } from "../models/lot-types";
import { assignLotOwner } from "../services/lots-service";

export type AssignLotOwnerDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
  projectId: string;
  lot: Lot | null;
  onAssigned: () => void | Promise<void>;
};

export function AssignLotOwnerDialog({
  open,
  onOpenChange,
  companyId,
  projectId,
  lot,
  onAssigned,
}: AssignLotOwnerDialogProps) {
  const [person, setPerson] = useState<PersonPickerValue | null>(null);
  const [declaredLotValueStr, setDeclaredLotValueStr] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleClose(next: boolean) {
    if (saving) return;
    if (!next) {
      setPerson(null);
      setDeclaredLotValueStr("");
      setError(null);
    }
    onOpenChange(next);
  }

  async function submit() {
    if (!lot || !person?.id?.trim() || !person.name?.trim()) {
      setError("Elige una persona del catálogo.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      let declaredLotValue: number | null = null;
      const raw = declaredLotValueStr.replace(",", ".").trim();
      if (raw) {
        const n = Number.parseFloat(raw);
        if (!Number.isFinite(n) || n <= 0) {
          setError("El valor del lote debe ser un número mayor que cero.");
          setSaving(false);
          return;
        }
        declaredLotValue = n;
      }
      await assignLotOwner(
        companyId,
        projectId,
        lot.id,
        { id: person.id.trim(), name: person.name.trim() },
        declaredLotValue != null ? { declaredLotValue } : undefined,
      );
      setPerson(null);
      setDeclaredLotValueStr("");
      onOpenChange(false);
      await onAssigned();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo asignar el titular.");
    } finally {
      setSaving(false);
    }
  }

  const hasOwner =
    Boolean(typeof lot?.currentOwnerId === "string" && lot.currentOwnerId.trim()) ||
    Boolean((lot?.currentOwnerName ?? "").trim());

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Asignar titular del lote</DialogTitle>
          <DialogDescription>
            Una misma persona puede tener varios lotes: elige el cliente en el catálogo. Los pagos e historial se
            imputan con el movimiento vinculado a esta persona y a este número de lote.
          </DialogDescription>
        </DialogHeader>
        {hasOwner ? (
          <p className="text-sm text-amber-700 dark:text-amber-400">
            Este lote ya tiene titular registrado. Para cambiarlo usa la cesión (traspaso) desde el menú del lote.
          </p>
        ) : (
          <div className="space-y-2">
            <PersonPickerField
              id="assign-lot-person"
              companyId={companyId}
              value={person}
              onChange={setPerson}
              disabled={saving}
              required
            />
            {lot ? (
              <p className="text-xs text-muted-foreground">
                Lote <span className="font-mono font-medium tabular-nums">{lot.lotNumber}</span>
              </p>
            ) : null}
            <div className="space-y-2 pt-1">
              <Label htmlFor="assign-lot-value">Valor del lote (opcional)</Label>
              <Input
                id="assign-lot-value"
                inputMode="decimal"
                placeholder="Ej. 45000000"
                value={declaredLotValueStr}
                onChange={(e) => setDeclaredLotValueStr(e.target.value)}
                autoComplete="off"
                disabled={saving}
              />
              <p className="text-xs text-muted-foreground">
                Referencia del precio o valor acordado; puedes completarlo luego si lo dejas vacío.
              </p>
            </div>
          </div>
        )}
        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}
        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" disabled={saving} onClick={() => handleClose(false)}>
            Cancelar
          </Button>
          <Button type="button" disabled={saving || hasOwner || !lot} onClick={() => void submit()}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Guardar titular
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
