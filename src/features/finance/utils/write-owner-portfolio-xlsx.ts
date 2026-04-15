import ExcelJS from "exceljs";

type Row = {
  ownerName: string;
  lotRefs: string[];
  totalPaid: number;
  totalRefunds: number;
  net: number;
};

export async function downloadOwnerPortfolioXlsx(
  rows: Row[],
  companyName: string | null,
): Promise<void> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Pagos por dueño");
  ws.columns = [
    { width: 30 },
    { width: 40 },
    { width: 16 },
    { width: 16 },
    { width: 16 },
  ];

  ws.getRow(1).getCell(1).value = "Reporte por dueño";
  ws.getRow(1).font = { bold: true, size: 14 };
  ws.getRow(2).getCell(1).value = "Empresa";
  ws.getRow(2).getCell(2).value = companyName ?? "—";
  ws.getRow(3).getCell(1).value = "Fecha";
  ws.getRow(3).getCell(2).value = new Date().toLocaleDateString("es-CO");

  const header = ws.getRow(5);
  header.values = ["", "Persona", "Lotes", "Pagado bruto", "Devoluciones", "Neto"];
  header.font = { bold: true };

  let row = 6;
  for (const item of rows) {
    ws.getRow(row).values = [
      "",
      item.ownerName,
      item.lotRefs.join(", "),
      item.totalPaid,
      item.totalRefunds,
      item.net,
    ];
    ws.getRow(row).getCell(4).numFmt = "#,##0";
    ws.getRow(row).getCell(5).numFmt = "#,##0";
    ws.getRow(row).getCell(6).numFmt = "#,##0";
    row += 1;
  }

  const total = ws.getRow(row);
  total.getCell(2).value = "Totales";
  total.getCell(2).font = { bold: true };
  total.getCell(4).value = { formula: `SUM(D6:D${row - 1})` };
  total.getCell(5).value = { formula: `SUM(E6:E${row - 1})` };
  total.getCell(6).value = { formula: `SUM(F6:F${row - 1})` };
  for (const col of [4, 5, 6]) {
    total.getCell(col).numFmt = "#,##0";
    total.getCell(col).font = { bold: true };
  }

  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `duenos_pagos_${new Date().toISOString().slice(0, 10)}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}
