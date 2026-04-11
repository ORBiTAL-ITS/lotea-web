import {
  LayoutDashboard,
  Building2,
  FileSpreadsheet,
  TrendingDown,
  TrendingUp,
  Shield,
  Users,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  masterOnly?: boolean;
  /** Si es true, el ítem queda deshabilitado hasta tener empresa activa (token o sesión local). */
  requiresCompany?: boolean;
};

export const mainNav: NavItem[] = [
  { label: "Panel", href: "/", icon: LayoutDashboard },
  { label: "Proyectos", href: "/proyectos", icon: Building2 },
  {
    label: "Ingresos",
    href: "/ingresos",
    icon: TrendingUp,
    requiresCompany: true,
  },
  {
    label: "Egresos",
    href: "/egresos",
    icon: TrendingDown,
    requiresCompany: true,
  },
  {
    label: "Exportar Excel",
    href: "/exportar-excel",
    icon: FileSpreadsheet,
    requiresCompany: true,
  },
  {
    label: "Personas",
    href: "/personas",
    icon: Users,
    requiresCompany: true,
  },
  { label: "Administración", href: "/admin", icon: Shield, masterOnly: true },
];
