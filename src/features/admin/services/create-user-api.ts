import { auth } from "@/shared/firebase/firebase-client";

export type CreateCompanyUserInput = {
  email: string;
  password: string;
  companyRole: "admin" | "viewer";
  /** Empresa ya existente en Firestore */
  companyId?: string | null;
  /** Crear documento `companies` nuevo (solo sentido con rol admin; no usar junto con companyId). */
  companyName?: string | null;
};

export async function createCompanyUser(input: CreateCompanyUserInput) {
  const user = auth.currentUser;
  if (!user) throw new Error("Inicia sesión de nuevo.");

  const idToken = await user.getIdToken();
  const res = await fetch("/api/admin/users", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({
      email: input.email,
      password: input.password,
      companyRole: input.companyRole,
      companyId: input.companyId ?? null,
      companyName: input.companyName ?? null,
    }),
  });

  const data = (await res.json().catch(() => ({}))) as { error?: string; ok?: boolean };

  if (!res.ok) {
    throw new Error(data.error ?? "Error al crear usuario");
  }

  return data;
}
