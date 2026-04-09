import Image from "next/image";
import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";
import { LOTEA_LOGO_HEIGHT, LOTEA_LOGO_PATH, LOTEA_LOGO_WIDTH } from "@/lib/brand";

export type SiteLogoVariant = "sidebar" | "header" | "loginHero" | "loginForm";

type SiteLogoProps = {
  variant: SiteLogoVariant;
  className?: string;
};

const maskStyle = (url: string): CSSProperties => ({
  maskImage: `url("${url}")`,
  WebkitMaskImage: `url("${url}")`,
  maskSize: "contain",
  maskRepeat: "no-repeat",
  maskPosition: "left center",
  WebkitMaskSize: "contain",
  WebkitMaskRepeat: "no-repeat",
  WebkitMaskPosition: "left center",
  maskMode: "alpha",
});

/**
 * Logo en color (PNG) para fondos claros.
 * `LogoLightSilhouette`: mismo contorno vía mask + alpha del PNG (fiable en WebKit; sin `brightness/invert` que a veces dejan la imagen en blanco).
 */
function LogoLightSilhouette({
  className,
  toneClassName,
}: {
  className?: string;
  toneClassName: string;
}) {
  return (
    <span
      role="img"
      aria-label="Lotea"
      className={cn("inline-block w-auto shrink-0", toneClassName, className)}
      style={maskStyle(LOTEA_LOGO_PATH)}
    />
  );
}

/**
 * Logo principal: `public/logo-lotea.png`.
 * Sidebar / hero (siempre oscuros): silueta clara con máscara.
 * Header / login en modo oscuro: silueta clara; en modo claro: PNG a color.
 */
export function SiteLogo({ variant, className }: SiteLogoProps) {
  const baseImg = "object-contain object-left";
  const aspect = `aspect-[627/212]`;

  if (variant === "sidebar") {
    return (
      <LogoLightSilhouette
        toneClassName={cn(
          "bg-sidebar-primary-foreground opacity-95",
          "h-8 max-w-[124px]",
          aspect,
        )}
        className={className}
      />
    );
  }

  if (variant === "header") {
    return (
      <span className={cn("inline-flex shrink-0 items-center", className)}>
        <Image
          src={LOTEA_LOGO_PATH}
          alt="Lotea"
          width={LOTEA_LOGO_WIDTH}
          height={LOTEA_LOGO_HEIGHT}
          className={cn("h-7 w-auto max-w-[118px] dark:hidden", baseImg)}
          sizes="(max-width: 1024px) 100px, 118px"
        />
        <LogoLightSilhouette
          toneClassName={cn(
            "hidden bg-foreground opacity-95 dark:inline-block",
            "h-7 max-w-[118px]",
            aspect,
          )}
        />
      </span>
    );
  }

  if (variant === "loginHero") {
    return (
      <LogoLightSilhouette
        toneClassName={cn(
          "bg-sidebar-primary-foreground opacity-95",
          "h-11 max-w-[210px] sm:h-14 sm:max-w-[220px]",
          aspect,
        )}
        className={className}
      />
    );
  }

  return (
    <span className={cn("inline-flex shrink-0 items-center", className)}>
      <Image
        src={LOTEA_LOGO_PATH}
        alt="Lotea"
        width={LOTEA_LOGO_WIDTH}
        height={LOTEA_LOGO_HEIGHT}
        className={cn("h-10 w-auto max-w-[168px] dark:hidden", baseImg)}
        priority
        sizes="168px"
      />
      <LogoLightSilhouette
        toneClassName={cn(
          "hidden bg-foreground opacity-95 dark:inline-block",
          "h-10 max-w-[168px]",
          aspect,
        )}
      />
    </span>
  );
}
