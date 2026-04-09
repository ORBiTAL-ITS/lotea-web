"use client";

import { useEffect, useState } from "react";
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
import type { Movement } from "../models/movement-types";
import { formatMovementInvoice } from "../utils/movements-display";

export type MovementInvoiceDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyName: string | null;
  project: Project;
  movement: Movement | null;
};

export function MovementInvoiceDialog({
  open,
  onOpenChange,
  companyName,
  project,
  movement,
}: MovementInvoiceDialogProps) {
  const [delivererCaption, setDelivererCaption] = useState("");
  const [receiverCaption, setReceiverCaption] = useState("");

  useEffect(() => {
    if (!open) {
      setDelivererCaption("");
      setReceiverCaption("");
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[min(92vh,900px)] w-[calc(100vw-2rem)] overflow-y-auto sm:max-w-3xl lg:max-w-4xl print:max-h-none print:max-w-none print:overflow-visible print:rounded-none print:shadow-none print:ring-0"
        showCloseButton
      >
        {movement ? (
          <>
            <div className="no-print space-y-4">
              <DialogHeader>
                <DialogTitle>Comprobante {formatMovementInvoice(movement)}</DialogTitle>
                <DialogDescription className="text-balance">
                  Cada movimiento tiene su numeración (I-… / E-…). Puedes imprimir el comprobante; las
                  firmas son opcionales.
                </DialogDescription>
              </DialogHeader>
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
              <Button type="button" className="gap-2" onClick={() => window.print()}>
                <Printer className="h-4 w-4" />
                Imprimir comprobante
              </Button>
            </div>
            <div className="mt-6 flex justify-center print:mt-0">
              <InvoicePrintSheet
                companyName={companyName}
                projectName={project.name}
                projectCode={project.code}
                movement={movement}
                delivererCaption={delivererCaption.trim()}
                receiverCaption={receiverCaption.trim()}
              />
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
