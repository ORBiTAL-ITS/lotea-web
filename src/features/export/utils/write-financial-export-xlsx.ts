import ExcelJS from "exceljs";
import type { Border, Borders, Cell, Row, Worksheet } from "exceljs";
import type { Movement } from "@/features/movements/models/movement-types";
import type { Project } from "@/features/projects/models/project-types";
import {
  formatMovementDay,
  formatMovementInvoice,
  movementDateForAccounting,
} from "@/features/movements/utils/movements-display";

/** COP sin decimales; miles con separador regional en Excel. */
const COP_NUM_FMT = "#,##0";

const EMPTY_ROWS = 3;

const COLOR_RED = "FFCC0000";
const COLOR_GREEN = "FF1B5E20";
const COLOR_BLUE = "FF0D47A1";
const BORDER_COLOR = "FFCCCCCC";

function sortByAccountingDateAsc(a: Movement, b: Movement): number {
  const ka = movementDateForAccounting(a);
  const kb = movementDateForAccounting(b);
  const sa = ka?.seconds ?? 0;
  const sb = kb?.seconds ?? 0;
  if (sa !== sb) return sa - sb;
  return a.id.localeCompare(b.id);
}

/** Persona con nombre; si no hay, se muestra el concepto para no dejar la celda vacía de contexto. */
function personOrConcept(m: Movement): string {
  const p = m.personName?.trim();
  if (p) return p;
  const c = m.concept?.trim();
  if (c) return c;
  return "—";
}

function thinBorder(): Partial<Borders> {
  const e: Border = { style: "thin", color: { argb: BORDER_COLOR } };
  return { top: e, bottom: e, left: e, right: e };
}

function applyGrid(
  sheet: Worksheet,
  r1: number,
  c1: number,
  r2: number,
  c2: number,
) {
  const b = thinBorder();
  for (let r = r1; r <= r2; r++) {
    for (let c = c1; c <= c2; c++) {
      sheet.getRow(r).getCell(c).border = b;
    }
  }
}

function setMoney(cell: Cell, value: number) {
  cell.value = value;
  cell.numFmt = COP_NUM_FMT;
}

function styleTotalRed(cell: Cell) {
  cell.font = { color: { argb: COLOR_RED }, bold: true };
}

function styleSubtotalGastoEgresoRow(row: Row, lastCol: number) {
  for (let c = 1; c <= lastCol; c++) {
    row.getCell(c).font = {
      color: { argb: COLOR_RED },
      bold: true,
      underline: true,
    };
  }
}

function styleSubtotalIngresoRow(row: Row, lastCol: number) {
  for (let c = 1; c <= lastCol; c++) {
    row.getCell(c).font = {
      color: { argb: COLOR_GREEN },
      bold: true,
      underline: true,
    };
  }
}

function styleResultadoRow(row: Row) {
  row.getCell(1).font = {
    color: { argb: COLOR_BLUE },
    bold: true,
    underline: true,
  };
  row.getCell(2).font = {
    color: { argb: COLOR_BLUE },
    bold: true,
    underline: true,
  };
}

export type FinancialExportInput = {
  periodoLabel: string;
  gastos: Movement[];
  proyectos: {
    project: Project;
    egresos: Movement[];
    ingresos: Movement[];
  }[];
};

export function defaultExportFileBase(periodoLabel: string): string {
  const safe = periodoLabel
    .replace(/[^\d\-_.a-zA-ZáéíóúÁÉÍÓÚñÑ\s]/g, "")
    .trim()
    .replace(/\s+/g, "_");
  const stamp = new Date().toISOString().slice(0, 10);
  return `lotea_export_${safe || "periodo"}_${stamp}`;
}

function writeGastosHeader(row: Row) {
  row.getCell(1).value = "Fecha";
  row.getCell(2).value = "Comprobante";
  row.getCell(3).value = "Detalle";
  row.getCell(4).value = "Persona";
  row.getCell(5).value = "Lote";
  row.getCell(6).value = "Valor (COP)";
  row.font = { bold: true };
}

