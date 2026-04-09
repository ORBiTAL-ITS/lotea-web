"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useAppSelector } from "@/shared/store/hooks";
import {
  selectSessionHydrated,
  selectSessionUser,
} from "@/features/session/models/session-selectors";

export function MasterOnlyGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const hydrated = useAppSelector(selectSessionHydrated);
  const sessionUser = useAppSelector(selectSessionUser);

  useEffect(() => {
    if (!hydrated) return;
    if (!sessionUser || sessionUser.globalRole !== "master") {
      router.replace("/");
    }
  }, [hydrated, sessionUser, router]);

  if (!hydrated || !sessionUser) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-2 p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Cargando permisos...</p>
      </div>
    );
  }

  if (sessionUser.globalRole !== "master") {
    return null;
  }

  return <>{children}</>;
}
