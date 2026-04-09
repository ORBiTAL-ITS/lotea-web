import type { Metadata } from "next";
import { LOTEA_LOGO_PATH } from "@/lib/brand";

export const metadata: Metadata = {
  title: "Iniciar sesión | Lotea ERP",
  description: "Acceso seguro a Lotea ERP",
  icons: {
    icon: [{ url: LOTEA_LOGO_PATH, type: "image/png" }],
    apple: [{ url: LOTEA_LOGO_PATH, type: "image/png" }],
  },
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
