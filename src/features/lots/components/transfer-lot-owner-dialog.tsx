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
import { transferLotOwner } from "../services/lots-service";

export type TransferLotOwnerDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
  projectId: string;
  lot: Lot | null;
  onTransferred: () => void | Promise<void>;
};

export function TransferLotOwnerDialog({
  open,
  onOpenChange,
  companyId,
  projectId,
  lot,
  onTransferred,
}: TransferLotOwnerDialogProps) {
  const [toPerson, setToPerson] = useState<PersonPickerValue | null>(null);
  const [dateStr, setDateStr] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fromId = lot?.currentOwnerId?.trim() ?? "";

  function handleClose(next: boolean) {
    if (saving) return;
    if (!next) {
      setToPerson(null);
      setDateStr("");
      setNotes("");
      setError(null);
    }
    onOpenChange(next);
  }

  async function submit() {
    if (!lot || !fromId) {
      setError("El lote no tiene titular actual.");
      return;
    }
    if (!toPerson?.id?.trim() || !toPerson.name?.trim()) {
      setError("Elige al cesionario en el catálogo.");
      return;
    }
    if (toPerson.id.trim() === fromId) {
      setError("El cesionario debe ser distinto al cedente.");
      return;
    }
    if (!dateStr.trim()) {
      setError("Indica la fecha del traspaso.");
      return;
    }
    const d = new Date(`${dateStr}T12:00:00`);
    if (Number.isNaN(d.getTime())) {
      setError("Fecha no válida.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await transferLotOwner(companyId, projectId, lot.id, fromId, { id: toPerson.id.trim(), name: toPerson.name.trim() }, d, notes.trim() || undefined);
      setToPerson(null);
      setDateStr("");
      setNotes("");
      onOpenChange(false);
      await onTransferred();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo registrar la cesión.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Cesión de lote (traspaso)</DialogTitle>
          <DialogDescription>
            Registra el cambio de titular. El historial imprimible por persona solo incluirá movimientos del periodo en
            que esa persona figuró como titular en este lote.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {lot ? (
            <p className="text-sm text-muted-foreground">
              Lote <span className="font-mono font-medium tabular-nums text-foreground">{lot.lotNumber}</span>
              {lot.currentOwnerName ? (
                <>
                  {" "}
                  · cedente: <span className="font-medium text-foreground">{lot.currentOwnerName}</span>
                </>
              ) : null}
            </p>
          ) : null}
          <PersonPickerField
            id="transfer-lot-to-person"
            companyId={companyId}
            value={toPerson}
            onChange={setToPerson}
            disabled={saving || !fromId}
            required
          />
          <div className="space-y-2">
            <Label htmlFor="transfer-lot-date">Fecha del traspaso</Label>
            <Input
              id="transfer-lot-date"
              type="date"
              value={dateStr}
              onChange={(e) => setDateStr(e.target.value)}
              disabled={saving}
              className="h-10"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="transfer-lot-notes">Notas (opcional)</Label>
            <Input
              id="transfer-lot-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={saving}
              placeholder="Ej. escritura, observaciones…"
            />
          </div>
        </div>
        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}
        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" disabled={saving} onClick={() => handleClose(false)}>
            Cancelar
          </Button>
          <Button type="button" disabled={saving || !lot || !fromId} onClick={() => void submit()}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Registrar cesión
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
