"use client";

import { formatCurrency } from "@/lib/utils";
// @ts-ignore
import { amountInWords } from "@/lib/invoice/numberToWords";
// @ts-ignore
import { getStateName, extractStateCodeFromGstin } from "@/lib/invoice/states";
// @ts-ignore
import { getDocumentTitle } from "@/lib/invoice/documentTypes";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface InvoiceItem {
  description: string;
  hsnSac?: string;
  qty: number;
  rate: number;
  gstRate?: number;
}

interface InvoiceData {
  documentType: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate?: string;
  terms?: string;
  subject?: string;
  items: InvoiceItem[];
  subtotal: number;
  gstTotal: number;
  tdsAmount?: number;
  tdsRate?: number;
  tdsEnabled?: boolean;
  roundOff?: number;
  netTotal: number;
  notes?: string;
  watermark?: string;
  gstInclusive?: boolean;
  placeOfSupplyCode?: string;
}

interface SellerInfo {
  name: string;
  address?: string;
  gstin?: string;
  pan?: string;
  email?: string;
  phone?: string;
  logoDataUrl?: string;
}

interface BuyerInfo {
  name: string;
  address?: string;
  gstin?: string;
  pan?: string;
  email?: string;
  phone?: string;
}

interface BankInfo {
  accountName: string;
  accountNumber: string;
  bankName: string;
  branch?: string;
  ifscCode: string;
}

