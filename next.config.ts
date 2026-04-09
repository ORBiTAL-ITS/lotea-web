import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

/** Carpeta `web/` (donde vive este config). Evita que Turbopack use un lockfile en un directorio padre. */
const projectRoot = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  serverExternalPackages: ["firebase-admin"],
  turbopack: {
    root: projectRoot,
  },
};

export default nextConfig;
