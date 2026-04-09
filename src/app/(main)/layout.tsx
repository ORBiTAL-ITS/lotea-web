import { AppShell } from "@/features/shell/components/app-shell";
import { RequireAuth } from "@/features/auth/components/require-auth";

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth>
      <AppShell>{children}</AppShell>
    </RequireAuth>
  );
}
