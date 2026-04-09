"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
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
import { Badge } from "@/components/ui/badge";
import type { Project } from "@/features/projects/models/project-types";
import type { Movement, MovementKind } from "../models/movement-types";
import { updateMovement } from "../services/movements-service";
import { notifyMovementsUpdated } from "../movements-events";
import {
  effectiveMovementTimestamp,
  formatMovementDay,
  formatMovementInvoice,
  moneyFmt,
} from "../utils/movements-display";
import {
  expenseAmountExceedsLotAvailable,
  lotLedgerForMovements,
} from "../utils/lot-ledger";
import { lotValueHintFromProjectIncomes } from "../utils/lot-value-hint";

function todayLocalISODate(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseLocalDateYmd(ymd: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim());
  if (!m) return null;
  const y = Number.parseInt(m[1]!, 10);
  const mo = Number.parseInt(m[2]!, 10);
  const day = Number.parseInt(m[3]!, 10);
  const dt = new Date(y, mo - 1, day, 12, 0, 0, 0);
  if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== day) return null;
  return dt;
}

function tsToLocalYmd(ts: ReturnType<typeof effectiveMovementTimestamp>): string {
  if (!ts?.seconds) return todayLocalISODate();
  const d = new Date(ts.seconds * 1000);
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${mo}-${day}`;
}

export type EditMovementDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
  projectId: string;
  project: Project;
  /** Movimientos del proyecto (para tope de egreso por lote). */
  projectMovements: Movement[];
  kind: MovementKind;
  movement: Movement | null;
  onSaved?: () => void;
};

export function EditMovementDialog({
  open,
  onOpenChange,
  companyId,
  projectId,
  project,
  projectMovements,
  kind,
  movement,
  onSaved,
}: EditMovementDialogProps) {
  const [loadingSubmit, setLoadingSubmit] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [concept, setConcept] = useState("");
  const [amountStr, setAmountStr] = useState("");
  const [dateStr, setDateStr] = useState(() => todayLocalISODate());
  const [linkedToLot, setLinkedToLot] = useState(false);
  const [lotStr, setLotStr] = useState("");
  const [lotValueStr, setLotValueStr] = useState("");

  const isIncome = kind === "income";

  useEffect(() => {
    if (!open || !movement) return;
    setError(null);
    setConcept(movement.concept);
    setAmountStr(String(movement.amount));
    setDateStr(tsToLocalYmd(effectiveMovementTimestamp(movement)));
    setLinkedToLot(movement.linkedToLot);
    setLotStr(
      movement.linkedToLot && movement.lotNumber !== null ? String(movement.lotNumber) : "",
    );
    if (isIncome && movement.linkedToLot && movement.lotNumber != null) {
      const lotNum = movement.lotNumber;
      const own = movement.lotValue != null && movement.lotValue > 0 ? movement.lotValue : null;
      if (own != null) {
        setLotValueStr(String(own));
      } else {
        const hinted = lotValueHintFromProjectIncomes(projectMovements, lotNum, {
          excludeMovementId: movement.id,
        });
        setLotValueStr(hinted != null ? String(hinted) : "");
      }
    } else {
      setLotValueStr("");
    }
    // projectMovements solo para sugerencia inicial; no incluir en deps para no resetear el formulario al refrescar el listado.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sincronizar solo al abrir / cambiar `movement`
  }, [open, movement, isIncome]);

  const previewAmount = useMemo(() => {
    const n = Number.parseFloat(amountStr.replace(",", "."));
    if (Number.isNaN(n) || n <= 0) return null;
    return n;
  }, [amountStr]);

  const previewLot =
    linkedToLot && lotStr.trim() !== "" ? Number.parseInt(lotStr.trim(), 10) : null;
  const previewLotValue = useMemo(() => {
    if (!isIncome || !linkedToLot) return null;
    const n = Number.parseFloat(lotValueStr.replace(",", "."));
    if (Number.isNaN(n) || n <= 0) return null;
    return n;
  }, [isIncome, linkedToLot, lotValueStr]);
  const parsedMovementDate = useMemo(() => parseLocalDateYmd(dateStr), [dateStr]);

  const expenseEditLedger = useMemo(() => {
    if (kind !== "expense" || !linkedToLot || !movement) return null;
    const n = previewLot;
    if (n === null || Number.isNaN(n) || n < 1 || n > project.lotCount) return null;
    return lotLedgerForMovements(projectMovements, n, { excludeMovementId: movement.id });
  }, [kind, linkedToLot, movement, previewLot, project.lotCount, projectMovements]);

  const previewVisible =
    Boolean(parsedMovementDate) ||
    concept.trim().length > 0 ||
    previewAmount !== null ||
    (linkedToLot && previewLot !== null && !Number.isNaN(previewLot)) ||
    linkedToLot ||
    previewLotValue !== null;

  const kindLabel = isIncome ? "Ingreso" : "Egreso";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loadingSubmit) return;
    setError(null);
    if (!movement) return;

    const trimmed = concept.trim();
    if (!trimmed) {
      setError("El concepto es obligatorio.");
      return;
    }
    const amount = Number.parseFloat(amountStr.replace(",", "."));
    if (Number.isNaN(amount) || amount <= 0) {
      setError("Indica un monto válido mayor que cero.");
      return;
    }
    const movementDate = parseLocalDateYmd(dateStr);
    if (!movementDate) {
      setError("Indica una fecha del movimiento válida.");
      return;
    }

    let linked = false;
    let lotNumber: number | null = null;
    let incomeLotValue: number | null = null;
    if (kind === "income" || kind === "expense") {
      linked = linkedToLot;
      if (linked) {
        const maxLot = Math.max(0, Math.floor(project.lotCount));
        if (maxLot < 1) {
          setError(
            "Este proyecto tiene 0 lotes. Edita el proyecto en Proyectos o desmarca «Asociar a un lote».",
          );
          return;
        }
        const parsedLot = Number.parseInt(lotStr.trim(), 10);
        if (!Number.isInteger(parsedLot) || parsedLot < 1 || parsedLot > maxLot) {
          setError(`Indica un número de lote entero entre 1 y ${maxLot}.`);
          return;
        }
        lotNumber = parsedLot;
        if (kind === "expense") {
          const ledger = lotLedgerForMovements(projectMovements, parsedLot, {
            excludeMovementId: movement.id,
          });
          if (expenseAmountExceedsLotAvailable(amount, ledger.available)) {
            setError(
              `Este egreso supera el saldo disponible del lote (${moneyFmt.format(ledger.available)}). Ingresos imputados al lote: ${moneyFmt.format(ledger.incomeTotal)}; otros egresos imputados: ${moneyFmt.format(ledger.expenseTotal)}.`,
            );
            return;
          }
        } else if (kind === "income") {
          const lv = Number.parseFloat(lotValueStr.replace(",", "."));
          if (Number.isFinite(lv) && lv > 0) {
            incomeLotValue = lv;
          }
        }
      }
    }

    setLoadingSubmit(true);
    try {
      await updateMovement(companyId, projectId, movement.id, {
        concept: trimmed,
        amount,
        kind,
        movementDate,
        projectLotCount: project.lotCount,
        ...(kind === "income" || kind === "expense"
          ? { linkedToLot: linked, lotNumber: linked ? lotNumber : null }
          : {}),
        ...(kind === "income" ? { lotValue: linked ? incomeLotValue : null } : {}),
      });
      onOpenChange(false);
      notifyMovementsUpdated();
      onSaved?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar el cambio.");
    } finally {
      setLoadingSubmit(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && loadingSubmit) return;
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-h-[min(92vh,720px)] w-[calc(100vw-2rem)] overflow-y-auto sm:max-w-xl lg:max-w-2xl" showCloseButton>
        <DialogHeader>
          <DialogTitle>Editar {isIncome ? "ingreso" : "egreso"}</DialogTitle>
          <DialogDescription>
            Modifica los datos del movimiento en{" "}
            <span className="font-medium text-foreground">{project.name}</span>. Tipo:{" "}
            <Badge variant={isIncome ? "default" : "destructive"} className="align-middle">
              {kindLabel}
            </Badge>
            .{" "}
            {movement ? (
              <span className="block pt-2 text-foreground">
                Factura:{" "}
                <span className="font-mono font-medium tabular-nums">
                  {formatMovementInvoice(movement)}
                </span>
                {movement.invoiceNumber == null ? (
                  <span className="block text-xs font-normal text-muted-foreground">
                    Puedes asignar números con «Facturas antiguas» en el listado del proyecto.
                  </span>
                ) : null}
              </span>
            ) : null}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="edit-mov-date">
              Fecha del movimiento <span className="text-destructive">*</span>
            </Label>
            <Input
              id="edit-mov-date"
              type="date"
              value={dateStr}
              onChange={(e) => setDateStr(e.target.value)}
              className="h-10 max-w-[11rem]"
              required
              disabled={!movement || loadingSubmit}
            />
          </div>

          {movement ? (
            <div className="space-y-3 rounded-lg border border-border/80 bg-muted/20 px-3 py-3">
              <div className="flex items-start gap-3">
                <input
                  id="edit-mov-linked-lot"
                  type="checkbox"
                  aria-label={
                    isIncome ? "Asociar este ingreso a un lote" : "Imputar este egreso a un lote"
                  }
                  checked={linkedToLot}
                  disabled={loadingSubmit}
                  onChange={(e) => {
                    const on = e.target.checked;
                    setLinkedToLot(on);
                    if (!on) {
                      setLotStr("");
                      setLotValueStr("");
                    }
                  }}
                  className="mt-1 size-4 shrink-0 rounded border-input accent-primary disabled:opacity-50"
                />
                <div className="min-w-0 flex-1 space-y-1">
                  <Label
                    htmlFor="edit-mov-linked-lot"
                    className="cursor-pointer font-medium leading-snug"
                  >
                    {isIncome
                      ? "Asociar este ingreso a un lote"
                      : "Imputar este egreso a un lote"}
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    {isIncome
                      ? "Si no marcas, el ingreso queda como general del proyecto."
                      : "Si no marcas, el egreso es general. Si imputas a un lote, el monto no puede superar el saldo de ese lote."}
                  </p>
                </div>
              </div>
                  {linkedToLot ? (
                <div className="space-y-2 pt-1">
                  <Label htmlFor="edit-mov-lot">
                    Número de lote <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="edit-mov-lot"
                    inputMode="numeric"
                    placeholder={
                      project.lotCount >= 1 ? `1 – ${project.lotCount}` : "Define lotes en el proyecto"
                    }
                    value={lotStr}
                    onChange={(e) => {
                      const v = e.target.value.replace(/\D/g, "");
                      setLotStr(v);
                      if (!isIncome || !movement) return;
                      const n = Number.parseInt(v.trim(), 10);
                      const maxLot = Math.max(0, Math.floor(project.lotCount));
                      if (!Number.isInteger(n) || n < 1 || n > maxLot) {
                        setLotValueStr("");
                        return;
                      }
                      const hinted = lotValueHintFromProjectIncomes(projectMovements, n, {
                        excludeMovementId: movement.id,
                      });
                      setLotValueStr(hinted != null ? String(hinted) : "");
                    }}
                    autoComplete="off"
                    disabled={project.lotCount < 1 || loadingSubmit}
                  />
                  {isIncome ? (
                    <div className="space-y-2 pt-1">
                      <Label htmlFor="edit-mov-lot-value">Valor del lote (opcional)</Label>
                      <Input
                        id="edit-mov-lot-value"
                        inputMode="decimal"
                        placeholder="Se rellena solo si ya hay otro ingreso a este lote con valor"
                        value={lotValueStr}
                        onChange={(e) => setLotValueStr(e.target.value)}
                        autoComplete="off"
                        disabled={project.lotCount < 1 || loadingSubmit}
                      />
                      <p className="text-xs text-muted-foreground">
                        Suele registrarse una sola vez por lote; al cambiar el número se sugiere el último
                        valor guardado para ese lote en el proyecto.
                      </p>
                    </div>
                  ) : null}
                  {!isIncome && linkedToLot && project.lotCount >= 1 ? (
                    <div className="space-y-2 rounded-md border border-border/70 bg-background/80 px-3 py-2 text-xs">
                      {expenseEditLedger ? (
                        <>
                          <p className="font-medium text-foreground">
                            Resumen lote {previewLot} (sin contar este egreso)
                          </p>
                          <ul className="list-inside list-disc space-y-0.5 text-muted-foreground">
                            <li>
                              Total ingresos al lote:{" "}
                              <span className="font-medium tabular-nums text-foreground">
                                {moneyFmt.format(expenseEditLedger.incomeTotal)}
                              </span>
                            </li>
                            <li>
                              Otros egresos imputados al lote:{" "}
                              <span className="font-medium tabular-nums text-foreground">
                                {moneyFmt.format(expenseEditLedger.expenseTotal)}
                              </span>
                            </li>
                            <li>
                              <span className="text-foreground">Disponible para este registro:</span>{" "}
                              <span
                                className={
                                  expenseEditLedger.available < 0
                                    ? "font-semibold tabular-nums text-destructive"
                                    : "font-semibold tabular-nums text-foreground"
                                }
                              >
                                {moneyFmt.format(expenseEditLedger.available)}
                              </span>
                            </li>
                          </ul>
                          {previewAmount !== null &&
                          expenseAmountExceedsLotAvailable(
                            previewAmount,
                            expenseEditLedger.available,
                          ) ? (
                            <p className="text-destructive" role="status">
                              El monto supera el disponible (
                              {moneyFmt.format(expenseEditLedger.available)}).
                            </p>
                          ) : null}
                        </>
                      ) : (
                        <p className="text-muted-foreground">
                          Indica un número de lote válido para ver el saldo disponible.
                        </p>
                      )}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="edit-mov-concept">Concepto</Label>
              <Input
                id="edit-mov-concept"
                value={concept}
                onChange={(e) => setConcept(e.target.value)}
                autoComplete="off"
                disabled={!movement || loadingSubmit}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="edit-mov-amount">Monto</Label>
              <Input
                id="edit-mov-amount"
                inputMode="decimal"
                value={amountStr}
                onChange={(e) => setAmountStr(e.target.value)}
                autoComplete="off"
                disabled={!movement || loadingSubmit}
              />
            </div>
          </div>

          <AnimatePresence initial={false}>
            {previewVisible ? (
              <motion.div
                key="preview"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                className="overflow-hidden rounded-lg border border-primary/20 bg-primary/5 px-3 py-2"
              >
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Vista previa
                </p>
                {parsedMovementDate ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Fecha:{" "}
                    <span className="font-medium text-foreground">
                      {formatMovementDay({
                        seconds: Math.floor(parsedMovementDate.getTime() / 1000),
                        nanoseconds: 0,
                      })}
                    </span>
                  </p>
                ) : null}
                <p className="mt-1 text-sm font-medium text-foreground">
                  {concept.trim() || "Sin concepto"}
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-sm">
                  <span className="tabular-nums text-foreground">
                    {previewAmount !== null ? moneyFmt.format(previewAmount) : "—"}
                  </span>
                  <Badge variant={isIncome ? "default" : "destructive"}>{kindLabel}</Badge>
                  {linkedToLot ? (
                    previewLot !== null &&
                    !Number.isNaN(previewLot) &&
                    previewLot >= 1 &&
                    previewLot <= project.lotCount ? (
                      <span className="text-muted-foreground tabular-nums">
                        · Lote {previewLot}
                        {isIncome && previewLotValue !== null
                          ? ` · Valor lote ${moneyFmt.format(previewLotValue)}`
                          : ""}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">· Lote (indica número)</span>
                    )
                  ) : isIncome ? (
                    <span className="text-muted-foreground">· Ingreso general</span>
                  ) : (
                    <span className="text-muted-foreground">· Egreso general</span>
                  )}
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>

          <DialogFooter className="gap-2 pt-1 sm:justify-end">
            <Button
              type="button"
              variant="outline"
              disabled={loadingSubmit}
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={loadingSubmit || !movement}>
              {loadingSubmit ? (
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
  );
}
