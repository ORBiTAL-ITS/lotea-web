import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { getFirebaseAdminAuth, getFirebaseAdminFirestore } from "@/lib/firebase-admin";
import { LOTEA_MASTER_EMAIL } from "@/lib/auth-constants";

type Body = {
  email?: string;
  password?: string;
  /** admin = gestión empresa; viewer = solo lectura */
  companyRole?: string;
  /** ID documento existente en `companies/{id}` */
  companyId?: string | null;
  /** Si no hay companyId, se crea la empresa en Firestore y se asigna al usuario (típico para nuevo admin). */
  companyName?: string | null;
};

function isMaster(decoded: {
  role?: string;
  email?: string;
}): boolean {
  if (decoded.role === "master") return true;
  return (decoded.email ?? "").toLowerCase() === LOTEA_MASTER_EMAIL.toLowerCase();
}

/** Administrador de empresa (token con empresa y rol admin). */
function isCompanyAdmin(decoded: {
  role?: string;
  companyRole?: string;
  companyId?: string;
}): boolean {
  if (decoded.role !== "company_user") return false;
  if (decoded.companyRole !== "admin") return false;
  const cid = typeof decoded.companyId === "string" ? decoded.companyId.trim() : "";
  return cid !== "";
}

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

  const asMaster = isMaster({
    role: decoded.role as string | undefined,
    email: decoded.email,
  });
  const asCompanyAdmin = isCompanyAdmin({
    role: decoded.role as string | undefined,
    companyRole: decoded.companyRole as string | undefined,
    companyId: decoded.companyId as string | undefined,
  });

  if (!asMaster && !asCompanyAdmin) {
    return NextResponse.json(
      { error: "Solo un master o un administrador de empresa puede crear usuarios" },
      { status: 403 },
    );
  }

  const email = (body.email ?? "").trim().toLowerCase();
  const password = body.password ?? "";
  const companyRole = body.companyRole;
  const companyIdFromBody =
    body.companyId && String(body.companyId).trim() !== ""
      ? String(body.companyId).trim()
      : null;
  const companyNameRaw =
    body.companyName && String(body.companyName).trim() !== ""
      ? String(body.companyName).trim()
      : null;

  const tokenCompanyId = asCompanyAdmin
    ? String(decoded.companyId).trim()
    : null;

  if (asCompanyAdmin) {
    if (companyNameRaw) {
      return NextResponse.json(
        { error: "Desde el panel de empresa no puedes crear empresas nuevas; usa la cuenta master." },
        { status: 400 },
      );
    }
    if (companyIdFromBody && companyIdFromBody !== tokenCompanyId) {
      return NextResponse.json(
        { error: "Solo puedes invitar usuarios a tu propia empresa." },
        { status: 403 },
      );
    }
  }

  if (!email || !password) {
    return NextResponse.json({ error: "Correo y contraseña requeridos" }, { status: 400 });
  }
  if (password.length < 6) {
    return NextResponse.json(
      { error: "La contraseña debe tener al menos 6 caracteres" },
      { status: 400 },
    );
  }
  if (companyRole !== "admin" && companyRole !== "viewer") {
    return NextResponse.json(
      { error: 'Rol inválido. Usa "admin" o "viewer"' },
      { status: 400 },
    );
  }
  if (asMaster) {
    if (companyIdFromBody && companyNameRaw) {
      return NextResponse.json(
        {
          error:
            "Indica solo uno: ID de empresa existente o nombre para empresa nueva, no ambos.",
        },
        { status: 400 },
      );
    }
    if (companyRole === "viewer" && !companyIdFromBody) {
      return NextResponse.json(
        {
          error:
            "El usuario lector debe vincularse al ID de una empresa que ya exista en Firestore.",
        },
        { status: 400 },
      );
    }
    if (companyRole === "admin" && !companyIdFromBody && !companyNameRaw) {
      return NextResponse.json(
        {
          error:
            "Para un administrador: indica el nombre de la empresa nueva o el ID de una empresa ya creada.",
        },
        { status: 400 },
      );
    }
  }
  if (email === LOTEA_MASTER_EMAIL.toLowerCase()) {
    return NextResponse.json(
      { error: "Usa la cuenta master existente; no recrees este correo" },
      { status: 400 },
    );
  }

  let resolvedCompanyId: string | null = asCompanyAdmin
    ? tokenCompanyId
    : companyIdFromBody;
  let companyDocIdCreated: string | null = null;

  if (!asCompanyAdmin && !resolvedCompanyId && companyNameRaw) {
    try {
      const db = getFirebaseAdminFirestore();
      const ref = await db.collection("companies").add({
        name: companyNameRaw,
        createdAt: FieldValue.serverTimestamp(),
        createdByUid: decoded.uid,
      });
      resolvedCompanyId = ref.id;
      companyDocIdCreated = ref.id;
    } catch (e) {
      console.error("create-company-admin-sdk", e);
      return NextResponse.json(
        { error: "No se pudo crear el documento de empresa en Firestore." },
        { status: 500 },
      );
    }
  }

  try {
    const userRecord = await adminAuth.createUser({
      email,
      password,
      emailVerified: false,
    });

    await adminAuth.setCustomUserClaims(userRecord.uid, {
      role: "company_user",
      companyRole,
      companyId: resolvedCompanyId,
    });

    return NextResponse.json({
      ok: true,
      uid: userRecord.uid,
      email: userRecord.email,
      companyRole,
      companyId: resolvedCompanyId,
      companyCreated: Boolean(companyNameRaw && !companyIdFromBody),
    });
  } catch (err: unknown) {
    if (companyDocIdCreated) {
      try {
        await getFirebaseAdminFirestore().collection("companies").doc(companyDocIdCreated).delete();
      } catch (cleanupErr) {
        console.error("cleanup-orphan-company", cleanupErr);
      }
    }
    const code = err && typeof err === "object" && "code" in err ? String(err.code) : "";
    if (code === "auth/email-already-exists") {
      return NextResponse.json({ error: "Ya existe un usuario con ese correo" }, { status: 409 });
    }
    console.error("create-user", err);
    return NextResponse.json({ error: "No se pudo crear el usuario" }, { status: 500 });
  }
}
