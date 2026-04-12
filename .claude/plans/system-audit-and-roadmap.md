# ArthaSutra — System Audit, AS-IS vs TO-BE Analysis

## Executive Summary
ArthaSutra is a comprehensive personal finance management system with 17 modules covering Income, Expenses, Credit Cards, Invoicing, Loans, Insurance, Investments, Tax Planning, and more. The system has strong feature coverage but requires **critical security hardening**, **automation improvements**, and **cross-module intelligence**.

---

## CRITICAL SECURITY ISSUES (Fix Immediately)

### 1. API Routes — No Authentication
**ALL 7 API routes** have ZERO authentication:
- `/api/parse-pdf` — OpenAI API exposed
- `/api/categorize` — Gemini API exposed
- `/api/ocr` — Google Vision API exposed
- `/api/parse-insurance` — OpenAI API exposed
- `/api/parse-loan` — OpenAI API exposed
- `/api/parse-invoice-doc` — OpenAI API exposed
- `/api/decrypt-xlsx` — File decryption exposed

**Risk**: Anyone who knows the URL can call these endpoints, consuming your API credits and potentially extracting data.

**Fix**: Add auth middleware checking Convex session token in request headers.

### 2. Convex Mutations — No Ownership Validation
All Convex queries/mutations accept `userId` as a client parameter but **never validate** that the requesting user owns that userId. Any client can query/modify any user's data.

**Fix**: Use `ctx.auth` to validate the authenticated user matches the requested userId.

### 3. Sensitive Data Storage
- PAN numbers stored in plaintext
- Aadhaar last4 stored in plaintext
- Bank account numbers stored in plaintext
- No encryption at rest for financial data

**Fix**: Encrypt PII fields before storage, decrypt on read.

### 4. File Upload — No Limits
No file size limits on any upload endpoint. A malicious user could upload gigabyte files to exhaust server resources.

**Fix**: Enforce 50MB max, whitelist file types (PDF/XLS/XLSX/CSV/JPG/PNG).

---

## AS-IS Analysis (Current State)

### Data Flow Diagram
```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│ Bank         │────>│ Import Page   │────>│ Income      │
│ Statements   │     │ (Parse/AI)    │     │ Entries     │
│ (PDF/XLS/CSV)│     └──────────────┘     └──────┬──────┘
└─────────────┘              │                    │
                             │              ┌─────▼──────┐
┌─────────────┐              │              │ Expense    │
│ CC           │────>│ CC Import    │────>│ Entries     │
│ Statements   │     │ (Parse)      │     └──────┬──────┘
│ (CSV/XLSX)   │     └──────────────┘            │
└─────────────┘                                   │
                                            ┌─────▼──────┐
┌─────────────┐                             │ Dashboard  │
│ Invoice      │────> Invoice Page ────>    │ (Aggregated│
│ PDFs         │     (AI Extract)           │  Views)    │
└─────────────┘              │              └──────┬──────┘
                             │                     │
                       ┌─────▼──────┐        ┌─────▼──────┐
                       │ Invoice    │        │ Tax Page   │
                       │ Records    │───────>│ (Manual    │
                       └────────────┘        │  Inputs)   │
                                             └────────────┘
```

### Current Strengths
1. **Comprehensive Import** — Supports HDFC, ICICI, SBI, Axis bank statements (PDF/XLS/CSV)
2. **Credit Card Support** — HDFC (~|~ format), ICICI, Axis, SBI, AmEx CC statement parsing
3. **AI Integration** — GPT-4o-mini for document extraction, Gemini for categorization
4. **Invoice Generator** — Full GST-compliant invoicing with preview and PDF
5. **Loan Management** — SBI loan import, amortization schedule, foreclosure calculator
6. **Insurance** — Vehicle/Health/Term policy import with documents
7. **Tax Planning** — 5-tab tax planner with old/new regime comparison
8. **Rich Exports** — Styled Excel with Dashboard + Transactions sheets

### Current Weaknesses
1. **Manual GST/TDS Entry** — Imported transactions don't auto-detect GST/TDS amounts
2. **No Cross-Module Linking** — Invoices, Income, CC not automatically connected
3. **Category Intelligence** — Basic keyword matching, no learning from user corrections
4. **Subscription Detection** — Only from expenses, not CC transactions
5. **Security Gaps** — No API auth, no data ownership validation
6. **Dashboard** — Some hardcoded demo data, not all real-time
7. **Reports** — Static, not dynamically generated from actual data

---

## TO-BE Analysis (Target State)

### Enhanced Data Flow
```
┌─────────────┐     ┌──────────────────┐     ┌─────────────┐
│ Bank         │────>│ Smart Import     │────>│ Income      │
│ Statements   │     │ + Auto Categorize│     │ (GST/TDS    │
│              │     │ + Auto GST/TDS   │     │  auto-filled│
└─────────────┘     │ + Dedup          │     │  linked to  │
                     │ + Sub-category   │     │  invoices)  │
┌─────────────┐     └──────────────────┘     └──────┬──────┘
│ CC           │────>│ CC Smart Import  │            │
│ Statements   │     │ + EMI detection  │     ┌──────▼──────┐
│              │     │ + Subscription   │     │ Expense    │
└─────────────┘     │   detection      │     │ (Auto sub- │
                     │ + Merchant ID    │     │  category, │
                     └──────────────────┘     │  GST ITC)  │
                                              └──────┬──────┘
┌─────────────┐                                      │
│ Invoice      │──> AI Extract ──> Auto-create ──────┤
│ Documents    │    + Auto-link to Income             │
└─────────────┘    + GST/TDS calculated              │
                                               ┌─────▼──────┐
                                               │ Smart Tax  │
                                               │ (Auto-calc │
                                               │  from ALL  │
                                               │  sections) │
                                               └─────┬──────┘
                                                     │
                                               ┌─────▼──────┐
                                               │ Compliance │
                                               │ Dashboard  │
                                               │ GSTR-1/3B  │
                                               │ Advance Tax│
                                               │ TDS Recon  │
                                               └────────────┘
```

