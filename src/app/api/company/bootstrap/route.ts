import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { getFirebaseAdminAuth, getFirebaseAdminFirestore } from "@/lib/firebase-admin";

type Body = {
  /** Si no se envía, el servidor usa un nombre por defecto a partir del perfil (ver lógica abajo). */
  name?: string | null;
};

export async function POST(request: Request) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
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
  const existingCompanyId = decoded.companyId;

  if (role === "master") {
    return NextResponse.json({ error: "La cuenta master no usa este flujo." }, { status: 400 });
  }
  if (role !== "company_user" || companyRole !== "admin") {
    return NextResponse.json(
      { error: "Solo administradores de empresa pueden registrar su organización aquí." },
      { status: 403 },
    );
  }
  if (typeof existingCompanyId === "string" && existingCompanyId.trim() !== "") {
    return NextResponse.json({ error: "Tu cuenta ya tiene empresa asignada." }, { status: 400 });
  }

  let name = (body.name ?? "").trim();
  if (!name) {
    const email = (decoded.email ?? "").trim().toLowerCase();
    const local = email.includes("@") ? email.split("@")[0] : email;
    name = local ? `Empresa ${local}` : "Mi empresa";
  }

  const db = getFirebaseAdminFirestore();
  let companyDocId: string | null = null;

  try {
    const ref = await db.collection("companies").add({
      name,
      createdAt: FieldValue.serverTimestamp(),
      createdByUid: decoded.uid,
    });
    companyDocId = ref.id;

    const userRecord = await adminAuth.getUser(decoded.uid);
    const prev = (userRecord.customClaims ?? {}) as Record<string, unknown>;

    await adminAuth.setCustomUserClaims(decoded.uid, {
      ...prev,
      role: "company_user",
      companyRole: "admin",
      companyId: ref.id,
    });

    return NextResponse.json({ ok: true, companyId: ref.id });
  } catch (e) {
    console.error("company-bootstrap", e);
    if (companyDocId) {
      try {
        await db.collection("companies").doc(companyDocId).delete();
      } catch (cleanup) {
        console.error("company-bootstrap-cleanup", cleanup);
      }
    }
    return NextResponse.json({ error: "No se pudo registrar la empresa." }, { status: 500 });
  }
}
