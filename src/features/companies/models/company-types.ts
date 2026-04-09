export type Company = {
  id: string;
  name: string;
  createdAt?: { seconds: number; nanoseconds: number } | null;
};
