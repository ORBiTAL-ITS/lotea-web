import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { initializeApp, getApps, cert } from "firebase-admin/app";
import type { App } from "firebase-admin/app";
import type { ServiceAccount } from "firebase-admin";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

/**
 * Cuenta de servicio explícita (desarrollo local o CI).
 * En Firebase Hosting + funciones generadas para Next.js, suele usarse ADC (`initializeApp()` sin credencial).
 */
function tryLoadServiceAccount(): (ServiceAccount & { project_id?: string }) | null {
  const rawJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (rawJson) {
    return JSON.parse(rawJson) as ServiceAccount & { project_id?: string };
  }
  const relPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
  if (relPath) {
    const abs = join(process.cwd(), relPath);
    if (!existsSync(abs)) {
      throw new Error(`No se encontró el archivo: ${abs}`);
    }
    return JSON.parse(readFileSync(abs, "utf8")) as ServiceAccount & {
      project_id?: string;
    };
  }
  return null;
}

let app: App | undefined;

export function getFirebaseAdminApp(): App {
  if (app) return app;
  const existing = getApps()[0];
  if (existing) {
    app = existing;
    return app;
  }
  const sa = tryLoadServiceAccount();
  if (sa) {
    const projectId = sa.project_id?.trim();
    if (!projectId) {
      throw new Error("La cuenta de servicio no incluye project_id.");
    }
    app = initializeApp({ credential: cert(sa), projectId });
    return app;
  }
  /** Producción en Google Cloud: credenciales por defecto (p. ej. Cloud Functions para Next.js). */
  app = initializeApp();
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
