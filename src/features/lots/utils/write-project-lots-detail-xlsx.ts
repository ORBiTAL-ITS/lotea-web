import ExcelJS from "exceljs";
import type { Lot, LotPaymentSummary, LotTransfer, ProjectLotsAvailability } from "../models/lot-types";

const MIME =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" as const;

const COP_NUM_FMT = "#,##0";

function fmtTs(ts: { seconds: number; nanoseconds: number } | null | undefined): string {
  if (!ts?.seconds) return "—";
  return new Date(ts.seconds * 1000).toLocaleString("es-CO");
}

export async function downloadProjectLotsDetailXlsx(input: {
  companyName: string | null;
  availability: ProjectLotsAvailability;
  lots: Lot[];
  paymentSummaries: LotPaymentSummary[];
  transfers: LotTransfer[];
}): Promise<void> {
  const wb = new ExcelJS.Workbook();

  const summary = wb.addWorksheet("Resumen");
  summary.getCell(1, 1).value = "Lotes — resumen por proyecto";
  summary.getCell(1, 1).font = { bold: true, size: 14 };
  summary.getCell(2, 1).value = "Empresa";
  summary.getCell(2, 2).value = input.companyName ?? "—";
  summary.getCell(3, 1).value = "Proyecto";
  summary.getCell(3, 2).value = input.availability.projectName;
  summary.getCell(4, 1).value = "Código";
  summary.getCell(4, 2).value = input.availability.projectCode;
  summary.getCell(6, 1).value = "Total lotes";
  summary.getCell(6, 2).value = input.availability.totalLots;
  summary.getCell(7, 1).value = "Disponibles";
  summary.getCell(7, 2).value = input.availability.availableLots;
  summary.getCell(8, 1).value = "Vendidos";
  summary.getCell(8, 2).value = input.availability.soldLots;
  summary.getCell(9, 1).value = "Reservados";
  summary.getCell(9, 2).value = input.availability.reservedLots;
  summary.getCell(10, 1).value = "Devueltos";
  summary.getCell(10, 2).value = input.availability.returnedLots;

  const payMap = new Map(input.paymentSummaries.map((p) => [p.lotNumber, p]));
  const lotsSheet = wb.addWorksheet("Lotes");
  lotsSheet.columns = [
    { width: 8 },
    { width: 12 },
    { width: 28 },
    { width: 22 },
    { width: 20 },
    { width: 16 },
    { width: 16 },
  ];
  const h = lotsSheet.getRow(1);
  h.values = ["", "Lote", "Estado", "Dueño", "Desde", "Pagos lote (COP)", "Pagos titular actual (COP)"];
  h.font = { bold: true };
  let r = 2;
  for (const lot of input.lots) {
    const pay = payMap.get(lot.lotNumber);
    const row = lotsSheet.getRow(r);
    row.getCell(2).value = lot.lotNumber;
    row.getCell(3).value = lot.status;
    row.getCell(4).value = lot.currentOwnerName ?? "—";
    row.getCell(5).value = fmtTs(lot.assignedAt);
    row.getCell(6).value = pay?.totalPaidOnLot ?? 0;
    row.getCell(6).numFmt = COP_NUM_FMT;
    row.getCell(7).value = pay?.totalPaidAsCurrentOwner ?? 0;
    row.getCell(7).numFmt = COP_NUM_FMT;
    r += 1;
  }

  const tr = wb.addWorksheet("Cesiones");
  tr.columns = [
    { width: 20 },
    { width: 8 },
    { width: 22 },
    { width: 22 },
    { width: 28 },
    { width: 36 },
  ];
  const th = tr.getRow(1);
  th.values = ["", "Fecha", "Lote", "Cedente (id)", "Cesionario", "Notas"];
  th.font = { bold: true };
  let trr = 2;
  for (const t of input.transfers) {
    const row = tr.getRow(trr);
    row.getCell(2).value = fmtTs(t.transferDate ?? t.createdAt);
    row.getCell(3).value = t.lotNumber ?? "—";
    row.getCell(4).value = t.fromOwnerId;
    row.getCell(5).value = t.toOwnerName || t.toOwnerId;
    row.getCell(6).value = t.notes ?? "—";
    trr += 1;
  }

  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: MIME });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const safe = input.availability.projectCode.replace(/[^\w-]+/g, "_") || "proyecto";
  a.download = `lotes_${safe}_${new Date().toISOString().slice(0, 10)}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}
