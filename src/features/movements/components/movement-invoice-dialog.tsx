"use client";

import { useEffect, useRef, useState } from "react";
import { useReactToPrint } from "react-to-print";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InvoicePrintSheet } from "@/features/invoicing/components/invoice-print-sheet";
import type { Project } from "@/features/projects/models/project-types";
import { fetchProjectById } from "@/features/projects/services/projects-service";
import { getProjectInvoiceImageSrc } from "@/features/projects/utils/project-invoice-image";
import type { Movement } from "../models/movement-types";
import { formatMovementInvoice } from "../utils/movements-display";

function waitForImages(container: HTMLElement | null): Promise<void> {
  if (!container) return Promise.resolve();
  const imgs = Array.from(container.querySelectorAll("img"));
  return Promise.all(
    imgs.map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.complete && img.naturalHeight !== 0) {
            resolve();
            return;
          }
          const done = () => resolve();
          img.addEventListener("load", done, { once: true });
          img.addEventListener("error", done, { once: true });
        }),
    ),
  ).then(() => undefined);
}

export type MovementInvoiceDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string | null;
  companyName: string | null;
  project: Project;
  movement: Movement | null;
};

export function MovementInvoiceDialog({
  open,
  onOpenChange,
  companyId,
  companyName,
  project,
  movement,
}: MovementInvoiceDialogProps) {
  const [personLine, setPersonLine] = useState("");
  const [delivererCaption, setDelivererCaption] = useState("");
  const [receiverCaption, setReceiverCaption] = useState("");
  /** Proyecto re-leído al abrir para tener `invoiceImageData` o URL actual al imprimir. */
  const [projectForPrint, setProjectForPrint] = useState<Project>(project);

  const printAreaRef = useRef<HTMLDivElement>(null);

  const handlePrint = useReactToPrint({
    contentRef: printAreaRef,
    documentTitle: movement
      ? `Comprobante-${formatMovementInvoice(movement)}`
      : "Comprobante",
    pageStyle: `
      @page { size: letter portrait; margin: 0.45in; }
      img { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    `,
    onBeforePrint: async () => {
      await waitForImages(printAreaRef.current);
    },
  });

  useEffect(() => {
    setProjectForPrint(project);
  }, [project]);

  useEffect(() => {
    if (!open) {
      setPersonLine("");
      setDelivererCaption("");
      setReceiverCaption("");
      return;
    }
    if (movement) {
      setPersonLine(movement.personName?.trim() ?? "");
    }
  }, [open, movement]);

  useEffect(() => {
    if (!open || !companyId || !movement) return;
    let cancelled = false;
    void fetchProjectById(companyId, project.id).then((p) => {
      if (!cancelled && p) setProjectForPrint(p);
    });
    return () => {
      cancelled = true;
    };
  }, [open, movement, companyId, project.id]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[min(92vh,900px)] w-[calc(100vw-2rem)] overflow-y-auto sm:max-w-3xl lg:max-w-4xl"
        showCloseButton
      >
        {movement ? (
          <>
            <div className="space-y-4">
              <DialogHeader>
                <DialogTitle>Comprobante {formatMovementInvoice(movement)}</DialogTitle>
                <DialogDescription className="text-balance">
                  Solo se imprime la hoja del comprobante (vista previa abajo). La persona se rellena desde
                  el movimiento si existe; puedes editarla. Las firmas son opcionales.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-2">
                <Label htmlFor="mov-inv-person">Persona en el comprobante</Label>
                <Input
                  id="mov-inv-person"
                  value={personLine}
                  onChange={(e) => setPersonLine(e.target.value)}
                  placeholder="Nombre o razón social (opcional)"
                  className="h-10"
                  autoComplete="name"
                />
                <p className="text-[11px] text-muted-foreground">
                  Si el movimiento ya tiene persona vinculada, se rellena sola; si no, escribe el nombre que
                  debe salir impreso.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="mov-inv-deliver">Quien entrega (opcional)</Label>
                  <Input
                    id="mov-inv-deliver"
                    value={delivererCaption}
                    onChange={(e) => setDelivererCaption(e.target.value)}
                    placeholder="Nombre o razón social"
                    className="h-10"
                    autoComplete="name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="mov-inv-receive">Quien recibe (opcional)</Label>
                  <Input
                    id="mov-inv-receive"
                    value={receiverCaption}
                    onChange={(e) => setReceiverCaption(e.target.value)}
                    placeholder="Nombre o razón social"
                    className="h-10"
                    autoComplete="name"
                  />
                </div>
              </div>
              <Button
                type="button"
                className="gap-2"
                onClick={() => {
                  void handlePrint();
                }}
              >
                <Printer className="h-4 w-4" />
                Imprimir comprobante
              </Button>
            </div>

            <div className="mt-6 flex justify-center border-t border-border/60 pt-6">
              <div ref={printAreaRef} className="inline-block">
                <InvoicePrintSheet
                  companyName={companyName}
                  projectName={projectForPrint.name}
                  projectCode={projectForPrint.code}
                  projectImageSrc={getProjectInvoiceImageSrc(projectForPrint)}
                  movement={movement}
                  personDisplayOverride={personLine}
                  delivererCaption={delivererCaption.trim()}
                  receiverCaption={receiverCaption.trim()}
                />
              </div>
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
