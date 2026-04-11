import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { LOTEA_MASTER_EMAIL } from "@/lib/auth-constants";
import { GASTOS_PROJECT_DOC_ID } from "@/features/projects/constants/gastos-project";
import { getFirebaseAdminAuth, getFirebaseAdminFirestore } from "@/lib/firebase-admin";

type Body = {
  companyId?: string;
};

/** Alineado con Firestore: master por claim o por correo allowlist. */
function tokenIsMaster(decoded: { role?: string; email?: string }): boolean {
  if (decoded.role === "master") return true;
  const em = (decoded.email ?? "").trim().toLowerCase();
  return em === LOTEA_MASTER_EMAIL.toLowerCase();
}

/**
 * Crea el documento reservado de «Gasto» con privilegios de administrador (omite reglas de cliente).
 * Útil cuando el cliente no puede hacer setDoc (token desactualizado, etc.).
 */
export async function POST(request: Request) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const companyId = typeof body.companyId === "string" ? body.companyId.trim() : "";
  if (!companyId) {
    return NextResponse.json({ error: "companyId requerido" }, { status: 400 });
  }

  const authHeader = request.headers.get("authorization");
  const token = authHeader?.replace(/^Bearer\s+/i, "");
  if (!token) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const adminAuth = getFirebaseAdminAuth();
  let decoded: Awaited<ReturnType<typeof adminAuth.verifyIdToken>>;
  try {
    decoded = await adminAuth.verifyIdToken(token);
  } catch {
    return NextResponse.json({ error: "Token inválido" }, { status: 401 });
  }

  const role = decoded.role as string | undefined;
  const companyRole = decoded.companyRole as string | undefined;
  const tokenCompanyId = typeof decoded.companyId === "string" ? decoded.companyId : undefined;

  const isMaster = tokenIsMaster(decoded);
  const isCompanyAdmin = role === "company_user" && companyRole === "admin";

  if (!isMaster && !isCompanyAdmin) {
    return NextResponse.json({ error: "Sin permiso para activar Gasto." }, { status: 403 });
  }
  if (!isMaster) {
    if (!tokenCompanyId || tokenCompanyId !== companyId) {
      return NextResponse.json({ error: "La empresa no coincide con tu sesión." }, { status: 403 });
    }
  }

  let db: ReturnType<typeof getFirebaseAdminFirestore>;
  try {
    db = getFirebaseAdminFirestore();
  } catch (e) {
    console.error("ensure-gastos: sin credencial de servicio", e);
    return NextResponse.json(
      { ok: false, error: "Servidor sin credencial de administración (Firebase Admin)." },
      { status: 503 },
    );
  }

  const ref = db.collection("companies").doc(companyId).collection("projects").doc(GASTOS_PROJECT_DOC_ID);

  try {
    let snap;
    try {
      snap = await ref.get();
    } catch (e) {
      return firestoreErrorResponse("lectura", e);
    }
    if (snap.exists) {
      return NextResponse.json({ ok: true, created: false });
    }
    try {
      await ref.set(
        {
          name: "Gastos",
          code: "GASTOS",
          status: "active",
          lotCount: 0,
          createdAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
    } catch (e) {
      return firestoreErrorResponse("escritura", e);
    }
    return NextResponse.json({ ok: true, created: true });
  } catch (e) {
    console.error("ensure-gastos (inesperado)", e);
    return NextResponse.json({ error: "No se pudo crear el registro interno de Gasto." }, { status: 500 });
  }
}

function firestoreErrorResponse(fase: "lectura" | "escritura", e: unknown) {
  const msg = e instanceof Error ? e.message : String(e);
  const code =
    typeof e === "object" && e !== null && "code" in e
      ? String((e as { code: unknown }).code)
      : undefined;
  console.error(`ensure-gastos Firestore (${fase})`, code, msg, e);
  const hint =
    code === "7" || code === "PERMISSION_DENIED" || msg.includes("PERMISSION_DENIED")
      ? " Revisa IAM: la cuenta de servicio necesita permisos de Firestore en el proyecto correcto."
      : code === "5" || code === "NOT_FOUND" || msg.includes("NOT_FOUND")
        ? " Suele indicar proyecto Firebase distinto al de NEXT_PUBLIC_* o cuenta de servicio de otro proyecto."
        : "";
  return NextResponse.json(
    {
      error: `No se pudo completar el registro interno de Gasto (${fase}).`,
      firebaseCode: code,
      firebaseMessage: msg,
      hint: hint || undefined,
    },
    { status: 500 },
  );
}
