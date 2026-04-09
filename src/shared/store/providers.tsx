"use client";

import { Provider } from "react-redux";
import { store } from "@/app/store";
import { AuthSyncProvider } from "@/shared/providers/auth-sync-provider";
import { ThemeProvider } from "@/components/theme-provider";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <Provider store={store}>
        <AuthSyncProvider>{children}</AuthSyncProvider>
      </Provider>
    </ThemeProvider>
  );
}
