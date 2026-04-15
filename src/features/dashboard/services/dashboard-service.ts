import { fetchProjects } from "@/features/projects/services/projects-service";
import { fetchMovements } from "@/features/movements/services/movements-service";
import type { Movement } from "@/features/movements/models/movement-types";
import {
  movementCalendarMonthKey,
  movementDateForAccounting,
  movementInCalendarMonth,
  movementSortSeconds,
  normalizeYearMonthInput,
} from "@/features/movements/utils/movements-display";

export type ProjectMonthSlice = {
  projectId: string;
  projectName: string;
  projectCode: string;
  income: number;
  expense: number;
};

export type DashboardMovementRow = {
  id: string;
  projectId: string;
  projectName: string;
  projectCode: string;
  movement: Movement;
};

export type MonthTrendPoint = {
  monthKey: string;
  label: string;
  income: number;
  expense: number;
};

export type CompanyDashboardData = {
  monthKey: string;
  totalIncome: number;
  totalExpense: number;
  net: number;
  projectCount: number;
  byProject: ProjectMonthSlice[];
  trend: MonthTrendPoint[];
  recentMovements: DashboardMovementRow[];
};

function monthLabelEs(ym: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(ym);
  if (!m) return ym;
  const mo = Number(m[2]);
  const names = [
    "Ene",
    "Feb",
    "Mar",
    "Abr",
    "May",
    "Jun",
    "Jul",
    "Ago",
    "Sep",
    "Oct",
    "Nov",
    "Dic",
  ];
  const label = names[mo - 1] ?? m[2];
  return `${label} ${m[1]}`;
}

/** Seis meses cerrando en `endYm` (orden cronológico). */
function last6MonthKeys(endYm: string): string[] {
  const norm = normalizeYearMonthInput(endYm);
  if (!norm) return [];
  const m = /^(\d{4})-(\d{2})$/.exec(norm);
  if (!m) return [];
  let y = Number(m[1]);
  let mo = Number(m[2]);
  const keys: string[] = [];
  for (let i = 0; i < 6; i++) {
    keys.unshift(`${y}-${String(mo).padStart(2, "0")}`);
    mo -= 1;
    if (mo < 1) {
      mo = 12;
      y -= 1;
    }
  }
  return keys;
}

function activeAmount(m: Movement): number {
  if (m.status === "deleted") return 0;
  const a = m.amount;
  return typeof a === "number" && Number.isFinite(a) && a > 0 ? a : 0;
}

/**
 * Una lectura por proyecto: totales del mes elegido, tendencia 6 meses y últimos movimientos del mes.
 */
export async function fetchCompanyDashboardData(
  companyId: string,
  monthKeyInput: string,
): Promise<CompanyDashboardData> {
  const monthKey = normalizeYearMonthInput(monthKeyInput);
  if (!monthKey) {
    throw new Error("Mes no válido.");
  }

  const projects = await fetchProjects(companyId);
  const projectCount = projects.length;

  const trendKeys = last6MonthKeys(monthKey);
  const trendMap = new Map(trendKeys.map((k) => [k, { income: 0, expense: 0 }]));

  const byProject = new Map<string, ProjectMonthSlice>();
  for (const p of projects) {
    byProject.set(p.id, {
      projectId: p.id,
      projectName: p.name,
      projectCode: p.code,
      income: 0,
      expense: 0,
    });
  }

  const recentPool: DashboardMovementRow[] = [];

  for (const p of projects) {
    const movements = await fetchMovements(companyId, p.id);
    for (const m of movements) {
      if (m.status === "deleted") continue;

      const amt = activeAmount(m);
      if (amt <= 0) continue;

      const ts = movementDateForAccounting(m);
      const mk = ts ? movementCalendarMonthKey(ts) : null;
      if (mk && trendMap.has(mk)) {
        const bucket = trendMap.get(mk)!;
        if (m.kind === "income") bucket.income += amt;
        else if (m.kind === "expense") bucket.expense += amt;
      }

      if (movementInCalendarMonth(m, monthKey)) {
        const slice = byProject.get(p.id);
        if (slice) {
          if (m.kind === "income") slice.income += amt;
          else if (m.kind === "expense") slice.expense += amt;
        }
        recentPool.push({
          id: m.id,
          projectId: p.id,
          projectName: p.name,
          projectCode: p.code,
          movement: m,
        });
      }
    }
  }

  let totalIncome = 0;
  let totalExpense = 0;
  for (const s of byProject.values()) {
    totalIncome += s.income;
    totalExpense += s.expense;
  }

  const byProjectList = [...byProject.values()].filter((s) => s.income > 0 || s.expense > 0);
  byProjectList.sort((a, b) => b.income + b.expense - (a.income + a.expense));

  recentPool.sort((a, b) => movementSortSeconds(b.movement) - movementSortSeconds(a.movement));
  const recentMovements = recentPool.slice(0, 12);

  const trend: MonthTrendPoint[] = trendKeys.map((k) => {
    const v = trendMap.get(k)!;
    return {
      monthKey: k,
      label: monthLabelEs(k),
      income: v.income,
      expense: v.expense,
    };
  });

  return {
    monthKey,
    totalIncome,
    totalExpense,
    net: totalIncome - totalExpense,
    projectCount,
    byProject: byProjectList,
    trend,
    recentMovements,
  };
}
