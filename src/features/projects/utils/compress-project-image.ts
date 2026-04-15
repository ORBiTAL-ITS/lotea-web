/** Borde máximo (px) del lado más largo; si sigue pesando, se reduce. */
const MAX_EDGE_INITIAL = 1280;
const MAX_EDGE_MIN = 560;

/** Objetivo de peso del archivo (bytes) tras comprimir. */
const TARGET_MAX_BYTES = 450_000;
const MIN_QUALITY = 0.42;
const QUALITY_STEP = 0.06;

/** Tamaño máximo aceptable del string data URL (Firestore ~1 MiB por documento). */
export const MAX_INVOICE_IMAGE_DATA_URL_CHARS = 980_000;

function scaleToMaxEdge(width: number, height: number, maxEdge: number) {
  const longest = Math.max(width, height);
  if (longest <= maxEdge) {
    return { width, height };
  }
  const scale = maxEdge / longest;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((b) => resolve(b), type, quality);
  });
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("No se pudo leer la imagen comprimida."));
    reader.readAsDataURL(blob);
  });
}

function canvasSupportsWebpExport(): boolean {
  try {
    const c = document.createElement("canvas");
    c.width = 1;
    c.height = 1;
    return c.toDataURL("image/webp").startsWith("data:image/webp");
  } catch {
    return false;
  }
}

/**
 * Prueba WebP y JPEG con distintas calidades; devuelve la mejor opción bajo el límite de caracteres.
 */
async function compressCanvasToDataUrl(
  canvas: HTMLCanvasElement,
  preferWebp: boolean,
): Promise<{ dataUrl: string; bytes: number }> {
  const types: ("image/webp" | "image/jpeg")[] = preferWebp
    ? ["image/webp", "image/jpeg"]
    : ["image/jpeg", "image/webp"];

  let best: { dataUrl: string; bytes: number; score: number } | null = null;

  for (const mime of types) {
    let quality = 0.88;
    while (quality >= MIN_QUALITY) {
      const blob = await canvasToBlob(canvas, mime, quality);
      if (blob && blob.size > 0) {
        const dataUrl = await blobToDataUrl(blob);
        const len = dataUrl.length;
        const underChars = len < MAX_INVOICE_IMAGE_DATA_URL_CHARS;
        const underBytes = blob.size <= TARGET_MAX_BYTES * 1.15;
        if (underChars && underBytes) {
          return { dataUrl, bytes: blob.size };
        }
        const score = len + blob.size;
        if (underChars && (!best || score < best.score)) {
          best = { dataUrl, bytes: blob.size, score };
        }
      }
      quality -= QUALITY_STEP;
    }
  }

  if (best) {
    return { dataUrl: best.dataUrl, bytes: best.bytes };
  }

  throw new Error("No se pudo comprimir la imagen.");
}

/**
 * Redimensiona y comprime una foto en el navegador (WebP o JPEG).
 * Pensado para guardar como data URL en Firestore (MVP sin Storage).
 */
export async function compressProjectImage(file: File): Promise<{ dataUrl: string; bytes: number }> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Selecciona un archivo de imagen (JPEG, PNG, WebP…).");
  }
  if (file.size > 30 * 1024 * 1024) {
    throw new Error("La imagen supera 30 MB. Elige un archivo más pequeño.");
  }

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error("No se pudo abrir la imagen. Prueba con otro formato.");
  }

  const preferWebp = canvasSupportsWebpExport();

  try {
    let maxEdge = MAX_EDGE_INITIAL;

    while (maxEdge >= MAX_EDGE_MIN) {
      const { width, height } = scaleToMaxEdge(bitmap.width, bitmap.height, maxEdge);
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        throw new Error("Tu navegador no permite procesar imágenes aquí.");
      }
      ctx.drawImage(bitmap, 0, 0, width, height);

      const { dataUrl, bytes } = await compressCanvasToDataUrl(canvas, preferWebp);

      if (dataUrl.length < MAX_INVOICE_IMAGE_DATA_URL_CHARS && bytes <= TARGET_MAX_BYTES * 1.2) {
        return { dataUrl, bytes };
      }

      maxEdge = Math.floor(maxEdge * 0.78);
    }

    throw new Error(
      "La imagen sigue ocupando demasiado incluso comprimida. Prueba una foto más simple o con menos detalle.",
    );
  } finally {
    bitmap.close();
  }
}
