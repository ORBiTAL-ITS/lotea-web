export type LotStatus = "available" | "reserved" | "sold" | "returned";

export type Lot = {
  id: string;
  lotNumber: number;
  status: LotStatus;
  currentOwnerId: string | null;
  currentOwnerName: string | null;
  assignedAt?: { seconds: number; nanoseconds: number } | null;
  /** Valor de referencia del lote (opcional), p. ej. al asignar titular en Lotes. */
  declaredLotValue?: number | null;
  createdAt?: { seconds: number; nanoseconds: number } | null;
  updatedAt?: { seconds: number; nanoseconds: number } | null;
};

export type ProjectLotsAvailability = {
  projectId: string;
  projectName: string;
  projectCode: string;
  totalLots: number;
  availableLots: number;
  soldLots: number;
  reservedLots: number;
  returnedLots: number;
};

export type LotTransfer = {
  id: string;
  lotId: string | null;
  lotNumber: number | null;
  fromOwnerId: string;
  toOwnerId: string;
  toOwnerName: string;
  transferDate: { seconds: number; nanoseconds: number } | null;
  notes: string | null;
  createdAt?: { seconds: number; nanoseconds: number } | null;
};

/** Totales de ingresos por lote (histórico vs titularidad actual). */
export type LotPaymentSummary = {
  lotNumber: number;
  totalPaidOnLot: number;
  totalPaidAsCurrentOwner: number;
};
