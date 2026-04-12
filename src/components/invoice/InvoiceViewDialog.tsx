"use client";

import { useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer, X } from "lucide-react";
import { InvoicePreview, type InvoicePreviewProps } from "./InvoicePreview";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface InvoiceViewDialogProps extends InvoicePreviewProps {
  open: boolean;
  onClose: () => void;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function InvoiceViewDialog({
  open,
  onClose,
  invoice,
  seller,
  buyer,
  bank,
}: InvoiceViewDialogProps) {
  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  return (
    <>
      {/* ---------- Print-only styles ---------- */}
      {/* Hide everything except the invoice when the browser print dialog is
          invoked.  We inject a <style> tag so Tailwind's print: utilities are
          not needed (they cannot target arbitrary parents). */}
      <style>{`
        @media print {
          /* Hide the entire page */
          body > * {
            visibility: hidden !important;
          }
          /* Then show only the print target */
          #invoice-print-area,
          #invoice-print-area * {
            visibility: visible !important;
          }
          #invoice-print-area {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            box-shadow: none !important;
          }
          /* Hide dialog chrome (buttons, overlay) */
          .invoice-dialog-controls {
            display: none !important;
          }
          /* A4 page settings */
          @page {
            size: A4;
            margin: 10mm;
          }
        }
      `}</style>

      <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
        <DialogContent className="flex h-[95vh] max-w-4xl flex-col gap-0 overflow-hidden p-0">
          {/* Hidden accessible title for screen-readers */}
          <DialogTitle className="sr-only">Invoice Preview</DialogTitle>

          {/* Toolbar */}
          <div className="invoice-dialog-controls flex items-center justify-between border-b bg-gray-50 px-4 py-3">
            <h3 className="text-sm font-semibold text-gray-700">
              Invoice Preview
            </h3>
            <div className="flex items-center gap-2">
              <Button
                variant="default"
                size="sm"
                onClick={handlePrint}
                className="gap-1.5"
              >
                <Printer className="h-4 w-4" />
                Print / Download PDF
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="gap-1.5"
              >
                <X className="h-4 w-4" />
                Close
              </Button>
            </div>
          </div>

          {/* Scrollable invoice area */}
          <div className="flex-1 overflow-y-auto bg-gray-100 p-6">
            <div
              id="invoice-print-area"
              className="mx-auto shadow-sm"
              style={{ maxWidth: 800 }}
            >
              <InvoicePreview
                invoice={invoice}
                seller={seller}
                buyer={buyer}
                bank={bank}
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
