"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { createCompanyUser } from "../services/create-user-api";

export type CreateUserFormProps = {
  /**
   * Si está definido, solo se invitan usuarios a esa empresa (admin de empresa).
   * No se muestran campos de empresa: el servidor toma la empresa del token.
   */
  scopedCompanyId?: string | null;
  /** Tras crear correctamente (p. ej. cerrar el diálogo del panel). */
  onSuccess?: () => void;
};

export function CreateUserForm({ scopedCompanyId, onSuccess }: CreateUserFormProps = {}) {
  const scoped = Boolean(scopedCompanyId?.trim());
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [companyRole, setCompanyRole] = useState<"admin" | "viewer">("admin");
  const [companyId, setCompanyId] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setMessage(null);
    setLoading(true);
    try {
      if (scoped) {
        await createCompanyUser({
          email,
          password,
          companyRole,
          companyId: scopedCompanyId!.trim(),
          companyName: null,
        });
      } else {
        await createCompanyUser({
          email,
          password,
          companyRole,
          companyId: companyRole === "viewer" ? companyId.trim() || null : companyId.trim() || null,
          companyName:
            companyRole === "admin" ? (companyName.trim() || null) : null,
        });
      }
      setMessage({
        type: "ok",
        text: scoped
          ? `Usuario creado: ${email.trim().toLowerCase()}. Pide que cierre sesión y vuelva a entrar si ya tenía la app abierta, para actualizar el token.`
          : `Usuario creado: ${email.trim().toLowerCase()}. El admin debe cerrar sesión y volver a entrar si ya estaba abierta otra pestaña, para que el token lleve la empresa.`,
      });
      setEmail("");
      setPassword("");
      setCompanyId("");
      setCompanyName("");
      onSuccess?.();
    } catch (err) {
      setMessage({
        type: "err",
        text: err instanceof Error ? err.message : "Error desconocido",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className={
        scoped
          ? "mx-auto max-w-lg"
          : "mx-auto max-w-lg rounded-xl border border-border bg-card p-6 shadow-sm"
      }
    >
      <h2 className="text-lg font-semibold tracking-tight">
        {scoped ? "Invitar usuario a tu empresa" : "Crear usuario empresa"}
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        <strong>Administrador:</strong> gestiona proyectos de su empresa (el botón + del encabezado).{" "}
        <strong>Lector:</strong> solo consulta datos de esta empresa.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-5">
        {message ? (
          <div
            role="status"
            className={cn(
              "rounded-lg border px-3 py-2 text-sm",
              message.type === "ok"
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-900 dark:text-emerald-200"
                : "border-destructive/30 bg-destructive/10 text-destructive",
            )}
          >
            {message.text}
          </div>
        ) : null}

        <div className="space-y-2">
          <Label htmlFor="nu-email">Correo electrónico</Label>
          <Input
            id="nu-email"
            type="email"
            autoComplete="off"
            placeholder="admin@empresa.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={loading}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="nu-pass">Contraseña inicial</Label>
          <Input
            id="nu-pass"
            type="password"
            autoComplete="new-password"
            placeholder="Mínimo 6 caracteres"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            disabled={loading}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="nu-role">Rol en la empresa</Label>
          <select
            id="nu-role"
            aria-label="Rol en la empresa"
            className={cn(
              "flex h-10 w-full rounded-lg border border-input bg-transparent px-3 text-sm",
              "outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
            )}
            value={companyRole}
            disabled={loading}
            onChange={(e) => {
              setCompanyRole(e.target.value as "admin" | "viewer");
              setCompanyId("");
              setCompanyName("");
            }}
          >
            <option value="admin">Administrador (crear y editar)</option>
            <option value="viewer">Lector (solo vista)</option>
          </select>
        </div>

        {!scoped ? (
          companyRole === "admin" ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="nu-cname">Nombre de la empresa (recomendado)</Label>
                <Input
                  id="nu-cname"
                  placeholder="Ej. Constructora Mi Obra S.A.S."
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  disabled={loading || Boolean(companyId.trim())}
                />
                <p className="text-xs text-muted-foreground">
                  Se crea el documento en Firestore y se asigna al admin. Así al entrar ya tendrá la
                  empresa en el token y verá el botón <span className="font-medium">+</span> para
                  proyectos.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="nu-coid">O ID de empresa ya existente</Label>
                <Input
                  id="nu-coid"
                  placeholder="Solo si la empresa ya está creada — deja vacío el nombre de arriba"
                  value={companyId}
                  onChange={(e) => setCompanyId(e.target.value)}
                  disabled={loading || Boolean(companyName.trim())}
                />
              </div>
            </>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="nu-coid-v">ID de empresa (obligatorio)</Label>
              <Input
                id="nu-coid-v"
                placeholder="Documento en companies/{id}"
                value={companyId}
                onChange={(e) => setCompanyId(e.target.value)}
                required
                disabled={loading}
              />
              <p className="text-xs text-muted-foreground">
                El lector debe pertenecer a una empresa que ya exista.
              </p>
            </div>
          )
        ) : null}

        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Creando...
            </>
          ) : (
            "Crear usuario"
          )}
        </Button>
      </form>
    </div>
  );
}
