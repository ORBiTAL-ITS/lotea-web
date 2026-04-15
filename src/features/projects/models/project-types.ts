export type ProjectStatus = "active" | "closed";

export type Project = {
  id: string;
  name: string;
  code: string;
  status: ProjectStatus;
  /** Cantidad de lotes prevista o registrada para el proyecto. */
  lotCount: number;
  /** URL opcional de imagen para encabezado de comprobantes del proyecto. */
  invoiceImageUrl?: string | null;
  /**
   * Imagen comprimida en cliente (data URL) para MVP sin Firebase Storage.
   * Si existe, tiene prioridad sobre `invoiceImageUrl` al mostrar.
   */
  invoiceImageData?: string | null;
  createdAt?: { seconds: number; nanoseconds: number } | null;
};
