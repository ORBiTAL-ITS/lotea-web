"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useAppSelector } from "@/shared/store/hooks";
import {
  selectSessionHydrated,
  selectSessionUser,
} from "@/features/session/models/session-selectors";

export function RedirectIfAuthenticated({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const hydrated = useAppSelector(selectSessionHydrated);
  const user = useAppSelector(selectSessionUser);

  useEffect(() => {
    if (hydrated && user) {
      router.replace("/");
    }
  }, [hydrated, user, router]);

  if (!hydrated) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden />
        <p className="text-sm text-muted-foreground">Cargando...</p>
      </div>
    );
  }

  if (user) {
    return null;
  }

  return <>{children}</>;
}