export interface InvoicePreviewProps {
  invoice: InvoiceData;
  seller?: SellerInfo;
  buyer?: BuyerInfo;
  bank?: BankInfo;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function formatDate(dateStr: string | undefined): string {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatINR(n: number): string {
  return n.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Determine whether this is an inter-state supply by comparing the first
 * two digits of the seller and buyer GSTINs.  If the place-of-supply code
 * is provided it takes precedence over the buyer GSTIN.
 */
function isInterState(
  sellerGstin?: string,
  buyerGstin?: string,
  placeOfSupplyCode?: string,
): boolean {
  const sellerState = sellerGstin ? sellerGstin.substring(0, 2) : "";
  if (!sellerState) return false; // can't determine without seller GSTIN

  if (placeOfSupplyCode) {
    return sellerState !== placeOfSupplyCode;
  }
  const buyerState = buyerGstin ? buyerGstin.substring(0, 2) : "";
  if (!buyerState) return false;
  return sellerState !== buyerState;
}

/**
 * Group items by gstRate and compute the tax totals for each group.
 */
function getGstBreakdown(
  items: InvoiceItem[],
  interState: boolean,
  gstInclusive?: boolean,
) {
  const groups: Record<
    number,
    { rate: number; taxableAmount: number; tax: number }
  > = {};

  for (const item of items) {
    const rate = item.gstRate ?? 0;
    if (rate <= 0) continue;

    let lineAmount = item.qty * item.rate;
    if (gstInclusive) {
      lineAmount = lineAmount / (1 + rate / 100);
    }

    if (!groups[rate]) {
      groups[rate] = { rate, taxableAmount: 0, tax: 0 };
    }
    groups[rate].taxableAmount += lineAmount;
    groups[rate].tax += lineAmount * (rate / 100);
  }

  return Object.values(groups).sort((a, b) => a.rate - b.rate);
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function InvoicePreview({
  invoice,
  seller,
  buyer,
  bank,
}: InvoicePreviewProps) {
  const isGstRegistered = !!seller?.gstin;
  const interState = isInterState(
    seller?.gstin,
    buyer?.gstin,
    invoice.placeOfSupplyCode,
  );
  const gstBreakdown = getGstBreakdown(
    invoice.items,
    interState,
    invoice.gstInclusive,
  );
  const documentTitle: string = getDocumentTitle(
    invoice.documentType,
    isGstRegistered,
  );

  const placeOfSupplyName = invoice.placeOfSupplyCode
    ? `${getStateName(invoice.placeOfSupplyCode)} (${invoice.placeOfSupplyCode})`
    : "";

  return (
    <div
      className="invoice-preview relative mx-auto max-w-[800px] overflow-hidden bg-white p-10 text-[13px] leading-relaxed text-black"
      style={{ fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif" }}
    >
      {/* -------- Watermark -------- */}
      {invoice.watermark && (
        <div
          className="pointer-events-none absolute inset-0 z-0 flex items-center justify-center select-none"
          aria-hidden="true"
        >
          <span
            className="whitespace-nowrap text-[80px] font-black tracking-widest"
            style={{
              color: "rgba(0,0,0,0.06)",
              transform: "rotate(-35deg)",
            }}
          >
            {invoice.watermark}
          </span>
        </div>
      )}

      {/* ======== HEADER ======== */}
      <div className="relative z-10 mb-6 flex items-start justify-between">
        {/* Seller */}
        <div className="flex-1">
          {seller?.logoDataUrl && (
            <img
              src={seller.logoDataUrl}
              alt=""
              className="mb-2 h-10 object-contain"
            />
          )}
          <h1 className="m-0 text-xl font-bold tracking-tight">
            {seller?.name || "Your Business Name"}
          </h1>
          {seller?.address && (
            <p className="mt-1 max-w-[280px] whitespace-pre-line text-xs leading-snug text-gray-600">
              {seller.address}
            </p>
          )}
          {seller?.gstin && (
            <p className="mt-1 text-xs">
              <span className="text-gray-500">GSTIN</span>{" "}
              <span className="font-medium">{seller.gstin}</span>
            </p>
          )}
          {seller?.pan && !seller?.gstin && (
            <p className="mt-1 text-xs">
              <span className="text-gray-500">PAN</span>{" "}
              <span className="font-medium">{seller.pan}</span>
            </p>
          )}
          {(seller?.email || seller?.phone) && (
            <p className="mt-1 text-xs text-gray-600">
              {seller.email}
              {seller.email && seller.phone && " | "}
              {seller.phone}
            </p>
          )}
        </div>

        {/* Document title + number */}
        <div className="text-right">
          <h2 className="m-0 text-2xl font-bold tracking-tight text-gray-800">
            {documentTitle}
          </h2>
          <p className="mt-1 text-sm font-medium text-gray-500">
            # {invoice.invoiceNumber || "\u2014"}
          </p>
          <div className="mt-3 inline-block border border-gray-200 bg-gray-50 px-4 py-2">
            <p className="text-xs text-gray-500">Balance Due</p>
            <p className="text-xl font-bold">
              {"\u20B9"}
              {formatINR(invoice.netTotal)}
            </p>
          </div>
        </div>
      </div>

      {/* ======== BILL TO + META ======== */}
      <div className="relative z-10 mb-6 flex justify-between border-t border-gray-200 pt-6">
        <div className="flex-1">
          <p className="mb-1 text-xs text-gray-500">Bill To</p>
          <p className="text-sm font-bold">{buyer?.name || "\u2014"}</p>
          {buyer?.address && (
            <p className="mt-1 max-w-[280px] whitespace-pre-line text-xs leading-snug text-gray-600">
              {buyer.address}
            </p>
          )}
          {buyer?.gstin && (
            <p className="mt-1 text-xs">
              <span className="text-gray-500">GSTIN</span>{" "}
              <span className="font-medium">{buyer.gstin}</span>
            </p>
          )}
          {buyer?.pan && !buyer?.gstin && (
            <p className="mt-1 text-xs">
              <span className="text-gray-500">PAN</span>{" "}
              <span className="font-medium">{buyer.pan}</span>
            </p>
          )}
          {(buyer?.email || buyer?.phone) && (
            <p className="mt-1 text-xs text-gray-600">
              {buyer.email}
              {buyer.email && buyer.phone && " | "}
              {buyer.phone}
            </p>
          )}
          {isGstRegistered && placeOfSupplyName && (
            <p className="mt-2 text-xs">
              <span className="text-gray-500">Place of Supply:</span>{" "}
              {placeOfSupplyName}
            </p>
          )}
        </div>

        <div className="space-y-1 text-right text-xs">
          <div className="flex justify-end gap-4">
            <span className="text-gray-500">Invoice Date :</span>
            <span className="w-[100px] text-right font-medium">
              {formatDate(invoice.invoiceDate)}
            </span>
          </div>
          {invoice.terms && (
            <div className="flex justify-end gap-4">
              <span className="text-gray-500">Terms :</span>
              <span className="w-[100px] text-right font-medium">
                {invoice.terms}
              </span>
            </div>
          )}
          {invoice.dueDate && (
            <div className="flex justify-end gap-4">
              <span className="text-gray-500">Due Date :</span>
              <span className="w-[100px] text-right font-medium">
                {formatDate(invoice.dueDate)}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ======== SUBJECT ======== */}
      {invoice.subject && (
        <div className="relative z-10 mb-4 text-xs">
          <span className="text-gray-500">Subject : </span>
          <span>{invoice.subject}</span>
        </div>
      )}

      {/* ======== ITEMS TABLE ======== */}
      <table className="relative z-10 mb-6 w-full border-collapse">
        <thead>
          <tr className="border-y-2 border-gray-800 bg-gray-50">
            <th className="w-8 px-2 py-3 text-left text-xs font-semibold">#</th>
            <th className="px-2 py-3 text-left text-xs font-semibold">
              Item &amp; Description
            </th>
            {isGstRegistered && (
              <th className="w-20 px-2 py-3 text-left text-xs font-semibold">
                HSN/SAC
              </th>
            )}
            <th className="w-12 px-2 py-3 text-right text-xs font-semibold">
              Qty
            </th>
            <th className="w-24 px-2 py-3 text-right text-xs font-semibold">
              Rate
            </th>
            {isGstRegistered && (
              <th className="w-24 px-2 py-3 text-right text-xs font-semibold">
                {interState ? "IGST" : "GST"}
              </th>
            )}
            <th className="w-24 px-2 py-3 text-right text-xs font-semibold">
              Amount
            </th>
          </tr>
        </thead>
        <tbody>
          {invoice.items.map((item, i) => {
            const gstInclusive = invoice.gstInclusive || false;
            let lineAmount = item.qty * item.rate;
            let baseRate = item.rate;

            if (gstInclusive && item.gstRate) {
              baseRate = item.rate / (1 + (item.gstRate ?? 0) / 100);
              lineAmount = item.qty * baseRate;
            }

            const itemTax = lineAmount * ((item.gstRate ?? 0) / 100);

            return (
              <tr
                key={i}
                className="border-b border-gray-200"
                style={{
                  backgroundColor: i % 2 === 1 ? "#fafafa" : "transparent",
                }}
              >
                <td className="px-2 py-3 align-top text-xs text-gray-500">
                  {i + 1}
                </td>
                <td className="px-2 py-3 align-top text-xs">
                  {item.description || "\u2014"}
                </td>
                {isGstRegistered && (
                  <td className="px-2 py-3 align-top text-xs text-gray-600">
                    {item.hsnSac}
                  </td>
                )}
                <td className="px-2 py-3 text-right align-top text-xs">
                  {item.qty}
                </td>
                <td className="px-2 py-3 text-right align-top text-xs">
                  {formatINR(baseRate)}
                </td>
                {isGstRegistered && (
                  <td className="px-2 py-3 text-right align-top text-xs">
                    <div>{formatINR(itemTax)}</div>
                    {(item.gstRate ?? 0) > 0 && (
                      <div className="text-[10px] text-gray-400">
                        {item.gstRate}%
                      </div>
                    )}
                  </td>
                )}
                <td className="px-2 py-3 text-right align-top text-xs font-medium">
                  {formatINR(lineAmount)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* ======== TOTALS ======== */}
      <div className="relative z-10 mb-6 flex justify-end">
        <div className="w-[300px]">
          {/* Subtotal */}
          <div className="flex justify-between py-1.5 text-xs">
            <span className="text-gray-500">Sub Total</span>
            <span>{formatINR(invoice.subtotal)}</span>
          </div>

          {/* GST breakdown — use stored gstTotal if available and differs from calculated */}
          {isGstRegistered && (() => {
            const calcTotal = gstBreakdown.reduce((s, g) => s + g.tax, 0);
            const storedGst = invoice.gstTotal || 0;
            // If stored GST differs significantly from calculated, use stored values
            const useStored = storedGst > 0 && Math.abs(storedGst - calcTotal) > 1;

            if (useStored) {
              // Show GST from stored totals (AI-extracted invoices)
              return interState ? (
                <div className="flex justify-between py-1.5 text-xs">
                  <span className="text-gray-500">IGST</span>
                  <span>{formatINR(storedGst)}</span>
                </div>
              ) : (
                <>
                  <div className="flex justify-between py-1.5 text-xs">
                    <span className="text-gray-500">CGST (9%)</span>
                    <span>{formatINR(storedGst / 2)}</span>
                  </div>
                  <div className="flex justify-between py-1.5 text-xs">
                    <span className="text-gray-500">SGST (9%)</span>
                    <span>{formatINR(storedGst / 2)}</span>
                  </div>
                </>
              );
            }

            // Otherwise use calculated breakdown per rate
            return gstBreakdown.map((group) =>
              interState ? (
                <div key={group.rate} className="flex justify-between py-1.5 text-xs">
                  <span className="text-gray-500">IGST ({group.rate}%)</span>
                  <span>{formatINR(group.tax)}</span>
                </div>
              ) : (
                <div key={group.rate}>
                  <div className="flex justify-between py-1.5 text-xs">
                    <span className="text-gray-500">CGST ({group.rate / 2}%)</span>
                    <span>{formatINR(group.tax / 2)}</span>
                  </div>
                  <div className="flex justify-between py-1.5 text-xs">
                    <span className="text-gray-500">SGST ({group.rate / 2}%)</span>
                    <span>{formatINR(group.tax / 2)}</span>
                  </div>
                </div>
              ),
            );
          })()}

          {/* TDS */}
          {invoice.tdsEnabled && (invoice.tdsAmount ?? 0) > 0 && (
            <div className="flex justify-between py-1.5 text-xs">
              <span className="text-gray-500">
                TDS ({invoice.tdsRate ?? 0}%)
              </span>
              <span className="text-red-600">
                (-) {formatINR(invoice.tdsAmount!)}
              </span>
            </div>
          )}

          {/* Round Off */}
          {invoice.roundOff !== undefined && invoice.roundOff !== 0 && (
            <div className="flex justify-between py-1.5 text-xs">
              <span className="text-gray-500">Round Off</span>
              <span>
                {invoice.roundOff > 0 ? "+" : ""}
                {formatINR(invoice.roundOff)}
              </span>
            </div>
          )}

          {/* Net Total */}
          <div className="mt-2 flex justify-between border-t-2 border-gray-800 py-2 text-sm font-bold">
            <span>Total</span>
            <span>
              {"\u20B9"}
              {formatINR(invoice.netTotal)}
            </span>
          </div>
        </div>
      </div>

      {/* ======== AMOUNT IN WORDS ======== */}
      <div className="relative z-10 mb-6 border-t border-gray-200 pt-3">
        <p className="text-xs">
          <span className="text-gray-500">Total in Words: </span>
          <span className="font-medium italic">
            {amountInWords(invoice.netTotal)}
          </span>
        </p>
      </div>

      {/* ======== BANK DETAILS ======== */}
      {bank && (bank.accountName || bank.accountNumber) && (
        <div className="relative z-10 mb-6 border-t border-gray-200 pt-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-800">
            Payment Details
          </p>
          <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs">
            {bank.accountName && (
              <>
                <span className="text-gray-500">Account Name</span>
                <span>{bank.accountName}</span>
              </>
            )}
            {bank.accountNumber && (
              <>
                <span className="text-gray-500">Account No.</span>
                <span>{bank.accountNumber}</span>
              </>
            )}
            {bank.bankName && (
              <>
                <span className="text-gray-500">Bank</span>
                <span>{bank.bankName}</span>
              </>
            )}
            {bank.branch && (
              <>
                <span className="text-gray-500">Branch</span>
                <span>{bank.branch}</span>
              </>
            )}
            {bank.ifscCode && (
              <>
                <span className="text-gray-500">IFSC Code</span>
                <span>{bank.ifscCode}</span>
              </>
            )}
          </div>
        </div>
      )}

      {/* ======== NOTES ======== */}
      {invoice.notes && (
        <div className="relative z-10 mb-6 border-t border-gray-200 pt-4">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-gray-800">
            Notes
          </p>
          <p className="whitespace-pre-line text-xs text-gray-600">
            {invoice.notes}
          </p>
        </div>
      )}

      {/* ======== AUTHORIZED SIGNATORY ======== */}
      <div className="relative z-10 border-t border-gray-200 pt-6 text-right">
        <p className="text-xs font-medium">Authorized Signatory</p>
        <div className="mt-6 inline-block w-48 border-t border-gray-400" />
        {seller?.name && (
          <p className="mt-1 text-xs text-gray-500">{seller.name}</p>
        )}
      </div>
    </div>
  );
}
