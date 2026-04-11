import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { initializeApp, getApps, cert } from "firebase-admin/app";
import type { App } from "firebase-admin/app";
import type { ServiceAccount } from "firebase-admin";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

function loadServiceAccount(): ServiceAccount {
  const rawJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (rawJson) {
    return JSON.parse(rawJson) as ServiceAccount;
  }
  const relPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
  if (relPath) {
    const abs = join(process.cwd(), relPath);
    if (!existsSync(abs)) {
      throw new Error(`No se encontró el archivo: ${abs}`);
    }
    return JSON.parse(readFileSync(abs, "utf8")) as ServiceAccount;
  }
  throw new Error(
    "Falta FIREBASE_SERVICE_ACCOUNT_JSON o FIREBASE_SERVICE_ACCOUNT_PATH (solo servidor).",
  );
}

let app: App | undefined;

export function getFirebaseAdminApp(): App {
  if (app) return app;
  const existing = getApps()[0];
  if (existing) {
    app = existing;
    return app;
  }
  const sa = loadServiceAccount() as ServiceAccount & { project_id?: string };
  /** Obligatorio para que Auth/Firestore apunten al mismo proyecto que el JSON (evita 5 NOT_FOUND / permisos raros). */
  const projectId = sa.project_id?.trim();
  if (!projectId) {
    throw new Error("La cuenta de servicio no incluye project_id.");
  }
  app = initializeApp({ credential: cert(sa), projectId });
  return app;
}

export function getFirebaseAdminAuth() {
  return getAuth(getFirebaseAdminApp());
}

/**
 * Base de datos Firestore: por defecto `(default)`.
 * Si usas otra BD en la consola, define `FIREBASE_FIRESTORE_DATABASE_ID` (ej. el id de la base, no el nombre visible).
 */
export function getFirebaseAdminFirestore() {
  const a = getFirebaseAdminApp();
  const dbId = (process.env.FIREBASE_FIRESTORE_DATABASE_ID ?? "").trim();
  if (!dbId || dbId === "(default)") {
    return getFirestore(a);
  }
  return getFirestore(a, dbId);
}
