# Invoice-Gen Integration into ArthaSutra

## Source: /Users/kishorraj/Developer/Invoice-Gen
## Target: /Users/kishorraj/Developer/arthasutra

## Overview
Embed the full Invoice Generator as a native "Invoices" section in ArthaSutra.
Migrate from Neon Postgres to Convex. Full integration with existing Income/GST data.

---

## Phase 1: Convex Schema + API (Day 1)

### New Convex Tables
1. **invoices** — core invoice data
   - userId, sellerId, buyerId, invoiceNumber, invoiceDate, dueDate
   - documentType: "invoice" | "quotation" | "proforma" | "credit_note" | "debit_note" | "purchase_order" | "delivery_challan"
   - items: array of {description, hsnSac, qty, rate, gstRate}
   - subtotal, gstTotal, tdsAmount, roundOff, netTotal
   - status: "draft" | "sent" | "paid" | "partially_paid" | "overdue" | "cancelled"
   - template, watermark, notes, terms
   - bankId (reference to seller's bank)
   - tdsEnabled, tdsRate, tdsSection, gstInclusive
   - logoDataUrl, signatureDataUrl, showUpiQr

2. **invoice_sellers** — user's business profiles
   - userId, name, address, gstin, pan, email, phone
   - logoDataUrl, logoPosition, invoicePrefix, upiId, signatureDataUrl

3. **invoice_buyers** — customer directory
   - userId, name, address, gstin, pan, email, phone, contactPerson

4. **invoice_banks** — bank account details per seller
   - userId, sellerId, accountName, accountNumber, bankName, branch, ifscCode

5. **invoice_payments** — payment records
   - userId, invoiceId, amount, method, date, note

6. **invoice_counters** — auto-increment invoice numbers
   - userId, sellerId, nextNum

7. **invoice_products** — reusable item catalog
   - userId, name, description, hsnSac, rate, gstRate

### Convex Mutations/Queries
- CRUD for all 7 tables
- getNextInvoiceNumber + commitInvoiceNumber
- getInvoiceWithPayments (join invoice + payments)
- getInvoiceSummary (dashboard stats)
- linkInvoiceToIncome (connect invoice to ArthaSutra income entry)

---

## Phase 2: Invoice Page UI (Day 1-2)

### New Page: /invoices
- Add "Invoices" to sidebar navigation (between Credit Cards and Tax)
- Icon: FileText or Receipt

### Dashboard View
- KPI Cards: Total Invoiced, Paid, Outstanding, Overdue
- Invoice list table (filterable by status, date, customer)
- Quick actions: Create, Edit, Duplicate, Download PDF
- Bulk actions: Export CSV/Excel, Download PDFs as ZIP

### Editor View (Dialog or full page)
- 2-panel layout: Form (left) + Live Preview (right)
- Form fields: all invoice details from Invoice-Gen
- Seller/Buyer/Product dropdowns (from saved data)
- Auto-calculate GST (IGST vs CGST+SGST based on state codes)
- TDS deduction toggle
- Template selector (6 templates)

### PDF Generation
- Port InvoicePdf.jsx (react-pdf component) to Next.js
- Install @react-pdf/renderer
- Server-side or client-side PDF generation
- Download button + Print

### Settings (sub-tabs or in Settings page)
- Seller profile management (logo, bank, GSTIN)
- Buyer directory
- Product catalog
- Invoice templates

---

## Phase 3: Integration Points (Day 2)

### Invoice → Income Entry
- When invoice is marked "Paid", auto-create Income entry:
  - amount = invoice netTotal
  - type = "freelance" or based on seller type
  - tds_deducted = invoice tdsAmount
  - gst_collected = invoice gstTotal
  - description = "Invoice {number} - {buyerName}"

### Invoice → GST Tracker
- Tax page GST data should include invoice GST
- Output GST = sum of invoice gstTotal
- Monthly breakdown by invoice date

### Invoice → Expense matching
- CC/Bank expenses categorized as "credit_card_bill" or "other" can be linked to invoices

### Dark Mode
- Port Invoice-Gen's CSS variable system
- Add dark mode toggle to ArthaSutra Settings/Preferences
- Apply to all pages

---

## Phase 4: Advanced Features (Day 3)

### Payment Tracking
- Record partial/full payments per invoice
- Payment history per invoice
- Auto-update invoice status

### Analytics
- Revenue by month/quarter
- GST summary for GSTR-1 filing
- Top customers by revenue
- Outstanding/overdue aging

### Bulk Operations
- Export invoices to Excel/CSV
- Download multiple PDFs as ZIP
- Duplicate invoice for recurring billing

### Backup/Restore
- Export all invoice data
- Import from Invoice-Gen (migration tool)

---

## Files to Create/Modify

### New Files
```
src/app/invoices/page.tsx              — Main invoices page (dashboard + editor)
src/components/invoice/               — Invoice components directory
  InvoiceForm.tsx                      — Invoice editor form
  InvoicePreview.tsx                   — Live preview
  InvoicePdf.tsx                       — PDF template (react-pdf)
  PdfDownloadButton.tsx                — Download button
  SellerForm.tsx                       — Seller profile editor
  BuyerForm.tsx                        — Buyer editor
  ProductForm.tsx                      — Product catalog
  PaymentForm.tsx                      — Payment recording
  InvoiceHistory.tsx                   — Invoice list/table
  UpiQrCode.tsx                        — QR code for UPI payment
src/lib/invoice/                       — Invoice utilities
  calculations.ts                      — GST, TDS, rounding
  templates.ts                         — 6 invoice templates
  states.ts                            — Indian states + GST codes
  documentTypes.ts                     — 7 document types
  numberToWords.ts                     — Amount in words
  hsnCodes.ts                          — HSN/SAC lookup
convex/invoices.ts                     — All invoice Convex mutations/queries
convex/schema.ts                       — Add 7 new tables
```

### Modified Files
```
convex/schema.ts                       — Add invoice tables
src/components/layout/sidebar.tsx      — Add Invoices nav item
src/app/tax/page.tsx                   — GST tracker uses invoice data
src/app/income/page.tsx                — Link to invoices
```

---

## Dependencies to Add
```
@react-pdf/renderer    — PDF generation
qrcode.react           — UPI QR codes
jszip                  — Bulk PDF download
file-saver             — Client-side file download
```

## Estimated Effort
- Phase 1 (Schema + API): 2-3 hours
- Phase 2 (UI): 4-6 hours  
- Phase 3 (Integration): 2-3 hours
- Phase 4 (Advanced): 3-4 hours
- Total: ~12-16 hours across 2-3 sessions
