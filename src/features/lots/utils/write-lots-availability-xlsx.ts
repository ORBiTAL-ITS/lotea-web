import ExcelJS from "exceljs";
import type { ProjectLotsAvailability } from "../models/lot-types";

const COPTS = {
  type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
} as const;

export async function downloadLotsAvailabilityXlsx(
  rows: ProjectLotsAvailability[],
  companyName: string | null,
): Promise<void> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Disponibilidad lotes");
  ws.columns = [
    { width: 4 },
    { width: 28 },
    { width: 12 },
    { width: 14 },
    { width: 14 },
    { width: 14 },
    { width: 14 },
    { width: 14 },
  ];

  ws.getRow(1).getCell(1).value = "Reporte de lotes";
  ws.getRow(1).font = { bold: true, size: 14 };
  ws.getRow(2).getCell(1).value = "Empresa";
  ws.getRow(2).getCell(2).value = companyName ?? "—";
  ws.getRow(3).getCell(1).value = "Fecha";
  ws.getRow(3).getCell(2).value = new Date().toLocaleDateString("es-CO");

  const h = ws.getRow(5);
  h.values = [
    "",
    "Proyecto",
    "Código",
    "Total lotes",
    "Disponibles",
    "Vendidos",
    "Reservados",
    "Devueltos",
  ];
  h.font = { bold: true };

  let row = 6;
  for (const item of rows) {
    ws.getRow(row).values = [
      "",
      item.projectName,
      item.projectCode,
      item.totalLots,
      item.availableLots,
      item.soldLots,
      item.reservedLots,
      item.returnedLots,
    ];
    row += 1;
  }

  const total = ws.getRow(row);
  total.getCell(2).value = "Totales";
  total.getCell(2).font = { bold: true };
  total.getCell(4).value = { formula: `SUM(D6:D${row - 1})` };
  total.getCell(5).value = { formula: `SUM(E6:E${row - 1})` };
  total.getCell(6).value = { formula: `SUM(F6:F${row - 1})` };
  total.getCell(7).value = { formula: `SUM(G6:G${row - 1})` };
  total.getCell(8).value = { formula: `SUM(H6:H${row - 1})` };
  for (const col of [4, 5, 6, 7, 8]) total.getCell(col).font = { bold: true };

  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], COPTS);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `lotes_disponibilidad_${new Date().toISOString().slice(0, 10)}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}
