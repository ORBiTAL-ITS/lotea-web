import { redirect } from "next/navigation";

/** Ruta antigua: la facturación vive en acciones de cada movimiento (ingresos / egresos). */
export default function FacturasPage() {
  redirect("/ingresos");
}
