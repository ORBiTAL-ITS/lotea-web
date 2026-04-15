import {
  Timestamp,
  collection,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { db } from "@/shared/firebase/firebase-client";

export type DeleteAuditInput = {
  entityType: string;
  entityId: string;
  projectId: string;
  deletedBy?: string | null;
  deleteReason?: string | null;
  originModule: string;
  snapshot: Record<string, unknown>;
};

export type DeleteAuditRecord = {
  id: string;
  entityType: string;
  entityId: string;
  projectId: string;
  deletedBy: string | null;
  deleteReason: string | null;
  originModule: string;
  deletedAt: { seconds: number; nanoseconds: number } | null;
};

function deletedRecordsCol(companyId: string) {
  return collection(db, "companies", companyId, "auditDeletedRecords");
}

export async function createDeleteAuditRecord(
  companyId: string,
  input: DeleteAuditInput,
): Promise<void> {
  const ref = doc(deletedRecordsCol(companyId));
  await setDoc(ref, {
    entityType: input.entityType,
    entityId: input.entityId,
    projectId: input.projectId,
    deletedBy: input.deletedBy ?? null,
    deleteReason: input.deleteReason?.trim() ? input.deleteReason.trim() : null,
    originModule: input.originModule,
    snapshot: input.snapshot,
    deletedAt: serverTimestamp(),
  });
}

function parseTimestamp(raw: unknown): { seconds: number; nanoseconds: number } | null {
  if (!raw) return null;
  if (raw instanceof Timestamp) {
    return { seconds: Number(raw.seconds), nanoseconds: Number(raw.nanoseconds) };
  }
  if (typeof raw === "object" && raw !== null && "seconds" in raw) {
    const data = raw as { seconds: unknown; nanoseconds?: unknown };
    const sec = Number(data.seconds);
    const ns = Number(data.nanoseconds ?? 0);
    if (Number.isFinite(sec)) return { seconds: sec, nanoseconds: Number.isFinite(ns) ? ns : 0 };
  }
  return null;
}

export async function fetchDeleteAuditRecords(companyId: string): Promise<DeleteAuditRecord[]> {
  const snap = await getDocs(query(deletedRecordsCol(companyId), orderBy("deletedAt", "desc")));
  return snap.docs.map((d) => {
    const data = d.data() as Record<string, unknown>;
    return {
      id: d.id,
      entityType: String(data.entityType ?? ""),
      entityId: String(data.entityId ?? ""),
      projectId: String(data.projectId ?? ""),
      deletedBy:
        typeof data.deletedBy === "string" && data.deletedBy.trim().length > 0
          ? data.deletedBy.trim()
          : null,
      deleteReason:
        typeof data.deleteReason === "string" && data.deleteReason.trim().length > 0
          ? data.deleteReason.trim()
          : null,
      originModule:
        typeof data.originModule === "string" && data.originModule.trim().length > 0
          ? data.originModule.trim()
          : "unknown",
      deletedAt: parseTimestamp(data.deletedAt),
    };
  });
}
