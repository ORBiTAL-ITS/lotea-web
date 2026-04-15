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
import {
  GASTOS_PROJECT_DOC_ID,
  gastosOptionProject,
  isGastosProjectId,
} from "@/features/projects/constants/gastos-project";
import {
  ensureGastosProject,
  fetchProjects,
} from "@/features/projects/services/projects-service";
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
import { PersonPickerField, type PersonPickerValue } from "@/features/people/components/person-picker-field";
import { fetchLotTransfers, fetchProjectLots } from "@/features/lots/services/lots-service";
import type { Lot } from "@/features/lots/models/lot-types";
import type { LotTransfer } from "@/features/lots/models/lot-types";
import {
  buildLotOwnerMap,
  freeLotNumbers,
  lotNumbersAssociableToPerson,
  lotNumbersForPerson,
} from "../utils/lot-person-assignment";
import {
  createMonthlyRefund,
  createWorkerPayment,
} from "@/features/finance/services/finance-service";
import {
  ContractorPickerField,
  type ContractorPickerValue,
} from "@/features/contractors/components/contractor-picker-field";

type ExpenseMode = "standard" | "devolucion" | "trabajador";

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
  /** Lotes del proyecto (p. ej. tras Buscar en Ingresos) para listar titulares sin elegir número a mano. */
  syncedProjectLots?: Lot[];
};

