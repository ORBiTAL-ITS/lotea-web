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
  const sa = loadServiceAccount();
  app = initializeApp({ credential: cert(sa) });
  return app;
}

export function getFirebaseAdminAuth() {
  return getAuth(getFirebaseAdminApp());
}

export function getFirebaseAdminFirestore() {
  return getFirestore(getFirebaseAdminApp());
}
