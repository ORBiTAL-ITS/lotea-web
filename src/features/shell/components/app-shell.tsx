"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, Menu } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { GridPattern } from "@/components/ui/grid-pattern";
import { useAppSelector } from "@/shared/store/hooks";
import { selectSessionUser } from "@/features/session/models/session-selectors";
import { useEffectiveCompanyId } from "@/features/session/hooks/use-effective-company-id";
import { fetchCompanyById } from "@/features/companies/services/companies-service";
import { mainNav } from "../config/navigation";
import { signOut } from "@/features/auth/services/auth-service";
import { SiteLogo } from "@/components/brand/site-logo";

function userInitials(fullName: string | undefined, email: string | undefined) {
  const n = fullName?.trim();
  if (n) {
    const parts = n.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      const first = parts[0][0];
      const last = parts[parts.length - 1][0];
      return `${first}${last}`.toUpperCase();
    }
    return parts[0].slice(0, 2).toUpperCase();
  }
  if (email) return email.slice(0, 2).toUpperCase();
  return "—";
}

const navEase = [0.22, 1, 0.36, 1] as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const user = useAppSelector(selectSessionUser);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { companyId } = useEffectiveCompanyId(0);
  const [activeCompanyName, setActiveCompanyName] = useState<string | null>(null);

  useEffect(() => {
    if (!companyId) {
      setActiveCompanyName(null);
      return;
    }
    let cancelled = false;
    void fetchCompanyById(companyId).then((c) => {
      if (!cancelled) setActiveCompanyName(c?.name ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, [companyId]);

  const visibleNav = mainNav.filter(
    (item) => !item.masterOnly || user?.globalRole === "master",
  );

  const initials = useMemo(
    () => userInitials(user?.fullName, user?.email),
    [user?.fullName, user?.email],
  );

  const Sidebar = (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-40 flex w-68 flex-col border-r border-sidebar-border/90 bg-sidebar text-sidebar-foreground shadow-[2px_0_24px_-12px_rgba(0,0,0,0.35)] lg:static lg:z-0 lg:w-64 lg:shadow-none",
        "transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] lg:translate-x-0",
        mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
        "print:hidden",
      )}
    >
      <div className="relative flex h-17 shrink-0 items-center gap-3 border-b border-sidebar-border/80 px-4">
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-linear-to-b from-sidebar-primary/12 to-transparent"
          aria-hidden
        />
        <motion.div
          initial={{ scale: 0.92, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.35, ease: navEase }}
          className="relative shrink-0"
        >
          <Link href="/" onClick={() => setMobileOpen(false)} className="block outline-none ring-sidebar-ring focus-visible:rounded-lg focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar">
            <SiteLogo variant="sidebar" />
          </Link>
        </motion.div>
        <div className="relative hidden min-w-0 sm:block">
          <p className="truncate text-[11px] font-medium leading-tight tracking-wide text-sidebar-foreground/50">
            Plataforma ERP
          </p>
        </div>
      </div>

      <div className="shrink-0 border-b border-sidebar-border/60 px-4 py-2.5">
        {companyId ? (
          <>
            <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-sidebar-foreground/40">
              Empresa activa
            </p>
            <p className="truncate text-xs font-medium leading-snug text-sidebar-foreground/90">
              {activeCompanyName ?? companyId}
            </p>
          </>
        ) : user?.globalRole === "master" ? (
          <p className="text-[11px] leading-snug text-sidebar-foreground/55">
            En{" "}
            <Link
              href="/proyectos"
              className="font-medium text-sidebar-primary underline-offset-2 hover:underline"
              onClick={() => setMobileOpen(false)}
            >
              Proyectos
            </Link>{" "}
            elige la empresa activa.
          </p>
        ) : (
          <p className="text-[11px] text-sidebar-foreground/50">
            Crea tu empresa en{" "}
            <Link
              href="/proyectos"
              className="font-medium text-sidebar-primary underline-offset-2 hover:underline"
              onClick={() => setMobileOpen(false)}
            >
              Proyectos
            </Link>
            .
          </p>
        )}
      </div>

      <nav className="flex flex-1 flex-col overflow-y-auto px-2 py-4" aria-label="Principal">
        <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-sidebar-foreground/40">
          Menú
        </p>
        <ul className="flex flex-col gap-0.5">
          {visibleNav.map((item, index) => {
            const active =
              item.href === "/"
                ? pathname === "/"
                : pathname === item.href || pathname.startsWith(`${item.href}/`);
            const blocked = Boolean(item.requiresCompany && !companyId);

            const className = cn(
              "group relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[13px] font-medium outline-none transition-colors duration-200",
              "focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar",
              blocked &&
                "cursor-not-allowed opacity-45 hover:bg-transparent hover:text-sidebar-foreground/72",
              !blocked &&
                (active
                  ? "bg-sidebar-primary/14 text-sidebar-foreground shadow-sm"
                  : "text-sidebar-foreground/72 hover:bg-sidebar-accent/55 hover:text-sidebar-accent-foreground"),
            );

            return (
              <li key={item.href}>
                <motion.div
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{
                    duration: 0.28,
                    delay: 0.04 + index * 0.035,
                    ease: navEase,
                  }}
                >
                  {blocked ? (
                    <div
                      role="presentation"
                      className={className}
                      title="Selecciona una empresa activa en Proyectos"
                    >
                      <span
                        className={cn(
                          "relative flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sidebar-accent/20 text-sidebar-foreground/55",
                        )}
                      >
                        <item.icon className="h-4 w-4" strokeWidth={1.75} />
                      </span>
                      <span className="relative truncate">{item.label}</span>
                    </div>
                  ) : (
                    <Link
                      href={item.href}
                      onClick={() => setMobileOpen(false)}
                      className={className}
                    >
                      {active ? (
                        <motion.span
                          layoutId="sidebar-active-bar"
                          className="absolute left-0 top-1/2 h-7 w-[3px] -translate-y-1/2 rounded-full bg-sidebar-primary"
                          transition={{ type: "spring", stiffness: 380, damping: 32 }}
                        />
                      ) : null}
                      <span
                        className={cn(
                          "relative flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-all duration-200",
                          active
                            ? "bg-sidebar-primary/20 text-sidebar-primary-foreground"
                            : "bg-sidebar-accent/30 text-sidebar-foreground/80 group-hover:bg-sidebar-accent/50 group-hover:text-sidebar-accent-foreground",
                        )}
                      >
                        <item.icon className="h-4 w-4" strokeWidth={active ? 2 : 1.75} />
                      </span>
                      <span className="relative truncate">{item.label}</span>
                    </Link>
                  )}
                </motion.div>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="mt-auto space-y-2 border-t border-sidebar-border/80 p-3">
        <div className="rounded-xl border border-sidebar-border/60 bg-sidebar-accent/35 px-3 py-3 shadow-sm backdrop-blur-sm">
          <div className="flex items-start gap-3">
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sidebar-primary/25 text-[11px] font-semibold tracking-wide text-sidebar-primary-foreground ring-2 ring-sidebar-primary/20"
              aria-hidden
            >
              {initials}
            </div>
            <div className="min-w-0 flex-1 pt-0.5">
              <p className="truncate text-xs font-semibold leading-tight text-sidebar-foreground">
                {user?.fullName ?? "Usuario"}
              </p>
              <p className="mt-0.5 truncate text-[11px] leading-tight text-sidebar-foreground/55">
                {user?.email}
              </p>
              <p className="mt-1.5 inline-flex rounded-md bg-sidebar-primary/15 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-sidebar-primary">
                {user?.globalRole === "master" ? "Master" : user?.companyRole ?? "Usuario"}
              </p>
            </div>
          </div>
        </div>
        <Button
          variant="ghost"
          className="h-10 w-full justify-start gap-2 rounded-xl text-[13px] font-medium text-sidebar-foreground/85 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
          onClick={() => signOut()}
        >
          <LogOut className="h-4 w-4 opacity-80" />
          Cerrar sesión
        </Button>
      </div>
    </aside>
  );

  return (
    <div className="flex min-h-screen bg-background">
      {mobileOpen && (
        <motion.button
          type="button"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-30 bg-black/35 backdrop-blur-[2px] print:hidden lg:hidden"
          aria-label="Cerrar menú"
          onClick={() => setMobileOpen(false)}
        />
      )}
      {Sidebar}

      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-3 border-b border-border/80 bg-card/85 px-4 shadow-sm backdrop-blur-xl supports-backdrop-filter:bg-card/75 print:hidden lg:px-8">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setMobileOpen((o) => !o)}
            aria-label="Abrir menú"
          >
            <Menu className="h-5 w-5" />
          </Button>
          <motion.div
            className="flex min-w-0 flex-1 items-center gap-3"
            initial={false}
            key={pathname}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, ease: navEase }}
          >
            <Link
              href="/"
              className="shrink-0 outline-none ring-ring focus-visible:rounded-md focus-visible:ring-2 focus-visible:ring-offset-2"
              aria-label="Inicio Lotea"
            >
              <SiteLogo variant="header" />
            </Link>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.17em] text-muted-foreground/90">
                Lotea ERP
              </p>
              <h1 className="truncate text-sm font-semibold tracking-tight text-foreground">
                Gestión de proyectos y finanzas
              </h1>
            </div>
          </motion.div>
        </header>

        <main className="relative flex-1 overflow-x-hidden">
          <GridPattern
            width={48}
            height={48}
            className="opacity-[0.35] mask-[linear-gradient(to_bottom,white_0%,white_55%,transparent_100%)] print:hidden dark:opacity-[0.18]"
          />
          <motion.div
            className="relative z-10"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.32, ease: navEase }}
            key={pathname}
          >
            {children}
          </motion.div>
        </main>
      </div>
    </div>
  );
}
