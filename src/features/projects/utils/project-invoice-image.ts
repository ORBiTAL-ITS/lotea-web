import type { Project } from "../models/project-types";

/** Prioriza imagen embebida (comprimida); si no hay, URL externa. */
export function getProjectInvoiceImageSrc(project: Pick<Project, "invoiceImageData" | "invoiceImageUrl">): string | null {
  const data = project.invoiceImageData?.trim();
  if (data && data.startsWith("data:image/")) return data;
  const url = project.invoiceImageUrl?.trim();
  if (url) return url;
  return null;
}
