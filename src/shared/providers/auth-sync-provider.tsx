"use client";

import { useEffect } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/shared/firebase/firebase-client";
import { useAppDispatch } from "@/shared/store/hooks";
import { setSessionUser } from "@/features/session/models/session-slice";
import { mapFirebaseUserToSession } from "@/features/session/services/session-service";

export function AuthSyncProvider({ children }: { children: React.ReactNode }) {
  const dispatch = useAppDispatch();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (!user) {
        dispatch(setSessionUser(null));
        return;
      }

      void (async () => {
        try {
          const token = await user.getIdTokenResult();
          dispatch(setSessionUser(mapFirebaseUserToSession(user, token.claims)));
        } catch {
          dispatch(setSessionUser(mapFirebaseUserToSession(user, {})));
        }
      })();
    });
    return () => unsub();
  }, [dispatch]);

  return <>{children}</>;
}