export function QuickNewMovementButton({
  companyId,
  kind,
  onCreated,
  pageProjectId,
  pageLoadedProject,
  syncedProjectId,
  syncedProjectMovements,
  syncedProjectLots,
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
  /** Lotes elegidos: ingreso = un solo lote; egreso = uno o varios (reparto igual). */
  const [selectedLotNos, setSelectedLotNos] = useState<number[]>([]);
  const [lotValueStr, setLotValueStr] = useState("");
  const [person, setPerson] = useState<PersonPickerValue | null>(null);
  const [modalProjectMovements, setModalProjectMovements] = useState<Movement[]>([]);
  const [modalProjectLotTransfers, setModalProjectLotTransfers] = useState<LotTransfer[]>([]);
  const [loadingModalProjectMovements, setLoadingModalProjectMovements] = useState(false);
  /** Ingreso: false = abono entre lotes ya de esta persona; true = solo lotes libres. */
  const [incomeUseFreeLot, setIncomeUseFreeLot] = useState(true);
  /** Ingreso: fila elegida en catálogo Lotes (titular + lote); evita elegir número a mano. */
  const [incomePickedTitular, setIncomePickedTitular] = useState<{
    lotNumber: number;
    personId: string;
    personName: string;
  } | null>(null);
  const [modalLots, setModalLots] = useState<Lot[]>([]);
  const [loadingModalLots, setLoadingModalLots] = useState(false);
  /** Egreso en proyecto con lotes: movimiento estándar, devolución (dueño/cedente) o pago a trabajador. */
  const [expenseMode, setExpenseMode] = useState<ExpenseMode>("standard");
  const [workerContractor, setWorkerContractor] = useState<ContractorPickerValue | null>(null);

  const isMaster = sessionUser?.globalRole === "master";
  const isViewer = sessionUser?.companyRole === "viewer";
  const isCompanyAdmin =
    sessionUser?.globalRole === "company_user" && sessionUser?.companyRole === "admin";
  const showFab = isCompanyAdmin || isMaster;

  const modalProject = useMemo(() => {
    if (!modalProjectId) return null;
    if (isGastosProjectId(modalProjectId)) return gastosOptionProject();
    return projects.find((p) => p.id === modalProjectId) ?? null;
  }, [projects, modalProjectId]);

  const lotOwnerByLot = useMemo(
    () => buildLotOwnerMap(modalProjectMovements),
    [modalProjectMovements],
  );

  /** Ingresos: solo lotes con movimientos de la persona. Egresos: además lotes donde fue titular y cedió (ex titular). */
  const lotsForSelectedPerson = useMemo(() => {
    if (!person?.id) return [];
    if (kind === "income") {
      return lotNumbersForPerson(modalProjectMovements, person.id);
    }
    return lotNumbersAssociableToPerson(modalProjectMovements, modalProjectLotTransfers, person.id);
  }, [kind, modalProjectMovements, modalProjectLotTransfers, person?.id]);

  const projectSelectItems = useMemo(() => {
    const rows = projects.map((p) => ({
      value: p.id,
      label: (
        <>
          <span className="truncate font-medium">{p.name}</span>
          <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
            {p.code}
          </span>
        </>
      ),
    }));
    if (kind === "expense") {
      return [
        { value: GASTOS_PROJECT_DOC_ID, label: <span className="font-medium">Gasto</span> },
        ...rows,
      ];
    }
    return rows;
  }, [projects, kind]);

  const loadProjects = useCallback(async () => {
    setLoadingProjects(true);
    try {
      let fetched: Project[] = [];
      try {
        fetched = await fetchProjects(companyId);
      } catch {
        fetched = [];
      }
      setProjects(fetched.filter((p) => !isGastosProjectId(p.id)));
    } finally {
      setLoadingProjects(false);
    }
  }, [companyId, kind]);

  useEffect(() => {
    if (!open || !companyId) return;
    void loadProjects();
  }, [open, companyId, loadProjects]);

  useEffect(() => {
    if (!open) return;
    if (
      pageProjectId &&
      (isGastosProjectId(pageProjectId) || projects.some((p) => p.id === pageProjectId))
    ) {
      setModalProjectId(pageProjectId);
    }
  }, [open, pageProjectId, projects]);

  useEffect(() => {
    if (!open || kind !== "expense") return;
    if (expenseMode === "trabajador") {
      setLinkedToLot(false);
      setSelectedLotNos([]);
      setPerson(null);
      setWorkerContractor(null);
    }
  }, [open, kind, expenseMode]);

  useEffect(() => {
    if (!open || !modalProjectId) return;
    if (isGastosProjectId(modalProjectId)) {
      setExpenseMode("standard");
    }
  }, [open, modalProjectId]);

  useEffect(() => {
    if (!open || !companyId || !modalProjectId) {
      setModalProjectMovements([]);
      setModalProjectLotTransfers([]);
      setLoadingModalProjectMovements(false);
      return;
    }
    if (isGastosProjectId(modalProjectId)) {
      setModalProjectLotTransfers([]);
    }
    const loadTransfers = () =>
      isGastosProjectId(modalProjectId)
        ? Promise.resolve([] as LotTransfer[])
        : fetchLotTransfers(companyId, modalProjectId).catch(() => [] as LotTransfer[]);

    if (syncedProjectId === modalProjectId && syncedProjectMovements) {
      setModalProjectMovements(syncedProjectMovements);
      setLoadingModalProjectMovements(false);
      let cancelled = false;
      void loadTransfers().then((t) => {
        if (!cancelled) setModalProjectLotTransfers(t);
      });
      return () => {
        cancelled = true;
      };
    }
    let cancelled = false;
    setLoadingModalProjectMovements(true);
    void Promise.all([fetchMovements(companyId, modalProjectId), loadTransfers()])
      .then(([list, transfers]) => {
        if (!cancelled) {
          setModalProjectMovements(list);
          setModalProjectLotTransfers(transfers);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setModalProjectMovements([]);
          setModalProjectLotTransfers([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingModalProjectMovements(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, companyId, modalProjectId, syncedProjectId, syncedProjectMovements]);

  const isIncome = kind === "income";

  useEffect(() => {
    if (!open || !isIncome || !modalProjectId || isGastosProjectId(modalProjectId)) {
      setModalLots([]);
      setLoadingModalLots(false);
      return;
    }
    if (syncedProjectId === modalProjectId && syncedProjectLots !== undefined) {
      setModalLots(syncedProjectLots);
      setLoadingModalLots(false);
      return;
    }
    let cancelled = false;
    setLoadingModalLots(true);
    void fetchProjectLots(companyId, modalProjectId)
      .then((lots) => {
        if (!cancelled) setModalLots(lots);
      })
      .catch(() => {
        if (!cancelled) setModalLots([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingModalLots(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, isIncome, companyId, modalProjectId, syncedProjectId, syncedProjectLots]);

  const freeLotsForProject = useMemo(
    () =>
      modalProject && modalProject.lotCount >= 1
        ? freeLotNumbers(modalProject.lotCount, lotOwnerByLot)
        : [],
    [modalProject, lotOwnerByLot],
  );

  /** Titulares con datos en el catálogo de lotes (página Lotes). */
  const incomeTitularRows = useMemo(() => {
    if (!isIncome) return [];
    return modalLots
      .filter((l) => {
        const id = typeof l.currentOwnerId === "string" ? l.currentOwnerId.trim() : "";
        const name = (l.currentOwnerName ?? "").trim();
        return id.length > 0 && name.length > 0 && l.lotNumber >= 1;
      })
      .sort((a, b) => a.lotNumber - b.lotNumber);
  }, [isIncome, modalLots]);

  /** Lotes sin titular en catálogo; si aún no hay docs de lotes, se usan libres por movimientos. */
  const incomeFreeLotNumbersForFirstSale = useMemo(() => {
    if (!isIncome || !modalProject) return [];
    if (modalLots.length > 0) {
      return modalLots
        .filter((l) => {
          const id = typeof l.currentOwnerId === "string" ? l.currentOwnerId.trim() : "";
          const name = (l.currentOwnerName ?? "").trim();
          return !id && !name && l.lotNumber >= 1;
        })
        .map((l) => l.lotNumber)
        .sort((a, b) => a - b);
    }
    return freeLotsForProject;
  }, [isIncome, modalProject, modalLots, freeLotsForProject]);

  const incomeLotChipNumbers = useMemo(() => {
    if (!isIncome) return [];
    if (incomePickedTitular) return [];
    if (incomeUseFreeLot) return incomeFreeLotNumbersForFirstSale;
    return lotsForSelectedPerson;
  }, [
    isIncome,
    incomePickedTitular,
    incomeUseFreeLot,
    incomeFreeLotNumbersForFirstSale,
    lotsForSelectedPerson,
  ]);

  /** Egreso: solo lotes de la persona; si aún no tiene ninguno, solo libres (sin flujo «añadir lote»). */
  const expenseLotChipNumbers = useMemo(() => {
    if (isIncome) return [];
    return lotsForSelectedPerson.length > 0 ? lotsForSelectedPerson : freeLotsForProject;
  }, [isIncome, lotsForSelectedPerson, freeLotsForProject]);

  const canShowIncomeAddFreeLot =
    isIncome &&
    !incomePickedTitular &&
    Boolean(person?.id) &&
    lotsForSelectedPerson.length >= 1 &&
    incomeFreeLotNumbersForFirstSale.length > 0;

  const previewAmount = useMemo(() => {
    const n = Number.parseFloat(amountStr.replace(",", "."));
    if (Number.isNaN(n) || n <= 0) return null;
    return n;
  }, [amountStr]);

  const sortedLots = useMemo(
    () =>
      [...new Set(selectedLotNos)].filter((n) => Number.isInteger(n) && n >= 1).sort((a, b) => a - b),
    [selectedLotNos],
  );

  /** Un solo lote por movimiento (ingreso o egreso). */
  const effectiveSortedLots = useMemo(() => {
    if (!linkedToLot) return sortedLots;
    return sortedLots;
  }, [linkedToLot, sortedLots]);

  useEffect(() => {
    if (!open || !isIncome || !linkedToLot) return;
    if (incomePickedTitular) return;
    if (!person?.id?.trim()) {
      setIncomeUseFreeLot(true);
      setSelectedLotNos([]);
      return;
    }
    const owned = lotsForSelectedPerson;
    if (owned.length === 0) {
      setIncomeUseFreeLot(true);
      setSelectedLotNos([]);
    } else if (owned.length === 1) {
      setIncomeUseFreeLot(false);
      setSelectedLotNos([owned[0]!]);
    } else {
      setIncomeUseFreeLot(false);
      setSelectedLotNos([]);
    }
  }, [open, isIncome, linkedToLot, person?.id, lotsForSelectedPerson, incomePickedTitular]);

  useEffect(() => {
    if (!open || !linkedToLot || !isIncome || !person?.id?.trim() || incomePickedTitular) return;
    const allowed = incomeUseFreeLot ? incomeFreeLotNumbersForFirstSale : lotsForSelectedPerson;
    setSelectedLotNos((prev) => {
      const n = prev[0];
      if (n == null) return prev;
      return allowed.includes(n) ? prev : [];
    });
  }, [
    open,
    linkedToLot,
    isIncome,
    person?.id,
    incomePickedTitular,
    incomeUseFreeLot,
    incomeFreeLotNumbersForFirstSale,
    lotsForSelectedPerson,
  ]);

  /** Egreso: al cambiar persona / historial, un lote preseleccionado si solo hay uno. */
  useEffect(() => {
    if (!open || isIncome || !linkedToLot) return;
    if (!person?.id?.trim()) {
      setSelectedLotNos([]);
      return;
    }
    const owned = lotsForSelectedPerson;
    if (owned.length === 0) {
      setSelectedLotNos([]);
    } else if (owned.length === 1) {
      setSelectedLotNos([owned[0]!]);
    } else {
      setSelectedLotNos([]);
    }
  }, [open, isIncome, linkedToLot, person?.id, lotsForSelectedPerson]);

  useEffect(() => {
    if (!open || !linkedToLot || isIncome || !person?.id?.trim()) return;
    const allowed = expenseLotChipNumbers;
    setSelectedLotNos((prev) => {
      const n = prev[0];
      if (n == null) return prev;
      return allowed.includes(n) ? prev : [];
    });
  }, [open, linkedToLot, isIncome, person?.id, expenseLotChipNumbers.join(",")]);

  const previewLot = effectiveSortedLots.length === 1 ? effectiveSortedLots[0]! : null;
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

  const expenseSplitValid = useMemo(() => {
    if (kind !== "expense" || !linkedToLot || !modalProject || effectiveSortedLots.length !== 1) {
      return true;
    }
    const amount = Number.parseFloat(amountStr.replace(",", "."));
    if (Number.isNaN(amount) || amount <= 0) return false;
    const ledger = lotLedgerForMovements(modalProjectMovements, effectiveSortedLots[0]!);
    return !expenseAmountExceedsLotAvailable(amount, ledger.available);
  }, [kind, linkedToLot, modalProject, effectiveSortedLots, amountStr, modalProjectMovements]);

  const lotKey = effectiveSortedLots.join(",");
  useEffect(() => {
    if (!open || !isIncome || !linkedToLot || effectiveSortedLots.length !== 1 || !modalProject) {
      if (effectiveSortedLots.length > 1) setLotValueStr("");
      return;
    }
    const n = effectiveSortedLots[0]!;
    const fromLot = modalLots.find((l) => l.lotNumber === n)?.declaredLotValue;
    if (fromLot != null && fromLot > 0) {
      setLotValueStr(String(fromLot));
      return;
    }
    const hinted = lotValueHintFromProjectIncomes(modalProjectMovements, n);
    setLotValueStr(hinted != null ? String(hinted) : "");
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sugerencia al cambiar solo el lote elegido
  }, [open, isIncome, linkedToLot, lotKey, modalProject, effectiveSortedLots.length, modalProjectMovements, modalLots]);

  const previewVisible =
    Boolean(parsedMovementDate) ||
    concept.trim().length > 0 ||
    previewAmount !== null ||
    (!isIncome && Boolean(workerContractor?.name.trim())) ||
    (linkedToLot && effectiveSortedLots.length > 0) ||
    linkedToLot ||
    previewLotValue !== null;

  function resetForm() {
    setDateStr(todayLocalISODate());
    setConcept("");
    setAmountStr("");
    setLinkedToLot(false);
    setSelectedLotNos([]);
    setLotValueStr("");
    setPerson(null);
    setIncomeUseFreeLot(true);
    setIncomePickedTitular(null);
    setExpenseMode("standard");
    setWorkerContractor(null);
    setError(null);
    setModalProjectId(null);
  }

  function goIncomeUseExistingLots() {
    setIncomePickedTitular(null);
    setIncomeUseFreeLot(false);
    if (lotsForSelectedPerson.length === 1) {
      setSelectedLotNos([lotsForSelectedPerson[0]!]);
    } else {
      setSelectedLotNos([]);
    }
  }

  function goIncomeUseFreeLotMode() {
    setIncomePickedTitular(null);
    setIncomeUseFreeLot(true);
    setSelectedLotNos([]);
  }

  /** Tras «Registrar y añadir otro»: limpia línea nueva pero mantiene proyecto, fecha y opciones de lote. */
  function resetForAnotherEntry() {
    setConcept("");
    setAmountStr("");
    setLotValueStr("");
    setWorkerContractor(null);
    setIncomePickedTitular(null);
    setError(null);
  }

  const canChainSubmit = useMemo(() => {
    if (!modalProjectId || !concept.trim()) return false;
    const amount = Number.parseFloat(amountStr.replace(",", "."));
    if (Number.isNaN(amount) || amount <= 0) return false;
    if (!parseLocalDateYmd(dateStr)) return false;
    const proj = modalProject;
    if (!proj) return false;

    if (
      kind === "expense" &&
      modalProjectId &&
      !isGastosProjectId(modalProjectId)
    ) {
      if (expenseMode === "trabajador") {
        return Boolean(workerContractor?.name.trim());
      }
      if (expenseMode === "devolucion") {
        if (!person?.id?.trim() || !person.name?.trim()) return false;
        if (linkedToLot) {
          if (loadingModalProjectMovements) return false;
          if (effectiveSortedLots.length !== 1) return false;
          if (!expenseSplitValid) return false;
        }
        return true;
      }
    }

    if (kind === "expense" && linkedToLot && loadingModalProjectMovements) return false;
    if (kind === "income" && linkedToLot && (loadingModalProjectMovements || loadingModalLots)) {
      return false;
    }
    if (linkedToLot) {
      const maxLot = Math.max(0, Math.floor(proj.lotCount));
      if (maxLot < 1) return false;
      if (effectiveSortedLots.length < 1) return false;
      if (effectiveSortedLots.length !== 1) return false;
      for (const ln of effectiveSortedLots) {
        if (ln < 1 || ln > maxLot) return false;
      }
      if (modalProject && !isGastosProjectId(modalProject.id)) {
        if (!person?.id || !person.name.trim()) return false;
      }
      if (kind === "expense") {
        if (!expenseSplitValid) return false;
      }
    }
    return true;
  }, [
    modalProjectId,
    modalProject,
    concept,
    amountStr,
    dateStr,
    kind,
    expenseMode,
    workerContractor,
    linkedToLot,
    loadingModalProjectMovements,
    loadingModalLots,
    effectiveSortedLots,
    modalProjectMovements,
    person,
    expenseSplitValid,
    isIncome,
    incomePickedTitular,
  ]);

  function pickIncomeTitular(lot: Lot) {
    const id = typeof lot.currentOwnerId === "string" ? lot.currentOwnerId.trim() : "";
    const name = (lot.currentOwnerName ?? "").trim();
    if (!id || !name) return;
    setIncomePickedTitular({ lotNumber: lot.lotNumber, personId: id, personName: name });
    setPerson({ id, name });
    setSelectedLotNos([lot.lotNumber]);
    setIncomeUseFreeLot(false);
  }

  function clearIncomeTitularPick() {
    setIncomePickedTitular(null);
    setSelectedLotNos([]);
    setPerson(null);
    setIncomeUseFreeLot(true);
  }

  function toggleLot(n: number) {
    if (loadingSubmit || !modalProject) return;
    if (isIncome && incomePickedTitular) return;
    if (!person?.id?.trim()) return;
    const maxLot = Math.max(0, Math.floor(modalProject.lotCount));
    if (n < 1 || n > maxLot) return;
    if (isIncome) {
      if (!incomeLotChipNumbers.includes(n)) return;
      setSelectedLotNos((prev) => (prev[0] === n ? [] : [n]));
      return;
    }
    if (!expenseLotChipNumbers.includes(n)) return;
    setSelectedLotNos((prev) => (prev[0] === n ? [] : [n]));
  }

  function clearLots() {
    setSelectedLotNos([]);
  }

  if (!sessionUser || isViewer || !showFab) return null;

  async function performSave(addAnother: boolean) {
    if (loadingSubmit) return;
    setError(null);
    if (!modalProjectId) {
      setError(
        kind === "expense"
          ? "Selecciona Gasto o un proyecto."
          : "Selecciona el proyecto al que aplicará este registro.",
      );
      return;
    }
    let proj: Project | null = modalProject;
    if (!proj) {
      setError(kind === "expense" ? "Elige Gasto o un proyecto." : "Proyecto no válido.");
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
    let incomeLotValue: number | null = null;
    const lots = effectiveSortedLots;

    const isExpenseTrabajador =
      kind === "expense" &&
      proj &&
      modalProjectId &&
      !isGastosProjectId(modalProjectId) &&
      expenseMode === "trabajador";

    if (kind === "expense" && proj && modalProjectId && !isGastosProjectId(modalProjectId)) {
      if (expenseMode === "devolucion") {
        if (!person?.id?.trim() || !person.name?.trim()) {
          setError("En devolución debes elegir al cedente o dueño en Persona.");
          return;
        }
      }
      if (expenseMode === "trabajador") {
        if (!workerContractor?.name.trim()) {
          setError("Elige un contratista del catálogo o crea uno con «Nuevo».");
          return;
        }
      }
    }

    if ((kind === "income" || kind === "expense") && !isExpenseTrabajador) {
      linked = linkedToLot;
      if (linked) {
        const maxLot = Math.max(0, Math.floor(proj.lotCount));
        if (maxLot < 1) {
          setError(
            "Este proyecto tiene 0 lotes. Edita el proyecto en Proyectos o desmarca «Asociar a un lote».",
          );
          return;
        }
        if (lots.length < 1) {
          setError("Selecciona al menos un lote.");
          return;
        }
        if (kind === "income" && lots.length !== 1) {
          setError("Selecciona un solo lote para el ingreso.");
          return;
        }
        if (kind === "expense" && lots.length !== 1) {
          setError("Selecciona un solo lote para el egreso.");
          return;
        }
        for (const ln of lots) {
          if (ln < 1 || ln > maxLot) {
            setError(`Los lotes deben ser enteros entre 1 y ${maxLot}.`);
            return;
          }
        }
        if (!isGastosProjectId(proj.id)) {
          if (!person?.id?.trim() || !person.name.trim()) {
            setError("Selecciona la persona vinculada al lote.");
            return;
          }
        }
        const totalRounded = Math.round(amount);
        if (kind === "expense") {
          const ledger = lotLedgerForMovements(modalProjectMovements, lots[0]!);
          if (expenseAmountExceedsLotAvailable(totalRounded, ledger.available)) {
            setError(
              `El monto supera el saldo disponible en el lote ${lots[0]}: disponible ${moneyFmt.format(ledger.available)}.`,
            );
            return;
          }
        } else if (kind === "income" && lots.length === 1) {
          const lv = Number.parseFloat(lotValueStr.replace(",", "."));
          if (Number.isFinite(lv) && lv > 0) {
            incomeLotValue = lv;
          }
        }
      }
    }

    setLoadingSubmit(true);
    try {
      if (isGastosProjectId(modalProjectId)) {
        const ensured = await ensureGastosProject(companyId);
        if (!ensured) {
          setError(
            "No se pudo usar «Gasto». Un administrador debe abrir Egresos una vez para activarlo.",
          );
          return;
        }
        proj = ensured;
      }

      if (
        kind === "expense" &&
        proj &&
        modalProjectId &&
        !isGastosProjectId(modalProjectId) &&
        expenseMode === "trabajador"
      ) {
        const wc = workerContractor;
        if (!wc?.name.trim()) {
          setError("Elige un contratista del catálogo o crea uno con «Nuevo».");
          return;
        }
        await createWorkerPayment(companyId, modalProjectId, {
          workerName: wc.name.trim(),
          contractorId: wc.id,
          workerPhone: wc.phone.trim() || null,
          amount,
          concept: trimmed,
          paymentDate: movementDate,
          projectLotCount: proj.lotCount,
        });
        notifyMovementsUpdated();
        onCreated?.();

        if (addAnother) {
          resetForAnotherEntry();
          if (companyId && modalProjectId) {
            setLoadingModalProjectMovements(true);
            try {
              const list = await fetchMovements(companyId, modalProjectId);
              setModalProjectMovements(list);
            } catch {
              setModalProjectMovements([]);
            } finally {
              setLoadingModalProjectMovements(false);
            }
          }
        } else {
          resetForm();
          setOpen(false);
        }
        return;
      }

      if (
        kind === "expense" &&
        proj &&
        modalProjectId &&
        !isGastosProjectId(modalProjectId) &&
        expenseMode === "devolucion"
      ) {
        const lotNum = linked && lots.length === 1 ? lots[0]! : null;
        await createMonthlyRefund(companyId, modalProjectId, {
          cedenteId: person!.id!.trim(),
          cedenteName: person!.name!.trim(),
          lotNumber: lotNum,
          amount,
          concept: trimmed,
          refundMonth: dateStr.slice(0, 7),
          refundDate: movementDate,
          projectLotCount: proj.lotCount,
        });
        notifyMovementsUpdated();
        onCreated?.();

        if (addAnother) {
          resetForAnotherEntry();
          if (companyId && modalProjectId) {
            setLoadingModalProjectMovements(true);
            try {
              const list = await fetchMovements(companyId, modalProjectId);
              setModalProjectMovements(list);
            } catch {
              setModalProjectMovements([]);
            } finally {
              setLoadingModalProjectMovements(false);
            }
          }
        } else {
          resetForm();
          setOpen(false);
        }
        return;
      }

      if (!linked) {
        await createMovement(companyId, modalProjectId, {
          concept: trimmed,
          amount,
          kind,
          movementDate,
          projectLotCount: proj.lotCount,
          linkedToLot: false,
          lotNumber: null,
          ...(kind === "income" ? { lotValue: null } : {}),
        });
      } else {
        await createMovement(companyId, modalProjectId, {
          concept: trimmed,
          amount,
          kind,
          movementDate,
          projectLotCount: proj.lotCount,
          linkedToLot: true,
          lotNumber: lots[0]!,
          personId: isGastosProjectId(modalProjectId) ? null : person?.id ?? null,
          personName: isGastosProjectId(modalProjectId) ? null : person?.name ?? null,
          ...(kind === "income" ? { lotValue: incomeLotValue } : {}),
        });
      }
      notifyMovementsUpdated();
      onCreated?.();

      if (addAnother) {
        resetForAnotherEntry();
        if (companyId && modalProjectId) {
          setLoadingModalProjectMovements(true);
          try {
            const list = await fetchMovements(companyId, modalProjectId);
            setModalProjectMovements(list);
            if (kind === "income" && linkedToLot && proj && effectiveSortedLots.length === 1) {
              const n = effectiveSortedLots[0]!;
              const maxLot = Math.max(0, Math.floor(proj.lotCount));
              if (n >= 1 && n <= maxLot) {
                const hinted = lotValueHintFromProjectIncomes(list, n);
                setLotValueStr(hinted != null ? String(hinted) : "");
              }
            }
          } catch {
            setModalProjectMovements([]);
          } finally {
            setLoadingModalProjectMovements(false);
          }
        }
      } else {
        resetForm();
        setOpen(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar el movimiento.");
    } finally {
      setLoadingSubmit(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    void performSave(false);
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
          setSelectedLotNos([]);
          setPerson(null);
          setLotValueStr("");
          setIncomeUseFreeLot(true);
          setIncomePickedTitular(null);
          setExpenseMode("standard");
          setWorkerContractor(null);
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
              {isIncome ? (
                <>
                  Elige el proyecto y completa los datos. Se guardará como{" "}
                  <Badge variant="default" className="align-middle">
                    {kindLabel}
                  </Badge>
                  . Si imputas a lote, elige un titular desde el catálogo Lotes o una primera venta en lote libre; el
                  valor del lote se sugiere si está en Lotes o en otro ingreso al mismo número. Indica la{" "}
                  <span className="font-medium text-foreground">fecha del movimiento</span> (sirve para
                  filtrar por mes en el listado).
                </>
              ) : modalProject && isGastosProjectId(modalProject.id) ? (
                <>
                  Registro en <span className="font-medium text-foreground">Gasto</span>: solo concepto,
                  monto y fecha. Numeración E- aparte de los proyectos. Se guardará como{" "}
                  <Badge variant="destructive" className="align-middle">
                    {kindLabel}
                  </Badge>
                  .
                </>
              ) : (
                <>
                  Elige el proyecto y completa los datos. Puedes registrar un egreso general, una{" "}
                  <span className="font-medium text-foreground">devolución</span> a dueño o cedente, o un{" "}
                  <span className="font-medium text-foreground">pago a trabajador</span>. Opcionalmente imputa
                  a lote; el monto no puede superar el saldo del lote. Indica la{" "}
                  <span className="font-medium text-foreground">fecha del movimiento</span> (sirve para filtrar
                  por mes en el listado).
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {error ? (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="modal-mov-project">
                {kind === "expense" ? "Registrar en" : "Proyecto"}
              </Label>
              <Select
                value={modalProjectId}
                items={projectSelectItems}
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
                    placeholder={
                      loadingProjects
                        ? "Cargando…"
                        : kind === "expense"
                          ? "Elige Gasto o un proyecto"
                          : "Elige un proyecto"
                    }
                  />
                </SelectTrigger>
                <SelectContent align="start" sideOffset={6} alignItemWithTrigger={false}>
                  {kind === "expense" ? (
                    <>
                      <SelectItem value={GASTOS_PROJECT_DOC_ID}>
                        <span className="font-medium">Gasto</span>
                      </SelectItem>
                      {projects.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          <span className="truncate font-medium">{p.name}</span>
                          <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                            {p.code}
                          </span>
                        </SelectItem>
                      ))}
                    </>
                  ) : projects.length === 0 && !loadingProjects ? (
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

            {modalProject && kind === "expense" && !isGastosProjectId(modalProject.id) ? (
              <div className="space-y-2">
                <Label htmlFor="expense-mode">Tipo de egreso</Label>
                <Select
                  value={expenseMode}
                  onValueChange={(v) => setExpenseMode(v as ExpenseMode)}
                  disabled={loadingSubmit}
                  modal={false}
                >
                  <SelectTrigger
                    id="expense-mode"
                    size="default"
                    className="h-10 w-full min-w-0 max-w-full [&_[data-slot=select-value]]:text-left"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent align="start" sideOffset={6} alignItemWithTrigger={false}>
                    <SelectItem value="standard">Egreso general o por lote</SelectItem>
                    <SelectItem value="devolucion">Devolución a dueño o cedente</SelectItem>
                    <SelectItem value="trabajador">Pago a trabajador o contratista</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Las devoluciones y los pagos a trabajador quedan enlazados al proyecto y aparecen en el
                  consolidado de egresos.
                </p>
              </div>
            ) : null}

            {modalProject &&
            kind === "expense" &&
            !isGastosProjectId(modalProject.id) &&
            expenseMode === "trabajador" ? (
              <ContractorPickerField
                companyId={companyId}
                value={workerContractor}
                onChange={setWorkerContractor}
                disabled={loadingSubmit}
                id="mov-worker-contractor"
                required
              />
            ) : null}

            {modalProject && (isIncome || (!isGastosProjectId(modalProject.id) && expenseMode !== "trabajador")) ? (
              <div className="space-y-3 rounded-lg border border-border/80 bg-muted/20 px-3 py-3">
                {!isIncome && expenseMode === "devolucion" && !isGastosProjectId(modalProject.id) ? (
                  <div className="space-y-2 pb-1">
                    <PersonPickerField
                      companyId={companyId}
                      value={person}
                      onChange={setPerson}
                      disabled={loadingSubmit}
                      id="mov-person-devolucion"
                      required
                    />
                    <p className="text-xs text-muted-foreground">
                      Persona que recibe la devolución. Opcionalmente imputa a un lote con la casilla de abajo.
                    </p>
                  </div>
                ) : null}
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
                        setSelectedLotNos([]);
                        setLotValueStr("");
                        setIncomePickedTitular(null);
                        if (isIncome || expenseMode !== "devolucion") {
                          setPerson(null);
                        }
                        setIncomeUseFreeLot(true);
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
                        ? "Los titulares salen del catálogo Lotes (misma empresa). Elige una fila o, abajo, primera venta en lote libre con persona del catálogo."
                        : expenseMode === "devolucion"
                          ? "Si imputas a lote, elige un solo número; el monto no puede superar el saldo disponible en ese lote."
                          : "Elige la persona y un solo lote. Con varios lotes asignados, indica en cuál va el egreso. No hay «añadir lote libre» en egresos."}
                    </p>
                  </div>
                </div>
                {linkedToLot ? (
                  <div className="space-y-4 pt-1">
                    {!isGastosProjectId(modalProject.id) && !isIncome && expenseMode === "standard" ? (
                      <PersonPickerField
                        companyId={companyId}
                        value={person}
                        onChange={setPerson}
                        disabled={loadingSubmit}
                        id="mov-person"
                        required
                      />
                    ) : null}

                    {modalProject.lotCount < 1 ? (
                      <p className="text-xs text-destructive">
                        Este proyecto tiene 0 lotes. Aumenta «cantidad de lotes» en Proyectos o desmarca la
                        casilla.
                      </p>
                    ) : null}

                    {modalProject.lotCount >= 1 &&
                    !isIncome &&
                    !isGastosProjectId(modalProject.id) &&
                    !person?.id ? (
                      <p className="text-xs text-amber-900 dark:text-amber-100/90">
                        Elige la persona arriba. Luego podrás marcar solo los lotes que sigan libres; los que ya tiene
                        asignado otro cliente no se muestran.
                      </p>
                    ) : null}

                    {modalProject.lotCount >= 1 && isIncome && !isGastosProjectId(modalProject.id) ? (
                      <div className="space-y-4">
                        {loadingModalLots ? (
                          <p className="text-xs text-muted-foreground">Cargando catálogo de lotes del proyecto…</p>
                        ) : null}
                        {incomeTitularRows.length > 0 ? (
                          <div className="space-y-2">
                            <p className="text-sm font-medium text-foreground">
                              Ingreso a titular ya registrado en Lotes
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Elige la fila: se imputa al lote y al dueño del catálogo (no elijas el número a mano).
                            </p>
                            <div className="flex max-h-[200px] flex-wrap gap-2 overflow-y-auto rounded-lg border border-border/60 bg-background/80 p-2">
                              {incomeTitularRows.map((lot) => {
                                const selected = incomePickedTitular?.lotNumber === lot.lotNumber;
                                return (
                                  <button
                                    key={lot.id}
                                    type="button"
                                    disabled={loadingSubmit}
                                    onClick={() => pickIncomeTitular(lot)}
                                    className={
                                      selected
                                        ? "min-h-10 rounded-lg bg-primary px-3 py-2 text-left text-sm font-medium text-primary-foreground shadow-sm ring-1 ring-primary/30"
                                        : "min-h-10 rounded-lg border border-border/80 bg-muted/40 px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-muted"
                                    }
                                  >
                                    <span className="font-mono tabular-nums">Lote {lot.lotNumber}</span>
                                    <span className="mt-0.5 block text-xs opacity-90">
                                      {lot.currentOwnerName ?? "—"}
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                            {incomePickedTitular ? (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-8 text-xs"
                                disabled={loadingSubmit}
                                onClick={() => clearIncomeTitularPick()}
                              >
                                Elegir otra opción (titular o primera venta)
                              </Button>
                            ) : null}
                          </div>
                        ) : !loadingModalLots ? (
                          <p className="text-xs text-muted-foreground">
                            No hay titulares en el catálogo de Lotes. Usa «primera venta» abajo o asigna titular en la
                            página Lotes.
                          </p>
                        ) : null}

                        {!incomePickedTitular ? (
                          <div className="space-y-3 border-t border-border/60 pt-3">
                            <p className="text-sm font-medium text-foreground">
                              Primera venta (lote sin titular en Lotes)
                            </p>
                            <PersonPickerField
                              companyId={companyId}
                              value={person}
                              onChange={setPerson}
                              disabled={loadingSubmit}
                              id="mov-person-income-free"
                              required={false}
                            />
                            {person?.id ? (
                              <div className="space-y-3">
                                {lotsForSelectedPerson.length === 0 ? (
                                  <p className="text-sm font-medium text-foreground">Lote libre (primera asignación)</p>
                                ) : incomeUseFreeLot ? (
                                  <>
                                    <p className="text-sm font-medium text-foreground">Lote libre nuevo</p>
                                    <p className="text-xs text-muted-foreground">
                                      El ingreso quedará en el número que elijas si el lote sigue sin titular en
                                      Lotes.
                                    </p>
                                  </>
                                ) : (
                                  <>
                                    <p className="text-sm font-medium text-foreground">
                                      {lotsForSelectedPerson.length > 1
                                        ? "¿A cuál lote va este abono?"
                                        : "Lote asignado a esta persona"}
                                    </p>
                                    {lotsForSelectedPerson.length === 1 ? (
                                      <p className="text-xs text-muted-foreground">
                                        Puedes abonar aquí o usar el botón para un lote libre nuevo.
                                      </p>
                                    ) : null}
                                  </>
                                )}

                                {canShowIncomeAddFreeLot && !incomeUseFreeLot ? (
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="h-8 w-full text-xs"
                                    disabled={loadingSubmit}
                                    onClick={() => goIncomeUseFreeLotMode()}
                                  >
                                    Añadir ingreso en un lote libre
                                  </Button>
                                ) : null}

                                {incomeUseFreeLot && lotsForSelectedPerson.length >= 1 ? (
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="h-8 w-full text-xs"
                                    disabled={loadingSubmit}
                                    onClick={() => goIncomeUseExistingLots()}
                                  >
                                    Abonar en un lote ya de esta persona
                                  </Button>
                                ) : null}

                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <Label className="text-foreground">
                                    Número de lote <span className="text-destructive">*</span>
                                  </Label>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 text-xs"
                                    disabled={loadingSubmit}
                                    onClick={() => clearLots()}
                                  >
                                    Quitar
                                  </Button>
                                </div>
                                <div className="flex max-h-[180px] flex-wrap gap-2 overflow-y-auto rounded-lg border border-border/60 bg-background/80 p-2">
                                  {incomeLotChipNumbers.length === 0 ? (
                                    <p className="w-full px-1 py-2 text-xs text-muted-foreground">
                                      {incomeUseFreeLot
                                        ? "No hay lotes libres en este proyecto."
                                        : "Esta persona aún no tiene lotes en este proyecto."}
                                    </p>
                                  ) : (
                                    incomeLotChipNumbers.map((n) => {
                                      const on = sortedLots.includes(n);
                                      return (
                                        <button
                                          key={n}
                                          type="button"
                                          disabled={loadingSubmit}
                                          onClick={() => toggleLot(n)}
                                          className={
                                            on
                                              ? "min-h-9 min-w-9 rounded-lg bg-primary text-primary-foreground text-sm font-semibold tabular-nums shadow-sm ring-1 ring-primary/30 transition-colors hover:bg-primary/90"
                                              : "min-h-9 min-w-9 rounded-lg border border-border/80 bg-muted/40 text-sm font-medium tabular-nums text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                                          }
                                          aria-pressed={on ? "true" : "false"}
                                        >
                                          {n}
                                        </button>
                                      );
                                    })
                                  )}
                                </div>
                              </div>
                            ) : (
                              <p className="text-xs text-amber-900 dark:text-amber-100/90">
                                Elige la persona del catálogo para un lote libre, o selecciona un titular arriba.
                              </p>
                            )}
                          </div>
                        ) : null}
                      </div>
                    ) : null}

                    {modalProject.lotCount >= 1 &&
                    !isIncome &&
                    !isGastosProjectId(modalProject.id) &&
                    person?.id ? (
                      <div className="space-y-3">
                        {lotsForSelectedPerson.length === 0 ? (
                          <>
                            <p className="text-sm font-medium text-foreground">Lote (libre o sin asignar aún)</p>
                            <p className="text-xs text-muted-foreground">
                              No hay lotes vinculados a esta persona (ni por movimientos ni por haber sido titular y
                              ceder); solo ves números libres. El disponible puede ser 0 si no hay ingresos a ese
                              lote.
                            </p>
                          </>
                        ) : (
                          <>
                            <p className="text-sm font-medium text-foreground">
                              {lotsForSelectedPerson.length > 1
                                ? "¿A cuál lote va este egreso?"
                                : "Lote asignado a esta persona"}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Un solo lote por registro. No se reparte entre varios. Si esta persona fue titular y
                              cedió el lote, el número sigue apareciendo aquí para poder imputar devoluciones u otros
                              egresos al ex titular.
                            </p>
                          </>
                        )}

                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <Label className="text-foreground">
                            Número de lote <span className="text-destructive">*</span>
                          </Label>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs"
                            disabled={loadingSubmit}
                            onClick={() => clearLots()}
                          >
                            Quitar
                          </Button>
                        </div>
                        <div className="flex max-h-[180px] flex-wrap gap-2 overflow-y-auto rounded-lg border border-border/60 bg-background/80 p-2">
                          {expenseLotChipNumbers.length === 0 ? (
                            <p className="w-full px-1 py-2 text-xs text-muted-foreground">
                              No hay lotes disponibles para imputar este egreso.
                            </p>
                          ) : (
                            expenseLotChipNumbers.map((n) => {
                              const on = sortedLots.includes(n);
                              return (
                                <button
                                  key={n}
                                  type="button"
                                  disabled={loadingSubmit}
                                  onClick={() => toggleLot(n)}
                                  className={
                                    on
                                      ? "min-h-9 min-w-9 rounded-lg bg-primary text-primary-foreground text-sm font-semibold tabular-nums shadow-sm ring-1 ring-primary/30 transition-colors hover:bg-primary/90"
                                      : "min-h-9 min-w-9 rounded-lg border border-border/80 bg-muted/40 text-sm font-medium tabular-nums text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                                  }
                                  aria-pressed={on ? "true" : "false"}
                                >
                                  {n}
                                </button>
                              );
                            })
                          )}
                        </div>
                      </div>
                    ) : null}

                    {isIncome && effectiveSortedLots.length === 1 ? (
                      <div className="space-y-2 pt-1">
                        <Label htmlFor="mov-lot-value">Valor del lote (opcional)</Label>
                        <Input
                          id="mov-lot-value"
                          inputMode="decimal"
                          placeholder="Se sugiere al elegir un solo lote si ya hay otro ingreso a ese lote"
                          value={lotValueStr}
                          onChange={(e) => setLotValueStr(e.target.value)}
                          autoComplete="off"
                          disabled={modalProject.lotCount < 1 || loadingSubmit}
                        />
                        <p className="text-xs text-muted-foreground">
                          Opcional: referencia del valor del lote si ya consta en otro ingreso a ese número.
                        </p>
                      </div>
                    ) : null}

                    {!isIncome && linkedToLot && modalProject.lotCount >= 1 ? (
                      <div className="space-y-2 rounded-md border border-border/70 bg-background/80 px-3 py-2 text-xs">
                        {loadingModalProjectMovements ? (
                          <p className="text-muted-foreground">Cargando movimientos del proyecto…</p>
                        ) : effectiveSortedLots.length === 1 && expenseLotLedger && previewLot !== null ? (
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
                            Elige un lote e indica el monto para ver el saldo disponible.
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
                    {isIncome ? (
                      linkedToLot ? (
                        effectiveSortedLots.length === 1 &&
                        previewLot !== null &&
                        !Number.isNaN(previewLot) &&
                        modalProject &&
                        previewLot >= 1 &&
                        previewLot <= modalProject.lotCount ? (
                          <span className="text-muted-foreground tabular-nums">
                            · Lote {previewLot}
                            {previewLotValue !== null
                              ? ` · Valor lote ${moneyFmt.format(previewLotValue)}`
                              : ""}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">· Elige un lote</span>
                        )
                      ) : (
                        <span className="text-muted-foreground">· Ingreso general</span>
                      )
                    ) : modalProject && !isGastosProjectId(modalProject.id) && expenseMode === "trabajador" ? (
                      <span className="text-muted-foreground">
                        · {workerContractor?.name.trim() || "Elige contratista"}
                      </span>
                    ) : linkedToLot ? (
                      effectiveSortedLots.length === 1 &&
                      previewLot !== null &&
                      !Number.isNaN(previewLot) &&
                      modalProject &&
                      previewLot >= 1 &&
                      previewLot <= modalProject.lotCount ? (
                        <span className="text-muted-foreground tabular-nums">· Lote {previewLot}</span>
                      ) : (
                        <span className="text-muted-foreground">· Elige un lote</span>
                      )
                    ) : expenseMode === "devolucion" ? (
                      <span className="text-muted-foreground">· Devolución</span>
                    ) : (
                      <span className="text-muted-foreground">· Egreso general</span>
                    )}
                  </div>
                  {!isIncome && expenseMode === "trabajador" && workerContractor?.name.trim() ? (
                    <p className="mt-1.5 text-xs text-muted-foreground">
                      Contratista:{" "}
                      <span className="font-medium text-foreground">{workerContractor.name.trim()}</span>
                      {workerContractor.phone.trim() ? (
                        <span className="ml-1 tabular-nums">· {workerContractor.phone.trim()}</span>
                      ) : null}
                    </p>
                  ) : null}
                  {person?.name &&
                  (linkedToLot || (!isIncome && expenseMode === "devolucion")) ? (
                    <p className="mt-1.5 text-xs text-muted-foreground">
                      Persona:{" "}
                      <span className="font-medium text-foreground">{person.name}</span>
                    </p>
                  ) : null}
                </motion.div>
              ) : null}
            </AnimatePresence>

            {previewVisible ? (
              <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                <Button
                  type="button"
                  variant="secondary"
                  disabled={loadingSubmit || !canChainSubmit}
                  className="w-full sm:w-auto"
                  onClick={() => void performSave(true)}
                >
                  {loadingSubmit ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Guardando…
                    </>
                  ) : (
                    <>
                      <Plus className="mr-2 h-4 w-4" />
                      Registrar y añadir otro
                    </>
                  )}
                </Button>
              </div>
            ) : null}

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
                  !canChainSubmit ||
                  (kind === "expense" &&
                    linkedToLot &&
                    loadingModalProjectMovements &&
                    expenseMode !== "trabajador") ||
                  (kind === "income" &&
                    linkedToLot &&
                    (loadingModalProjectMovements || loadingModalLots))
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
