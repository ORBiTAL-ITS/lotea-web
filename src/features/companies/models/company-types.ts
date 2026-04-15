export type Company = {
  id: string;
  name: string;
  legalName?: string | null;
  nit?: string | null;
  phone?: string | null;
  email?: string | null;
  createdAt?: { seconds: number; nanoseconds: number } | null;
};