### TO-BE Improvements by Module

#### 1. Security Hardening (P0 — Critical)
- [ ] Auth middleware on all API routes
- [ ] Convex ownership validation (ctx.auth)
- [ ] PII encryption (PAN, Aadhaar, bank accounts)
- [ ] File upload size limits (50MB)
- [ ] Rate limiting on AI endpoints
- [ ] Audit logging for sensitive operations

#### 2. Smart Import (P1 — High)
- [ ] Auto-detect GST from transaction descriptions (IGST/CGST/SGST keywords)
- [ ] Auto-detect TDS from salary/freelance/interest income
- [ ] Run AI categorization automatically during import (not as separate step)
- [ ] Auto-assign subcategories based on merchant name
- [ ] Better duplicate detection across bank accounts
- [ ] Import summary showing: X new, Y duplicates, Z categorized

#### 3. Subscription Intelligence (P1 — High)
- [ ] Detect subscriptions from CC transactions (Netflix, Spotify, etc.)
- [ ] Detect from bank expenses (insurance premiums, loan EMIs, SIPs)
- [ ] Merchant name normalization for better grouping
- [ ] Auto-create subscription entries when pattern detected
- [ ] Track subscription price changes over time
- [ ] Renewal reminders from detected subscriptions
- [ ] Show monthly/annual subscription cost on dashboard

#### 4. GST Compliance Engine (P1 — High)
- [ ] Auto-extract GST from invoice descriptions
- [ ] ITC eligibility check (only business expenses qualify)
- [ ] GSTR-1 report generation (outward supplies)
- [ ] GSTR-3B calculation (monthly return)
- [ ] GST payment calendar with reminders
- [ ] HSN/SAC code validation against government list
- [ ] E-invoice generation (for turnover > 5 crore)

#### 5. Advance Tax Automation (P1 — High)
- [ ] Auto-calculate quarterly advance tax from YTD income
- [ ] Factor in TDS already deducted
- [ ] Interest calculation for late payments (234B/234C)
- [ ] Reminder system for due dates (15 Jun/Sep/Dec/Mar)
- [ ] Challan 280 generation for online payment

#### 6. Category Intelligence (P2 — Medium)
- [ ] Learn from user corrections (when user changes AI category)
- [ ] Merchant database with known categories
- [ ] Subcategory auto-assignment from merchant name
- [ ] Category consistency across Expense/CC/Income
- [ ] Bulk re-categorize similar transactions
- [ ] Category-based budgets and alerts

#### 7. Cross-Module Linking (P2 — Medium)
- [ ] Auto-link CC bill payments to expense entries
- [ ] Auto-link invoice payments to income entries
- [ ] Auto-link loan EMIs to expense entries
- [ ] Auto-link insurance premiums to expense entries
- [ ] Auto-link SIP/investment debits to expense entries
- [ ] Reconciliation dashboard showing linked vs unlinked

#### 8. Dashboard Intelligence (P2 — Medium)
- [ ] All real-time data (remove any hardcoded values)
- [ ] Net worth calculation (assets - liabilities)
- [ ] Cash flow projection (based on recurring patterns)
- [ ] Savings rate calculation
- [ ] Expense trend analysis (month-over-month)
- [ ] Tax liability projection

#### 9. Reports Enhancement (P3 — Low)
- [ ] Dynamic P&L statement from actual data
- [ ] Balance sheet calculation
- [ ] Tax computation sheet (ITR format)
- [ ] GST reconciliation report
- [ ] Bank reconciliation statement
- [ ] Export to Tally-compatible format

---

## Implementation Priority

### Sprint 1 (Security — 1 day)
1. Auth middleware for API routes
2. Convex ownership validation
3. File upload limits
4. PII encryption

### Sprint 2 (Automation — 2 days)
1. Auto-categorize during import
2. Subscription detection from CC + Bank
3. Auto-detect GST/TDS amounts
4. Auto-link invoice payments

### Sprint 3 (Tax Compliance — 2 days)
1. GSTR-1/3B report generation
2. Advance tax auto-calculation
3. TDS reconciliation with 26AS data
4. Tax reminders automation

### Sprint 4 (Intelligence — 2 days)
1. Category learning from corrections
2. Merchant normalization
3. Cross-module reconciliation
4. Dashboard with all real-time data

---

## Estimated Effort
| Sprint | Focus | Effort |
|--------|-------|--------|
| Sprint 1 | Security | 8 hours |
| Sprint 2 | Automation | 16 hours |
| Sprint 3 | Tax Compliance | 16 hours |
| Sprint 4 | Intelligence | 16 hours |
| **Total** | | **~56 hours (7 days)** |
