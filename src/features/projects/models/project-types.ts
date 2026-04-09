export type ProjectStatus = "active" | "closed";

export type Project = {
  id: string;
  name: string;
  code: string;
  status: ProjectStatus;
  /** Cantidad de lotes prevista o registrada para el proyecto. */
  lotCount: number;
  createdAt?: { seconds: number; nanoseconds: number } | null;
};
