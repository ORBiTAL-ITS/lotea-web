"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Plus } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAppSelector } from "@/shared/store/hooks";
import { selectSessionUser } from "@/features/session/models/session-selectors";
import { fetchProjects } from "@/features/projects/services/projects-service";
import type { Project } from "@/features/projects/models/project-types";
import type { Movement, MovementKind } from "../models/movement-types";
import { createMovement, fetchMovements } from "../services/movements-service";
import { notifyMovementsUpdated } from "../movements-events";
import { formatMovementDay, moneyFmt } from "../utils/movements-display";
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

export type QuickNewMovementButtonProps = {
  companyId: string;
  /** En esta pantalla solo se registran ingresos o solo egresos. */
  kind: MovementKind;
  onCreated?: () => void;
  /** Si la página ya tiene proyecto tras «Buscar información», se preselecciona aquí. */
  pageProjectId?: string | null;
  pageLoadedProject?: Project | null;
  /** Movimientos ya cargados en la página (mismo proyecto que `syncedProjectId`) para validar egresos por lote sin otra lectura. */
  syncedProjectId?: string | null;
  syncedProjectMovements?: Movement[];
};

export function QuickNewMovementButton({
  companyId,
  kind,
  onCreated,
  pageProjectId,
  pageLoadedProject,
  syncedProjectId,
  syncedProjectMovements,
}: QuickNewMovementButtonProps) {
  const sessionUser = useAppSelector(selectSessionUser);

  const [open, setOpen] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [modalProjectId, setModalProjectId] = useState<string | null>(null);
  const [loadingSubmit, setLoadingSubmit] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [concept, setConcept] = useState("");
  const [amountStr, setAmountStr] = useState("");
  const [dateStr, setDateStr] = useState(() => todayLocalISODate());
  const [linkedToLot, setLinkedToLot] = useState(false);
  /** Ingresos con lote: número entero 1..project.lotCount */
  const [lotStr, setLotStr] = useState("");
  const [lotValueStr, setLotValueStr] = useState("");
  const [modalProjectMovements, setModalProjectMovements] = useState<Movement[]>([]);
  const [loadingModalProjectMovements, setLoadingModalProjectMovements] = useState(false);

  const isMaster = sessionUser?.globalRole === "master";
  const isViewer = sessionUser?.companyRole === "viewer";
  const isCompanyAdmin =
    sessionUser?.globalRole === "company_user" && sessionUser?.companyRole === "admin";
  const showFab = isCompanyAdmin || isMaster;

  const modalProject = useMemo(
    () => projects.find((p) => p.id === modalProjectId) ?? null,
    [projects, modalProjectId],
  );

  const loadProjects = useCallback(async () => {
    setLoadingProjects(true);
    try {
      setProjects(await fetchProjects(companyId));
    } catch {
      setProjects([]);
    } finally {
      setLoadingProjects(false);
    }
  }, [companyId]);

  useEffect(() => {
    if (!open || !companyId) return;
    void loadProjects();
  }, [open, companyId, loadProjects]);

  useEffect(() => {
    if (!open) return;
    if (pageProjectId && projects.some((p) => p.id === pageProjectId)) {
      setModalProjectId(pageProjectId);
    }
  }, [open, pageProjectId, projects]);

  useEffect(() => {
    if (!open || !companyId || !modalProjectId) {
      setModalProjectMovements([]);
      setLoadingModalProjectMovements(false);
      return;
    }
    if (syncedProjectId === modalProjectId && syncedProjectMovements) {
      setModalProjectMovements(syncedProjectMovements);
      setLoadingModalProjectMovements(false);
      return;
    }
    let cancelled = false;
    setLoadingModalProjectMovements(true);
    void fetchMovements(companyId, modalProjectId)
      .then((list) => {
        if (!cancelled) setModalProjectMovements(list);
      })
      .catch(() => {
        if (!cancelled) setModalProjectMovements([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingModalProjectMovements(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, companyId, modalProjectId, syncedProjectId, syncedProjectMovements]);

  const isIncome = kind === "income";

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

  const expenseLotLedger = useMemo(() => {
    if (kind !== "expense" || !linkedToLot || !modalProject) return null;
    const n = previewLot;
    if (n === null || Number.isNaN(n) || n < 1 || n > modalProject.lotCount) return null;
    return lotLedgerForMovements(modalProjectMovements, n);
  }, [kind, linkedToLot, modalProject, previewLot, modalProjectMovements]);

  const previewVisible =
    Boolean(parsedMovementDate) ||
    concept.trim().length > 0 ||
    previewAmount !== null ||
    (linkedToLot && previewLot !== null && !Number.isNaN(previewLot)) ||
    linkedToLot ||
    previewLotValue !== null;

  function resetForm() {
    setDateStr(todayLocalISODate());
    setConcept("");
    setAmountStr("");
    setLinkedToLot(false);
    setLotStr("");
    setLotValueStr("");
    setError(null);
    setModalProjectId(null);
  }

  if (!sessionUser || isViewer || !showFab) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loadingSubmit) return;
    setError(null);
    if (!modalProjectId) {
      setError("Selecciona el proyecto al que aplicará este registro.");
      return;
    }
    const proj = projects.find((p) => p.id === modalProjectId);
    if (!proj) {
      setError("Proyecto no válido.");
      return;
    }
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
        const maxLot = Math.max(0, Math.floor(proj.lotCount));
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
          const ledger = lotLedgerForMovements(modalProjectMovements, parsedLot);
          if (expenseAmountExceedsLotAvailable(amount, ledger.available)) {
            setError(
              `Este egreso supera el saldo disponible del lote (${moneyFmt.format(ledger.available)}). Ingresos imputados al lote: ${moneyFmt.format(ledger.incomeTotal)}; egresos ya imputados: ${moneyFmt.format(ledger.expenseTotal)}.`,
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
      await createMovement(companyId, modalProjectId, {
        concept: trimmed,
        amount,
        kind,
        movementDate,
        projectLotCount: proj.lotCount,
        ...(kind === "income" || kind === "expense"
          ? { linkedToLot: linked, lotNumber: linked ? lotNumber : null }
          : {}),
        ...(kind === "income" ? { lotValue: linked ? incomeLotValue : null } : {}),
      });
      resetForm();
      setOpen(false);
      notifyMovementsUpdated();
      onCreated?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar el movimiento.");
    } finally {
      setLoadingSubmit(false);
    }
  }

  const title = isIncome ? "Nuevo ingreso" : "Nuevo egreso";
  const kindLabel = isIncome ? "Ingreso" : "Egreso";

  return (
    <>
      <button
        type="button"
        title={title}
        aria-label={title}
        onClick={() => {
          setError(null);
          setDateStr(todayLocalISODate());
          setConcept("");
          setAmountStr("");
          setLinkedToLot(false);
          setLotStr("");
          setLotValueStr("");
          setModalProjectId(
            pageProjectId && pageLoadedProject?.id === pageProjectId ? pageProjectId : null,
          );
          setOpen(true);
        }}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md ring-1 ring-primary/20 transition-[transform,box-shadow] hover:scale-105 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        <Plus className="h-5 w-5" strokeWidth={2.25} />
      </button>

      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!next && loadingSubmit) return;
          setOpen(next);
          if (!next) resetForm();
        }}
      >
        <DialogContent className="max-h-[min(92vh,720px)] w-[calc(100vw-2rem)] overflow-y-auto sm:max-w-xl lg:max-w-2xl" showCloseButton>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>
              Elige el proyecto y completa los datos. Se guardará como{" "}
              <Badge variant={isIncome ? "default" : "destructive"} className="align-middle">
                {kindLabel}
              </Badge>
              .
              {isIncome
                ? " Opcional: asocia el ingreso a un lote; el valor del lote se sugiere si ya consta en otro ingreso del mismo número."
                : " Opcional: imputa el egreso a un lote; el monto no puede superar los ingresos ya cargados a ese lote menos otros egresos del mismo lote."}{" "}
              Indica la <span className="font-medium text-foreground">fecha del movimiento</span> (sirve
              para filtrar por mes en el listado).
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {error ? (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="modal-mov-project">Proyecto</Label>
              <Select
                value={modalProjectId}
                onValueChange={(v) => setModalProjectId(v)}
                disabled={loadingProjects || loadingSubmit}
                modal={false}
              >
                <SelectTrigger
                  id="modal-mov-project"
                  size="default"
                  className="h-10 w-full min-w-0 max-w-full [&_[data-slot=select-value]]:text-left"
                >
                  <SelectValue
                    placeholder={loadingProjects ? "Cargando proyectos…" : "Elige un proyecto"}
                  />
                </SelectTrigger>
                <SelectContent align="start" sideOffset={6} alignItemWithTrigger={false}>
                  {projects.length === 0 && !loadingProjects ? (
                    <div className="px-3 py-4 text-xs text-muted-foreground">
                      No hay proyectos en esta empresa.
                    </div>
                  ) : (
                    projects.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        <span className="truncate font-medium">{p.name}</span>
                        <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                          {p.code}
                        </span>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              {modalProject ? (
                <p className="text-xs text-muted-foreground">
                  Destino: <span className="font-medium text-foreground">{modalProject.name}</span> (
                  <span className="font-mono">{modalProject.code}</span>)
                  {modalProject.lotCount >= 1 ? (
                    <>
                      {" · "}
                      Lotes del <span className="tabular-nums">1</span> al{" "}
                      <span className="tabular-nums">{modalProject.lotCount}</span> si imputas a lote
                    </>
                  ) : null}
                </p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="mov-date">
                Fecha del movimiento <span className="text-destructive">*</span>
              </Label>
              <Input
                id="mov-date"
                type="date"
                value={dateStr}
                onChange={(e) => setDateStr(e.target.value)}
                className="h-10 max-w-[11rem]"
                required
                disabled={loadingSubmit}
              />
              <p className="text-xs text-muted-foreground">
                Fecha contable del ingreso o egreso (no es la hora de registro).
              </p>
            </div>

            {modalProject ? (
              <div className="space-y-3 rounded-lg border border-border/80 bg-muted/20 px-3 py-3">
                <div className="flex items-start gap-3">
                  <input
                    id="mov-linked-lot"
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
                    <Label htmlFor="mov-linked-lot" className="cursor-pointer font-medium leading-snug">
                      {isIncome
                        ? "Asociar este ingreso a un lote"
                        : "Imputar este egreso a un lote"}
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      {isIncome
                        ? "Si no marcas, el ingreso queda como general del proyecto (sin número de lote)."
                        : "Si no marcas, el egreso es general del proyecto. Si imputas a un lote, el monto máximo es el saldo: ingresos a ese lote menos egresos ya imputados al mismo lote."}
                    </p>
                  </div>
                </div>
                {linkedToLot ? (
                  <div className="space-y-2 pt-1">
                    <Label htmlFor="mov-lot">
                      Número de lote <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="mov-lot"
                      inputMode="numeric"
                      placeholder={
                        modalProject.lotCount >= 1
                          ? `1 – ${modalProject.lotCount}`
                          : "Define lotes en el proyecto"
                      }
                      value={lotStr}
                      onChange={(e) => {
                        const v = e.target.value.replace(/\D/g, "");
                        setLotStr(v);
                        if (!isIncome || !modalProject) return;
                        const n = Number.parseInt(v.trim(), 10);
                        const maxLot = Math.max(0, Math.floor(modalProject.lotCount));
                        if (!Number.isInteger(n) || n < 1 || n > maxLot) {
                          setLotValueStr("");
                          return;
                        }
                        const hinted = lotValueHintFromProjectIncomes(modalProjectMovements, n);
                        setLotValueStr(hinted != null ? String(hinted) : "");
                      }}
                      autoComplete="off"
                      disabled={modalProject.lotCount < 1 || loadingSubmit}
                    />
                    {modalProject.lotCount < 1 ? (
                      <p className="text-xs text-destructive">
                        Este proyecto tiene 0 lotes. Aumenta «cantidad de lotes» en Proyectos o desmarca la
                        casilla.
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        Entero entre 1 y {modalProject.lotCount}.
                      </p>
                    )}
                    {isIncome ? (
                      <div className="space-y-2 pt-1">
                        <Label htmlFor="mov-lot-value">Valor del lote (opcional)</Label>
                        <Input
                          id="mov-lot-value"
                          inputMode="decimal"
                          placeholder="Se sugiere al elegir el número si ya hay otro ingreso a ese lote"
                          value={lotValueStr}
                          onChange={(e) => setLotValueStr(e.target.value)}
                          autoComplete="off"
                          disabled={modalProject.lotCount < 1 || loadingSubmit}
                        />
                        <p className="text-xs text-muted-foreground">
                          Suele registrarse una sola vez por lote; puedes dejarlo vacío o ajustarlo.
                        </p>
                      </div>
                    ) : null}
                    {!isIncome && linkedToLot && modalProject.lotCount >= 1 ? (
                      <div className="space-y-2 rounded-md border border-border/70 bg-background/80 px-3 py-2 text-xs">
                        {loadingModalProjectMovements ? (
                          <p className="text-muted-foreground">Cargando movimientos del proyecto…</p>
                        ) : expenseLotLedger ? (
                          <>
                            <p className="font-medium text-foreground">
                              Resumen lote {previewLot}: tope según ingresos imputados
                            </p>
                            <ul className="list-inside list-disc space-y-0.5 text-muted-foreground">
                              <li>
                                Total ingresos al lote:{" "}
                                <span className="font-medium tabular-nums text-foreground">
                                  {moneyFmt.format(expenseLotLedger.incomeTotal)}
                                </span>
                              </li>
                              <li>
                                Egresos ya imputados al lote:{" "}
                                <span className="font-medium tabular-nums text-foreground">
                                  {moneyFmt.format(expenseLotLedger.expenseTotal)}
                                </span>
                              </li>
                              <li>
                                <span className="text-foreground">Disponible para este egreso:</span>{" "}
                                <span
                                  className={
                                    expenseLotLedger.available < 0
                                      ? "font-semibold tabular-nums text-destructive"
                                      : "font-semibold tabular-nums text-foreground"
                                  }
                                >
                                  {moneyFmt.format(expenseLotLedger.available)}
                                </span>
                              </li>
                            </ul>
                            {previewAmount !== null &&
                            expenseAmountExceedsLotAvailable(previewAmount, expenseLotLedger.available) ? (
                              <p className="text-destructive" role="status">
                                El monto indicado supera el disponible ({moneyFmt.format(expenseLotLedger.available)}).
                              </p>
                            ) : null}
                          </>
                        ) : (
                          <p className="text-muted-foreground">
                            Indica un número de lote válido para ver ingresos, egresos y saldo disponible.
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
                <Label htmlFor="mov-concept">Concepto</Label>
                <Input
                  id="mov-concept"
                  placeholder={
                    isIncome
                      ? "Ej. Anticipo de cliente, ingreso por venta…"
                      : "Ej. Compra de materiales, nómina…"
                  }
                  value={concept}
                  onChange={(e) => setConcept(e.target.value)}
                  autoComplete="off"
                  disabled={loadingSubmit}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="mov-amount">Monto</Label>
                <Input
                  id="mov-amount"
                  inputMode="decimal"
                  placeholder="Ej. 1500000"
                  value={amountStr}
                  onChange={(e) => setAmountStr(e.target.value)}
                  autoComplete="off"
                  disabled={loadingSubmit}
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
                    {concept.trim() || "Sin concepto aún"}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-sm">
                    <span className="tabular-nums text-foreground">
                      {previewAmount !== null ? moneyFmt.format(previewAmount) : "—"}
                    </span>
                    <Badge variant={isIncome ? "default" : "destructive"}>{kindLabel}</Badge>
                    {modalProject ? (
                      <span className="text-muted-foreground">· {modalProject.name}</span>
                    ) : null}
                    {linkedToLot ? (
                      previewLot !== null &&
                      !Number.isNaN(previewLot) &&
                      modalProject &&
                      previewLot >= 1 &&
                      previewLot <= modalProject.lotCount ? (
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
                onClick={() => setOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={
                  loadingSubmit ||
                  (kind === "expense" && linkedToLot && loadingModalProjectMovements)
                }
              >
                {loadingSubmit ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Guardando…
                  </>
                ) : isIncome ? (
                  "Registrar ingreso"
                ) : (
                  "Registrar egreso"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
