"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  ChevronRight,
  Layers,
  UserPlus,
  Wallet,
} from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { CreateUserForm } from "@/features/admin/components/create-user-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAppSelector } from "@/shared/store/hooks";
import { selectSessionUser } from "@/features/session/models/session-selectors";
import { useEffectiveCompanyId } from "@/features/session/hooks/use-effective-company-id";
import { countProjects } from "@/features/projects/services/projects-service";
import { dashboardQuickLinks } from "../config/quick-links";
import { DASHBOARD_MAX_WIDTH } from "../config/dashboard-config";
import { BorderBeam } from "@/components/ui/border-beam";
import { MagicCard } from "@/components/ui/magic-card";
import { cn } from "@/lib/utils";

const kpiPlaceholders = [
  {
    title: "Ingresos del mes",
    icon: ArrowUpRight,
    hint: "Sin datos aún",
  },
  {
    title: "Egresos del mes",
    icon: ArrowDownRight,
    hint: "Sin datos aún",
  },
  {
    title: "Proyectos",
    icon: Layers,
    hint: "Desde Firestore",
  },
  {
    title: "Saldo neto",
    icon: Wallet,
    hint: "Sin datos aún",
  },
] as const;

export function DashboardPage() {
  const user = useAppSelector(selectSessionUser);
  const { companyId } = useEffectiveCompanyId(0);
  const [projectCount, setProjectCount] = useState<number | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);

  const canInviteUsers =
    user?.globalRole === "company_user" &&
    user?.companyRole === "admin" &&
    Boolean(companyId);

  useEffect(() => {
    if (!companyId) {
      setProjectCount(null);
      return;
    }
    let cancelled = false;
    void countProjects(companyId).then((n) => {
      if (!cancelled) setProjectCount(n);
    });
    return () => {
      cancelled = true;
    };
  }, [companyId]);

  const greetingName = user?.fullName?.split(" ")[0] ?? "Usuario";
  const todayRaw = new Intl.DateTimeFormat("es-CO", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());
  const today = todayRaw.charAt(0).toUpperCase() + todayRaw.slice(1);

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <div className={`mx-auto flex w-full flex-col gap-8 ${DASHBOARD_MAX_WIDTH}`}>
        <header className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
              {today}
            </p>
            <h1 className="font-heading mt-1 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              Hola, {greetingName}
            </h1>
            <p className="mt-1 max-w-xl text-sm text-muted-foreground">
              Panel listo para datos reales. Las métricas se irán conectando con ingresos y egresos.
            </p>
            {!companyId ? (
              <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">
                No hay empresa activa en tu sesión. Ve a{" "}
                <Link href="/proyectos" className="font-medium underline">
                  Proyectos
                </Link>{" "}
                e indica el ID de empresa si hace falta.
              </p>
            ) : null}
          </div>
          <div className="mt-4 flex flex-wrap gap-2 sm:mt-0">
            {canInviteUsers ? (
              <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
                <DialogTrigger
                  className={cn(
                    buttonVariants({ variant: "default", size: "sm" }),
                    "inline-flex gap-1.5",
                  )}
                >
                  <UserPlus className="h-3.5 w-3.5" />
                  Invitar usuario
                </DialogTrigger>
                <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md" showCloseButton>
                  <DialogHeader>
                    <DialogTitle>Invitar a tu empresa</DialogTitle>
                    <DialogDescription>
                      Crea un administrador o un lector (solo lectura de los datos de esta empresa).
                    </DialogDescription>
                  </DialogHeader>
                  <CreateUserForm scopedCompanyId={companyId} />
                </DialogContent>
              </Dialog>
            ) : null}
            {dashboardQuickLinks.map((q) => (
              <Link
                key={q.href}
                href={q.href}
                className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-1")}
              >
                <q.icon className="h-3.5 w-3.5" />
                {q.label}
                <ChevronRight className="h-3.5 w-3.5 opacity-60" />
              </Link>
            ))}
          </div>
        </header>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {kpiPlaceholders.map((k) => {
            const isProjects = k.title === "Proyectos";
            const value =
              isProjects && companyId
                ? projectCount === null
                  ? "…"
                  : String(projectCount)
                : "—";
            return (
              <Card
                key={k.title}
                className="relative overflow-hidden border-border/80 shadow-sm"
              >
                <div className="absolute right-0 top-0 h-24 w-24 translate-x-8 translate-y-[-30%] rounded-full bg-primary/6" />
                <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {k.title}
                  </CardTitle>
                  <k.icon className="h-4 w-4 text-primary/80" />
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-semibold tracking-tight tabular-nums text-foreground">
                    {value}
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {isProjects && companyId ? `${k.hint} · ${companyId.slice(0, 10)}…` : k.hint}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </section>

        <div className="grid gap-6 lg:grid-cols-5">
          <div className="relative rounded-xl lg:col-span-3">
            <MagicCard
              className="rounded-xl"
              gradientSize={170}
              gradientFrom="oklch(0.5 0.09 198 / 0.2)"
              gradientTo="oklch(0.45 0.07 220 / 0.14)"
            >
              <Card className="rounded-xl border-border/80 border-none bg-card/95 shadow-sm backdrop-blur-sm dark:bg-card/90">
                <CardHeader>
                  <CardTitle className="text-base">Flujo mensual</CardTitle>
                  <CardDescription>
                    Cuando haya movimientos por mes, aquí irá el gráfico.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex h-44 items-center justify-center rounded-lg border border-dashed border-border bg-muted/20">
                    <p className="text-sm text-muted-foreground">Sin series aún</p>
                  </div>
                </CardContent>
              </Card>
            </MagicCard>
            <BorderBeam
              size={52}
              duration={16}
              delay={0.5}
              borderWidth={1}
              colorFrom="oklch(0.52 0.1 198)"
              colorTo="oklch(0.58 0.08 205)"
            />
          </div>

          <Card className="border-border/80 shadow-sm lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">Actividad reciente</CardTitle>
              <CardDescription>Ingresos y egresos por proyecto</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex min-h-[120px] items-center justify-center rounded-lg border border-dashed border-border bg-muted/20">
                <p className="text-sm text-muted-foreground">Nada que mostrar todavía</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="border-border/80 shadow-sm">
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-4">
            <div>
              <CardTitle className="text-base">Últimos movimientos</CardTitle>
              <CardDescription>Ingresos y egresos por proyecto</CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                href="/ingresos"
                className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
              >
                Ver ingresos
              </Link>
              <Link
                href="/egresos"
                className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
              >
                Ver egresos
              </Link>
            </div>
          </CardHeader>
          <CardContent className="px-0 sm:px-6">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="pl-6">Fecha</TableHead>
                  <TableHead>Concepto</TableHead>
                  <TableHead>Proyecto</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="pr-6 text-right">Monto</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                    Sin movimientos registrados
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
