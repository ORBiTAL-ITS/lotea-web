import type { Project } from "../models/project-types";

/**
 * Documento interno en Firestore (no es un proyecto de obra): numeración E- aparte.
 * No usar `__...__`: Firestore reserva esos ids (INVALID_ARGUMENT).
 */
export const GASTOS_PROJECT_DOC_ID = "lotea-gastos-generales";

export function isGastosProjectId(id: string | null | undefined): boolean {
  return id === GASTOS_PROJECT_DOC_ID;
}

/** Opción de UI «Gasto»: egreso general de la empresa; solo concepto y monto (y fecha). */
export function gastosOptionProject(): Project {
  return {
    id: GASTOS_PROJECT_DOC_ID,
    name: "Gasto",
    code: "",
    status: "active",
    lotCount: 0,
    createdAt: null,
  };
}
