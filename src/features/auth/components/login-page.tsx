"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Loader2, Lock, Mail } from "lucide-react";
import { BorderBeam } from "@/components/ui/border-beam";
import { DotPattern } from "@/components/ui/dot-pattern";
import { MagicCard } from "@/components/ui/magic-card";
import { Meteors } from "@/components/ui/meteors";
import { ShimmerButton } from "@/components/ui/shimmer-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { signInWithPassword } from "../services/auth-service";
import { SiteLogo } from "@/components/brand/site-logo";

export function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setError(null);
    setLoading(true);
    try {
      await signInWithPassword(email, password);
      router.replace("/");
    } catch {
      setError("Correo o contraseña incorrectos. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen">
      {/* Panel marca — inspiración tipo split-screen, paleta Lotea */}
      <div className="relative hidden w-1/2 flex-none flex-col justify-between overflow-hidden bg-sidebar p-12 text-sidebar-foreground lg:flex">
        <DotPattern
          width={20}
          height={20}
          className="mask-[radial-gradient(ellipse_at_center,white,transparent_70%)] text-sidebar-primary-foreground/12"
        />
        <div className="pointer-events-none absolute inset-0 overflow-hidden opacity-80">
          <Meteors number={8} minDuration={4} maxDuration={12} />
        </div>
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }}
        />
        <div className="relative z-10">
          <SiteLogo variant="loginHero" />
          <motion.h2
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            className="mt-10 max-w-md font-heading text-3xl font-semibold leading-snug tracking-tight text-sidebar-foreground"
          >
            Control claro de{" "}
            <span className="text-sidebar-primary-foreground/95">proyectos, gastos e ingresos</span>
          </motion.h2>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-sidebar-foreground/65">
            Una sola vista para parcelaciones y obra: ingresos, egresos y comprobante por cada
            movimiento, más importación desde Excel y roles master y empresa.
          </p>
        </div>
        <p className="relative z-10 text-xs text-sidebar-foreground/45">
          © {new Date().getFullYear()} Lotea · ERP
        </p>
      </div>

      {/* Formulario */}
      <div className="relative flex flex-1 flex-col items-center justify-center overflow-hidden px-6 py-12 sm:px-10">
        <DotPattern
          width={22}
          height={22}
          className="text-muted-foreground/35 mask-[radial-gradient(ellipse_80%_60%_at_50%_40%,white,transparent)]"
        />
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
          className="relative z-10 w-full max-w-[400px]"
        >
          <div className="mb-8 lg:hidden">
            <SiteLogo variant="loginForm" />
            <h1 className="font-heading mt-6 text-2xl font-semibold tracking-tight text-foreground">
              Iniciar sesión
            </h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Usa tu correo y contraseña de Lotea.
            </p>
          </div>

          <div className="relative rounded-2xl border border-border/60 shadow-lg shadow-primary/5">
            <MagicCard
              className="rounded-2xl"
              gradientSize={200}
              gradientFrom="oklch(0.5 0.1 198 / 0.28)"
              gradientTo="oklch(0.42 0.08 230 / 0.18)"
            >
              <div className="rounded-2xl bg-card/92 p-6 backdrop-blur-md dark:bg-card/85 sm:p-8">
                <div className="hidden lg:block">
                  <SiteLogo variant="loginForm" className="mb-6" />
                  <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground">
                    Iniciar sesión
                  </h1>
                  <p className="mt-1.5 text-sm text-muted-foreground">
                    Bienvenido. Ingresa con tu cuenta autorizada.
                  </p>
                </div>

                <form onSubmit={handleSubmit} className="mt-6 space-y-5 lg:mt-8">
                  {error ? (
                    <div
                      role="alert"
                      className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
                    >
                      {error}
                    </div>
                  ) : null}

                  <div className="space-y-2">
                    <Label htmlFor="email">Correo electrónico</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="email"
                        type="email"
                        autoComplete="email"
                        placeholder="tu@empresa.com"
                        className="h-11 pl-9"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        disabled={loading}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <Label htmlFor="password">Contraseña</Label>
                      <span className="text-xs text-muted-foreground">Mín. 6 caracteres</span>
                    </div>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="password"
                        type="password"
                        autoComplete="current-password"
                        placeholder="••••••••"
                        className="h-11 pl-9"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        minLength={6}
                        disabled={loading}
                      />
                    </div>
                  </div>

                  <ShimmerButton
                    type="submit"
                    disabled={loading}
                    borderRadius="0.625rem"
                    background="var(--primary)"
                    shimmerColor="var(--primary-foreground)"
                    shimmerDuration="2.8s"
                    className={cn(
                      "h-11 w-full text-base font-semibold text-primary-foreground",
                      loading && "pointer-events-none opacity-80",
                    )}
                  >
                    {loading ? (
                      <span className="inline-flex items-center gap-2">
                        <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
                        Entrando...
                      </span>
                    ) : (
                      "Entrar"
                    )}
                  </ShimmerButton>
                </form>
              </div>
            </MagicCard>
            <BorderBeam
              size={56}
              duration={11}
              borderWidth={1.25}
              colorFrom="oklch(0.52 0.11 198)"
              colorTo="oklch(0.62 0.09 205)"
            />
          </div>

          <p className="mt-8 text-center text-xs text-muted-foreground">
            ¿Problemas para acceder?{" "}
            <Link href="mailto:applotea@gmail.com" className="font-medium text-primary hover:underline">
              Contactar al administrador
            </Link>
          </p>
        </motion.div>
      </div>
    </div>
  );
}
