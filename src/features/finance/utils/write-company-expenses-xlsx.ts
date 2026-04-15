import ExcelJS from "exceljs";
import type { CompanyExpenseMovementRow } from "../services/finance-service";
import { formatMovementDay } from "@/features/movements/utils/movements-display";

const COP = "#,##0";

export async function downloadCompanyExpensesXlsx(
  rows: CompanyExpenseMovementRow[],
  companyName: string | null,
): Promise<void> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Egresos");
  ws.columns = [
    { width: 12 },
    { width: 28 },
    { width: 10 },
    { width: 36 },
    { width: 14 },
    { width: 8 },
    { width: 22 },
  ];

  ws.getRow(1).getCell(1).value = "Consolidado de egresos";
  ws.getRow(1).font = { bold: true, size: 14 };
  ws.getRow(2).getCell(1).value = "Empresa";
  ws.getRow(2).getCell(2).value = companyName ?? "—";
  ws.getRow(3).getCell(1).value = "Generado";
  ws.getRow(3).getCell(2).value = new Date().toLocaleString("es-CO");

  const header = ws.getRow(5);
  header.values = ["Fecha", "Proyecto", "Código", "Concepto", "Monto", "Lote", "Persona / nota"];
  header.font = { bold: true };

  let r = 6;
  for (const row of rows) {
    const m = row.movement;
    const lot =
      m.linkedToLot && m.lotNumber != null ? String(m.lotNumber) : "—";
    const person = m.personName?.trim() || m.personId || "—";
    ws.getRow(r).values = [
      formatMovementDay(m.movementDate ?? m.createdAt ?? null),
      row.projectName,
      row.projectCode,
      m.concept,
      m.amount,
      lot,
      person,
    ];
    ws.getRow(r).getCell(5).numFmt = COP;
    r += 1;
  }

  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `egresos_consolidado_${new Date().toISOString().slice(0, 10)}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}
