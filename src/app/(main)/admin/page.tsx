import { CreateUserForm, MasterOnlyGate } from "@/features/admin";

export default function AdminPage() {
  return (
    <MasterOnlyGate>
      <div className="p-6 lg:px-8 lg:py-8">
        <div className="mx-auto max-w-3xl">
          <h1 className="text-2xl font-semibold tracking-tight">Administración</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Como master puedes dar de alta cuentas de empresa: administrador o lector.
          </p>
          <div className="mt-8">
            <CreateUserForm />
          </div>
        </div>
      </div>
    </MasterOnlyGate>
  );
}
