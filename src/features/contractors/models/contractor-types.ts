export type Contractor = {
  id: string;
  name: string;
  /** Opcional en catálogo y en altas. */
  phone: string;
  createdAt?: { seconds: number; nanoseconds: number } | null;
  updatedAt?: { seconds: number; nanoseconds: number } | null;
};
