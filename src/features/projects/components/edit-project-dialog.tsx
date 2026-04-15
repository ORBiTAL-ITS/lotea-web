"use client";

import { useEffect, useState } from "react";
import { ImageOff, Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Project } from "../models/project-types";
import { updateProject, type UpdateProjectInput } from "../services/projects-service";
import {
  compressProjectImage,
  MAX_INVOICE_IMAGE_DATA_URL_CHARS,
} from "../utils/compress-project-image";
import { getProjectInvoiceImageSrc } from "../utils/project-invoice-image";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
  project: Project | null;
  onSaved: () => void;
};

export function EditProjectDialog({ open, onOpenChange, companyId, project, onSaved }: Props) {
  const [name, setName] = useState("");
  const [lotCount, setLotCount] = useState("0");
  const [invoiceImageUrl, setInvoiceImageUrl] = useState("");
  /** Nueva imagen (data URL comprimida); null = no hay cambio de archivo. */
  const [pendingImageData, setPendingImageData] = useState<string | null>(null);
  const [removeImage, setRemoveImage] = useState(false);
  const [compressing, setCompressing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!project) return;
    setName(project.name);
    setLotCount(String(project.lotCount));
    setInvoiceImageUrl(project.invoiceImageUrl ?? "");
    setPendingImageData(null);
    setRemoveImage(false);
    setError(null);
  }, [project]);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError(null);
    setCompressing(true);
    setRemoveImage(false);
    try {
      const { dataUrl } = await compressProjectImage(file);
      if (dataUrl.length > MAX_INVOICE_IMAGE_DATA_URL_CHARS) {
        throw new Error("La imagen comprimida sigue siendo demasiado grande. Prueba otra foto.");
      }
      setPendingImageData(dataUrl);
      setInvoiceImageUrl("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo procesar la imagen.");
    } finally {
      setCompressing(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading || compressing) return;
    if (!project) return;
    setError(null);
    const lots = Number.parseInt(lotCount, 10);
    if (Number.isNaN(lots) || lots < 0) {
      setError("Indica un número de lotes válido (0 o mayor).");
      return;
    }
    setLoading(true);
    try {
      if (pendingImageData && pendingImageData.length > MAX_INVOICE_IMAGE_DATA_URL_CHARS) {
        throw new Error("La imagen es demasiado grande para guardarla. Prueba con otra foto.");
      }

      const patch: UpdateProjectInput = {
        name: name.trim(),
        lotCount: lots,
      };

      if (removeImage) {
        patch.invoiceImageData = null;
        patch.invoiceImageUrl = null;
      } else if (pendingImageData) {
        patch.invoiceImageData = pendingImageData;
        patch.invoiceImageUrl = null;
      } else {
        const nextUrl = invoiceImageUrl.trim() || null;
        const prevUrl = (project.invoiceImageUrl ?? "").trim() || null;
        if (nextUrl) {
          patch.invoiceImageUrl = nextUrl;
          patch.invoiceImageData = null;
        } else if (prevUrl) {
          patch.invoiceImageUrl = null;
        }
      }

      await updateProject(companyId, project.id, patch);
      onSaved();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar");
    } finally {
      setLoading(false);
    }
  }

  const previewSrc = removeImage
    ? null
    : pendingImageData ?? (project ? getProjectInvoiceImageSrc(project) : null);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && loading) return;
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-h-[min(90vh,880px)] overflow-y-auto sm:max-w-lg" showCloseButton>
        <DialogHeader>
          <DialogTitle>Editar proyecto</DialogTitle>
          <DialogDescription>
            Nombre y cantidad de lotes. El código ({project?.code}) no se modifica aquí. La imagen de factura se
            comprime en el navegador antes de guardarla.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
          <div className="space-y-2">
            <Label htmlFor="edit-proj-name">Nombre</Label>
            <Input
              id="edit-proj-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              disabled={loading || compressing}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-proj-lots">Cantidad de lotes</Label>
            <Input
              id="edit-proj-lots"
              type="number"
              min={0}
              step={1}
              inputMode="numeric"
              value={lotCount}
              onChange={(e) => setLotCount(e.target.value)}
              required
              disabled={loading || compressing}
            />
          </div>

          <div className="space-y-2">
            <Label>Imagen en factura</Label>
            <div className="overflow-hidden rounded-lg border border-border/80 bg-muted/30">
              {previewSrc ? (
                // eslint-disable-next-line @next/next/no-img-element -- data URL o URL externa
                <img src={previewSrc} alt="" className="aspect-16/10 w-full object-cover" />
              ) : (
                <div className="flex aspect-16/10 items-center justify-center text-sm text-muted-foreground">
                  Sin imagen
                </div>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="gap-2"
                disabled={loading || compressing}
                onClick={() => document.getElementById("edit-proj-image-file")?.click()}
              >
                {compressing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                {compressing ? "Comprimiendo…" : "Subir imagen"}
              </Button>
              <input
                id="edit-proj-image-file"
                type="file"
                accept="image/*"
                className="sr-only"
                aria-label="Seleccionar imagen del proyecto"
                title="Seleccionar imagen del proyecto"
                onChange={(ev) => void handleFileChange(ev)}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-2"
                disabled={loading || compressing || (!previewSrc && !project?.invoiceImageUrl && !project?.invoiceImageData)}
                onClick={() => {
                  setRemoveImage(true);
                  setPendingImageData(null);
                  setInvoiceImageUrl("");
                }}
              >
                <ImageOff className="h-4 w-4" />
                Quitar imagen
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Se redimensiona y comprime (WebP o JPEG) para que ocupe poco en la base de datos. Si pones una URL
              externa, sustituye la imagen subida.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-proj-image-url">O URL de imagen (opcional)</Label>
            <Input
              id="edit-proj-image-url"
              type="url"
              placeholder="https://..."
              value={invoiceImageUrl}
              onChange={(e) => {
                setInvoiceImageUrl(e.target.value);
                if (e.target.value.trim()) {
                  setPendingImageData(null);
                  setRemoveImage(false);
                }
              }}
              disabled={loading || compressing}
            />
          </div>

          <DialogFooter className="gap-2 sm:justify-end">
            <Button type="button" variant="outline" disabled={loading} onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading || compressing}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Guardando…
                </>
              ) : (
                "Guardar"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
