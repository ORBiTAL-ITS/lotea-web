import { RedirectIfAuthenticated } from "@/features/auth/components/redirect-if-authenticated";
import { LoginPage } from "@/features/auth/components/login-page";

export default function LoginRoute() {
  return (
    <RedirectIfAuthenticated>
      <LoginPage />
    </RedirectIfAuthenticated>
  );
}