function writeEgresosHeader(row: Row) {
  row.getCell(1).value = "Fecha";
  row.getCell(2).value = "Comprobante";
  row.getCell(3).value = "Concepto";
  row.getCell(4).value = "Persona";
  row.getCell(5).value = "Lote";
  row.getCell(6).value = "Valor (COP)";
  row.font = { bold: true };
}

function writeIngresosHeader(row: Row) {
  row.getCell(1).value = "Fecha";
  row.getCell(2).value = "Comprobante";
  row.getCell(3).value = "Concepto";
  row.getCell(4).value = "Persona";
  row.getCell(5).value = "Lote";
  row.getCell(6).value = "Valor (COP)";
  row.getCell(7).value = "Valor lote ref. (COP)";
  row.font = { bold: true };
}

export async function downloadFinancialExportXlsx(
  input: FinancialExportInput,
  fileBase: string,
): Promise<void> {
  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet("Informe", {
    views: [{ showGridLines: true }],
  });

  sheet.columns = [
    { width: 14 },
    { width: 14 },
    { width: 36 },
    { width: 28 },
    { width: 8 },
    { width: 16 },
    { width: 16 },
  ];

  let r = 1;
  const title = sheet.getRow(r);
  title.getCell(1).value = "Informe financiero";
  title.getCell(1).font = { bold: true, size: 14 };
  r++;

  sheet.getRow(r).getCell(1).value = "Periodo";
  sheet.getRow(r).getCell(2).value = input.periodoLabel;
  r++;
  r++;

  const gastosSorted = [...input.gastos].sort(sortByAccountingDateAsc);
  const totalGastos = gastosSorted.reduce((s, m) => s + m.amount, 0);

  const gStart = r;
  sheet.getRow(r).getCell(1).value = "Gastos generales (empresa)";
  sheet.getRow(r).getCell(1).font = { bold: true };
  r++;

  const gastosCols = 6;
  writeGastosHeader(sheet.getRow(r));
  r++;

  for (const m of gastosSorted) {
    const ts = movementDateForAccounting(m);
    const row = sheet.getRow(r);
    row.getCell(1).value = formatMovementDay(ts);
    row.getCell(2).value = formatMovementInvoice(m);
    row.getCell(3).value = m.concept;
    row.getCell(4).value = personOrConcept(m);
    row.getCell(5).value =
      m.linkedToLot && m.lotNumber != null ? m.lotNumber : "—";
    setMoney(row.getCell(6), m.amount);
    r++;
  }

  const gTotalRow = sheet.getRow(r);
  gTotalRow.getCell(1).value = "Total gastos generales";
  styleSubtotalGastoEgresoRow(gTotalRow, gastosCols);
  setMoney(gTotalRow.getCell(6), totalGastos);
  gTotalRow.getCell(6).font = {
    color: { argb: COLOR_RED },
    bold: true,
    underline: true,
  };
  gTotalRow.getCell(6).numFmt = COP_NUM_FMT;
  r++;

  applyGrid(sheet, gStart, 1, r - 1, gastosCols);

  r += EMPTY_ROWS;

  let totalEgresosProyectos = 0;
  let totalIngresosProyectos = 0;

  for (const block of input.proyectos) {
    const eg = [...block.egresos].sort(sortByAccountingDateAsc);
    const inc = [...block.ingresos].sort(sortByAccountingDateAsc);
    const sumEg = eg.reduce((s, m) => s + m.amount, 0);
    const sumIn = inc.reduce((s, m) => s + m.amount, 0);
    totalEgresosProyectos += sumEg;
    totalIngresosProyectos += sumIn;

    const eStart = r;
    sheet.getRow(r).getCell(1).value = `Egresos — ${block.project.name}`;
    sheet.getRow(r).getCell(1).font = { bold: true };
    r++;

    writeEgresosHeader(sheet.getRow(r));
    r++;

    for (const m of eg) {
      const ts = movementDateForAccounting(m);
      const row = sheet.getRow(r);
      row.getCell(1).value = formatMovementDay(ts);
      row.getCell(2).value = formatMovementInvoice(m);
      row.getCell(3).value = m.concept;
      row.getCell(4).value = personOrConcept(m);
      row.getCell(5).value =
        m.linkedToLot && m.lotNumber != null ? m.lotNumber : "—";
      setMoney(row.getCell(6), m.amount);
      r++;
    }

    const eSub = sheet.getRow(r);
    eSub.getCell(1).value = `Subtotal egresos (${block.project.name})`;
    styleSubtotalGastoEgresoRow(eSub, 6);
    setMoney(eSub.getCell(6), sumEg);
    eSub.getCell(6).font = {
      color: { argb: COLOR_RED },
      bold: true,
      underline: true,
    };
    eSub.getCell(6).numFmt = COP_NUM_FMT;
    r++;

    applyGrid(sheet, eStart, 1, r - 1, 6);

    r += EMPTY_ROWS;

    const iStart = r;
    sheet.getRow(r).getCell(1).value = `Ingresos — ${block.project.name}`;
    sheet.getRow(r).getCell(1).font = { bold: true };
    r++;

    writeIngresosHeader(sheet.getRow(r));
    r++;

    for (const m of inc) {
      const ts = movementDateForAccounting(m);
      const row = sheet.getRow(r);
      row.getCell(1).value = formatMovementDay(ts);
      row.getCell(2).value = formatMovementInvoice(m);
      row.getCell(3).value = m.concept;
      row.getCell(4).value = personOrConcept(m);
      row.getCell(5).value =
        m.linkedToLot && m.lotNumber != null ? m.lotNumber : "—";
      setMoney(row.getCell(6), m.amount);
      const lv = m.lotValue != null && m.lotValue > 0 ? m.lotValue : null;
      if (lv != null) setMoney(row.getCell(7), lv);
      else row.getCell(7).value = "—";
      r++;
    }

    const iSub = sheet.getRow(r);
    iSub.getCell(1).value = `Subtotal ingresos (${block.project.name})`;
    styleSubtotalIngresoRow(iSub, 7);
    setMoney(iSub.getCell(6), sumIn);
    iSub.getCell(6).font = {
      color: { argb: COLOR_GREEN },
      bold: true,
      underline: true,
    };
    iSub.getCell(6).numFmt = COP_NUM_FMT;
    iSub.getCell(7).value = "";
    r++;

    applyGrid(sheet, iStart, 1, r - 1, 7);

    r += EMPTY_ROWS;
  }

  const totalSalidas = totalGastos + totalEgresosProyectos;
  const balance = totalIngresosProyectos - totalSalidas;

  r += EMPTY_ROWS;

  const resStart = r;
  sheet.getRow(r).getCell(1).value = "Resumen";
  sheet.getRow(r).getCell(1).font = { bold: true, size: 12 };
  r++;

  const resumenRows: { label: string; value: number }[] = [
    { label: "Total gastos generales (COP)", value: totalGastos },
    {
      label: "Total egresos en proyectos seleccionados (COP)",
      value: totalEgresosProyectos,
    },
    { label: "Total egresos y gastos — salidas (COP)", value: totalSalidas },
    {
      label: "Total ingresos en proyectos seleccionados (COP)",
      value: totalIngresosProyectos,
    },
  ];

  for (const item of resumenRows) {
    const rr = sheet.getRow(r);
    rr.getCell(1).value = item.label;
    styleTotalRed(rr.getCell(1));
    setMoney(rr.getCell(2), item.value);
    styleTotalRed(rr.getCell(2));
    rr.getCell(2).numFmt = COP_NUM_FMT;
    r++;
  }

  const finRow = sheet.getRow(r);
  finRow.getCell(1).value = "Resultado: ingresos − salidas (COP)";
  setMoney(finRow.getCell(2), balance);
  finRow.getCell(2).numFmt = COP_NUM_FMT;
  styleResultadoRow(finRow);
  r++;

  applyGrid(sheet, resStart, 1, r - 1, 2);

  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${fileBase}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}
