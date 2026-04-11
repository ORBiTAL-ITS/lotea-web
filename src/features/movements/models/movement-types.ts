export type MovementKind = "income" | "expense";

/** instante Firestore ({ seconds, nanoseconds }) tras leer el doc. */
export type MovementTimestamp = { seconds: number; nanoseconds: number } | null;

export type Movement = {
  id: string;
  concept: string;
  /** Montante siempre positivo; el tipo indica ingreso o egreso. */
  amount: number;
  kind: MovementKind;
  /** Ingreso o egreso: si es true, el movimiento va imputado a `lotNumber`. */
  linkedToLot: boolean;
  /** Imputación a lote: 1..N. Movimiento general del proyecto: null. */
  lotNumber: number | null;
  /**
   * Ingreso imputado a lote: valor de referencia del lote (COP), opcional. No aplica a egresos ni a ingresos generales.
   */
  lotValue: number | null;
  /**
   * Número de factura interno por proyecto: secuencia propia para ingresos y otra para egresos.
   * Ausente en datos migrados hasta retroasignar.
   */
  invoiceNumber?: number | null;
  /** Fecha contable (día) para informes y filtro por mes. */
  movementDate: MovementTimestamp;
  createdAt?: MovementTimestamp;
  /** Persona vinculada cuando el movimiento va a lote (catálogo `companies/.../people`). */
  personId?: string | null;
  /** Nombre mostrado (snapshot al guardar). */
  personName?: string | null;
};
