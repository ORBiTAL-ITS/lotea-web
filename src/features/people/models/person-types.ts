export type Person = {
  id: string;
  name: string;
  /** Cédula u otro documento. */
  idNumber: string;
  phone: string;
  createdAt?: { seconds: number; nanoseconds: number } | null;
  updatedAt?: { seconds: number; nanoseconds: number } | null;
};
