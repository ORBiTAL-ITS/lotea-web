export type OwnerPayment = {
  id: string;
  ownerId: string;
  ownerName: string;
  lotNumber: number | null;
  amount: number;
  concept: string;
  paymentDate: { seconds: number; nanoseconds: number } | null;
  createdAt?: { seconds: number; nanoseconds: number } | null;
};

export type MonthlyRefund = {
  id: string;
  cedenteId: string;
  cedenteName: string;
  lotNumber: number | null;
  amount: number;
  concept: string;
  refundMonth: string;
  refundDate: { seconds: number; nanoseconds: number } | null;
  createdAt?: { seconds: number; nanoseconds: number } | null;
};

export type WorkerPayment = {
  id: string;
  workerName: string;
  /** Referencia al catálogo de contratistas (opcional en registros antiguos). */
  contractorId?: string;
  workerPhone?: string;
  amount: number;
  concept: string;
  paymentDate: { seconds: number; nanoseconds: number } | null;
  createdAt?: { seconds: number; nanoseconds: number } | null;
};

export type OwnerPortfolioSummary = {
  ownerId: string;
  ownerName: string;
  projects: Set<string>;
  lots: Set<string>;
  totalPaid: number;
  totalRefunds: number;
};
