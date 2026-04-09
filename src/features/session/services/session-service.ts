import type { User } from "firebase/auth";
import type { CompanyRole, GlobalRole, SessionUser } from "../models/session-types";
import { LOTEA_MASTER_EMAIL } from "@/lib/auth-constants";

function normalizeCompanyRole(raw: unknown): CompanyRole {
  if (raw === "viewer") return "viewer";
  if (raw === "admin") return "admin";
  return null;
}

/**
 * Construye el usuario de sesión a partir del perfil Firebase y de los custom claims del token.
 */
export function mapFirebaseUserToSession(
  user: User,
  claims: Record<string, unknown> = {},
): SessionUser {
  const email = user.email ?? "";
  const emailLower = email.toLowerCase();
  const claimGlobal = claims.role as string | undefined;
  const companyId =
    typeof claims.companyId === "string" && claims.companyId.trim() !== ""
      ? claims.companyId.trim()
      : null;

  const isMasterByEmail = emailLower === LOTEA_MASTER_EMAIL.toLowerCase();
  const isMasterByClaim = claimGlobal === "master";

  if (isMasterByClaim || isMasterByEmail) {
    return {
      uid: user.uid,
      fullName: user.displayName || email.split("@")[0] || "Usuario",
      email,
      globalRole: "master",
      companyId: null,
      companyRole: null,
    };
  }

  const fromClaim = normalizeCompanyRole(claims.companyRole);
  const companyRole: CompanyRole = fromClaim ?? "admin";

  const globalRole: GlobalRole = "company_user";

  return {
    uid: user.uid,
    fullName: user.displayName || email.split("@")[0] || "Usuario",
    email,
    globalRole,
    companyId,
    companyRole,
  };
}
