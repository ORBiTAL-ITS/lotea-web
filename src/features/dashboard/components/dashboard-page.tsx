"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  ChevronRight,
  Layers,
  Loader2,
  RefreshCw,
  UserPlus,
  Wallet,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { fetchCompanyDashboardData } from "../services/dashboard-service";
import {
  formatMovementDay,
  moneyFmt,
  normalizeYearMonthInput,
} from "@/features/movements/utils/movements-display";
import { Badge } from "@/components/ui/badge";

function currentYearMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

const chartIncome = "var(--chart-1)";
const chartExpense = "var(--chart-2)";

function compactMoney(n: number) {
  return new Intl.NumberFormat("es-CO", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(n);
}

export function DashboardPage() {
  const user = useAppSelector(selectSessionUser);
  const { companyId } = useEffectiveCompanyId(0);
  const [projectCount, setProjectCount] = useState<number | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);

  const [monthInput, setMonthInput] = useState(() => currentYearMonth());
  const [dashboard, setDashboard] = useState<Awaited<
    ReturnType<typeof fetchCompanyDashboardData>
  > | null>(null);
  const [loadingDash, setLoadingDash] = useState(false);
  const [dashError, setDashError] = useState<string | null>(null);

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

  const loadDashboard = useCallback(async () => {
    if (!companyId) return;
    const norm = normalizeYearMonthInput(monthInput);
    if (!norm) {
      setDashError("Elige un mes válido.");
      return;
    }
    setLoadingDash(true);
    setDashError(null);
    try {
      const data = await fetchCompanyDashboardData(companyId, norm);
      setDashboard(data);
    } catch (e) {
      setDashboard(null);
      setDashError(e instanceof Error ? e.message : "No se pudo cargar el resumen.");
    } finally {
      setLoadingDash(false);
    }
  }, [companyId, monthInput]);

  const projectBarData = useMemo(() => {
    if (!dashboard) return [];
    return dashboard.byProject.slice(0, 8).map((p) => ({
      name: p.projectCode || p.projectName.slice(0, 12),
      fullName: p.projectName,
      Ingresos: p.income,
      Egresos: p.expense,
    }));
  }, [dashboard]);

  const greetingName = user?.fullName?.split(" ")[0] ?? "Usuario";
  const todayRaw = new Intl.DateTimeFormat("es-CO", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());
  const today = todayRaw.charAt(0).toUpperCase() + todayRaw.slice(1);

  const monthLabel = useMemo(() => {
    const m = /^(\d{4})-(\d{2})$/.exec(normalizeYearMonthInput(monthInput) || "");
    if (!m) return "";
    const d = new Date(Number(m[1]), Number(m[2]) - 1, 1);
    return new Intl.DateTimeFormat("es-CO", { month: "long", year: "numeric" }).format(d);
  }, [monthInput]);

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
              Resumen financiero por mes: ingresos, egresos y reparto por proyecto. Carga los datos cuando quieras
              (no se consulta Firestore al entrar).
            </p>
            {!companyId ? (
              <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">
                No hay empresa activa en tu sesión. Ve a{" "}
                <Link href="/proyectos" className="font-medium underline">
                  Proyectos
                </Link>{" "}
                y elige empresa.
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

        {companyId ? (
          <Card className="border-border/80 shadow-sm">
            <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <CardTitle className="text-base">Mes a revisar</CardTitle>
                <CardDescription>
                  Ingresos y egresos según la fecha contable del movimiento (zona Colombia), mismo criterio que
                  Ingresos/Egresos.
                </CardDescription>
              </div>
              <div className="flex flex-wrap items-end gap-3">
                <div className="space-y-2">
                  <Label htmlFor="dash-month">Mes</Label>
                  <Input
                    id="dash-month"
                    type="month"
                    className="h-10 w-[11rem]"
                    value={monthInput}
                    onChange={(e) => setMonthInput(e.target.value)}
                    disabled={loadingDash}
                  />
                </div>
                <button
                  type="button"
                  className={cn(buttonVariants({ variant: "default", size: "default" }), "gap-2")}
                  disabled={loadingDash}
                  onClick={() => void loadDashboard()}
                >
                  {loadingDash ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                  Cargar resumen
                </button>
              </div>
            </CardHeader>
            {dashError ? (
              <CardContent>
                <p className="text-sm text-destructive" role="alert">
                  {dashError}
                </p>
              </CardContent>
            ) : null}
          </Card>
        ) : null}

        {companyId && dashboard ? (
          <>
            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <Card className="relative overflow-hidden border-border/80 shadow-sm">
                <div className="absolute right-0 top-0 h-24 w-24 translate-x-8 translate-y-[-30%] rounded-full bg-primary/6" />
                <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Ingresos del mes</CardTitle>
                  <ArrowUpRight className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-semibold tracking-tight tabular-nums text-foreground">
                    {moneyFmt.format(dashboard.totalIncome)}
                  </p>
                  <p className="mt-2 text-xs capitalize text-muted-foreground">{monthLabel}</p>
                </CardContent>
              </Card>
              <Card className="relative overflow-hidden border-border/80 shadow-sm">
                <div className="absolute right-0 top-0 h-24 w-24 translate-x-8 translate-y-[-30%] rounded-full bg-primary/6" />
                <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Egresos del mes</CardTitle>
                  <ArrowDownRight className="h-4 w-4 text-rose-600 dark:text-rose-400" />
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-semibold tracking-tight tabular-nums text-foreground">
                    {moneyFmt.format(dashboard.totalExpense)}
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">Incluye proyecto Gasto si aplica</p>
                </CardContent>
              </Card>
              <Card className="relative overflow-hidden border-border/80 shadow-sm">
                <div className="absolute right-0 top-0 h-24 w-24 translate-x-8 translate-y-[-30%] rounded-full bg-primary/6" />
                <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Proyectos</CardTitle>
                  <Layers className="h-4 w-4 text-primary/80" />
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-semibold tracking-tight tabular-nums text-foreground">
                    {projectCount === null ? "…" : String(projectCount)}
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">En la empresa</p>
                </CardContent>
              </Card>
              <Card className="relative overflow-hidden border-border/80 shadow-sm">
                <div className="absolute right-0 top-0 h-24 w-24 translate-x-8 translate-y-[-30%] rounded-full bg-primary/6" />
                <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Saldo del mes</CardTitle>
                  <Wallet className="h-4 w-4 text-primary/80" />
                </CardHeader>
                <CardContent>
                  <p
                    className={cn(
                      "text-2xl font-semibold tracking-tight tabular-nums",
                      dashboard.net >= 0 ? "text-foreground" : "text-destructive",
                    )}
                  >
                    {moneyFmt.format(dashboard.net)}
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">Ingresos − egresos</p>
                </CardContent>
              </Card>
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
                      <CardTitle className="text-base">Tendencia (últimos 6 meses)</CardTitle>
                      <CardDescription>
                        Serie acumulada por mes hasta el mes seleccionado. Misma fecha contable que el resto del
                        sistema.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="h-[300px] w-full min-w-0 pl-0">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={dashboard.trend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-border/80" />
                          <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                          <YAxis
                            tickFormatter={(v) => compactMoney(Number(v))}
                            width={56}
                            tick={{ fontSize: 11 }}
                          />
                          <Tooltip
                            formatter={(value: number) => moneyFmt.format(value)}
                            labelFormatter={(_, p) => (p?.[0]?.payload?.monthKey as string) ?? ""}
                            contentStyle={{ borderRadius: "8px" }}
                          />
                          <Legend />
                          <Line
                            type="monotone"
                            dataKey="income"
                            name="Ingresos"
                            stroke={chartIncome}
                            strokeWidth={2}
                            dot={{ r: 3 }}
                          />
                          <Line
                            type="monotone"
                            dataKey="expense"
                            name="Egresos"
                            stroke={chartExpense}
                            strokeWidth={2}
                            dot={{ r: 3 }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
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
                  <CardTitle className="text-base">Mes seleccionado</CardTitle>
                  <CardDescription>Ingresos vs egresos</CardDescription>
                </CardHeader>
                <CardContent className="h-[260px] w-full min-w-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={[
                        {
                          name: monthLabel || "Mes",
                          Ingresos: dashboard.totalIncome,
                          Egresos: dashboard.totalExpense,
                        },
                      ]}
                      margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border/80" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis tickFormatter={(v) => compactMoney(Number(v))} width={52} tick={{ fontSize: 11 }} />
                      <Tooltip formatter={(value: number) => moneyFmt.format(value)} />
                      <Legend />
                      <Bar dataKey="Ingresos" fill={chartIncome} radius={[6, 6, 0, 0]} />
                      <Bar dataKey="Egresos" fill={chartExpense} radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            <Card className="border-border/80 shadow-sm">
              <CardHeader>
                <CardTitle className="text-base">Por proyecto (mes seleccionado)</CardTitle>
                <CardDescription>Top proyectos por volumen de movimientos en el mes</CardDescription>
              </CardHeader>
              <CardContent className="h-[min(360px,50vh)] w-full min-w-0">
                {projectBarData.length === 0 ? (
                  <p className="py-12 text-center text-sm text-muted-foreground">
                    Sin movimientos en este mes para graficar por proyecto.
                  </p>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      layout="vertical"
                      data={projectBarData}
                      margin={{ top: 8, right: 16, left: 8, bottom: 8 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border/80" horizontal={false} />
                      <XAxis type="number" tickFormatter={(v) => compactMoney(Number(v))} tick={{ fontSize: 10 }} />
                      <YAxis
                        type="category"
                        dataKey="name"
                        width={72}
                        tick={{ fontSize: 10 }}
                        interval={0}
                      />
                      <Tooltip
                        formatter={(value: number) => moneyFmt.format(value)}
                        labelFormatter={(_, p) =>
                          (p?.[0]?.payload?.fullName as string) || (p?.[0]?.payload?.name as string) || ""
                        }
                      />
                      <Legend />
                      <Bar dataKey="Ingresos" fill={chartIncome} radius={[0, 4, 4, 0]} />
                      <Bar dataKey="Egresos" fill={chartExpense} radius={[4, 0, 0, 4]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </>
        ) : companyId && !dashboard && !loadingDash ? (
          <Card className="border-dashed border-border/80 bg-muted/15">
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              Elige el mes y pulsa <span className="font-medium text-foreground">Cargar resumen</span> para ver
              gráficas y totales.
            </CardContent>
          </Card>
        ) : null}

        <Card className="border-border/80 shadow-sm">
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-4">
            <div>
              <CardTitle className="text-base">Movimientos del mes</CardTitle>
              <CardDescription>
                {dashboard
                  ? `Últimos registros del mes elegido (${dashboard.recentMovements.length} mostrados)`
                  : "Tras cargar el resumen verás una muestra del mes"}
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href="/ingresos" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
                Ver ingresos
              </Link>
              <Link href="/egresos" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
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
                {!dashboard || dashboard.recentMovements.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                      {dashboard ? "Sin movimientos en ese mes." : "Carga el resumen para ver movimientos."}
                    </TableCell>
                  </TableRow>
                ) : (
                  dashboard.recentMovements.map((row) => {
                    const m = row.movement;
                    const ts = m.movementDate ?? m.createdAt;
                    return (
                      <TableRow key={`${row.projectId}-${m.id}`}>
                        <TableCell className="pl-6 whitespace-nowrap text-muted-foreground">
                          {ts ? formatMovementDay(ts) : "—"}
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate text-sm">{m.concept || "—"}</TableCell>
                        <TableCell className="text-sm">
                          <span className="font-medium">{row.projectName}</span>{" "}
                          <span className="font-mono text-xs text-muted-foreground">{row.projectCode}</span>
                        </TableCell>
                        <TableCell>
                          <Badge variant={m.kind === "income" ? "default" : "destructive"}>
                            {m.kind === "income" ? "Ingreso" : "Egreso"}
                          </Badge>
                        </TableCell>
                        <TableCell className="pr-6 text-right tabular-nums font-medium">
                          {moneyFmt.format(m.amount)}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
