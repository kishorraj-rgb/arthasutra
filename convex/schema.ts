import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    name: v.string(),
    email: v.string(),
    passwordHash: v.string(),
    pan_number: v.optional(v.string()),
    aadhaar_last4: v.optional(v.string()),
    user_type: v.union(v.literal("employee"), v.literal("consultant"), v.literal("both")),
    annual_ctc: v.optional(v.number()),
    monthly_salary: v.optional(v.number()),
    gst_registered: v.boolean(),
    gstin: v.optional(v.string()),
    financial_year_start: v.optional(v.string()),
    regime_preference: v.optional(v.union(v.literal("old"), v.literal("new"))),
    created_at: v.number(),
  }).index("by_email", ["email"]),

  sessions: defineTable({
    userId: v.id("users"),
    token: v.string(),
    expiresAt: v.number(),
  }).index("by_token", ["token"]),

  income_entries: defineTable({
    userId: v.id("users"),
    date: v.string(),
    amount: v.number(),
    type: v.union(
      v.literal("salary"),
      v.literal("freelance"),
      v.literal("rental"),
      v.literal("interest"),
      v.literal("dividend"),
      v.literal("refund"),
      v.literal("reimbursement"),
      v.literal("transfer"),
      v.literal("other")
    ),
    description: v.string(),
    subcategory: v.optional(v.string()),
    source_bank: v.optional(v.string()), // Which of user's bank accounts this came from
    tds_deducted: v.number(),
    gst_collected: v.number(),
    invoice_number: v.optional(v.string()),
  })
    .index("by_user", ["userId"])
    .index("by_user_date", ["userId", "date"]),

  expense_entries: defineTable({
    userId: v.id("users"),
    date: v.string(),
    amount: v.number(),
    category: v.string(), // Supports both default and custom categories
    description: v.string(),
    subcategory: v.optional(v.string()),
    source_bank: v.optional(v.string()), // Which of user's bank accounts this came from
    gst_paid: v.number(),
    is_business_expense: v.boolean(),
    receipt_url: v.optional(v.string()),
  })
    .index("by_user", ["userId"])
    .index("by_user_date", ["userId", "date"]),

  investments: defineTable({
    userId: v.id("users"),
    type: v.union(
      v.literal("mutual_fund"),
      v.literal("stocks"),
      v.literal("ppf"),
      v.literal("nps"),
      v.literal("fd"),
      v.literal("rd"),
      v.literal("gold"),
      v.literal("real_estate"),
      v.literal("elss"),
      v.literal("ulip")
    ),
    name: v.string(),
    invested_amount: v.number(),
    current_value: v.number(),
    date_invested: v.string(),
    maturity_date: v.optional(v.string()),
    expected_return_rate: v.number(),
    lock_in_period: v.optional(v.number()),
    tax_saving: v.boolean(),
    section: v.union(
      v.literal("80C"),
      v.literal("80D"),
      v.literal("80CCD"),
      v.literal("none")
    ),
  }).index("by_user", ["userId"]),

  tax_records: defineTable({
    userId: v.id("users"),
    financial_year: v.string(),
    gross_income: v.number(),
    total_deductions: v.number(),
    taxable_income: v.number(),
    tax_old_regime: v.number(),
    tax_new_regime: v.number(),
    tds_deducted: v.number(),
    advance_tax_paid: v.number(),
    gst_collected: v.number(),
    gst_paid: v.number(),
    gst_liability: v.number(),
    regime_chosen: v.union(v.literal("old"), v.literal("new")),
  })
    .index("by_user", ["userId"])
    .index("by_user_fy", ["userId", "financial_year"]),

  advance_tax_payments: defineTable({
    userId: v.id("users"),
    financial_year: v.string(),
    quarter: v.union(v.literal("Q1"), v.literal("Q2"), v.literal("Q3"), v.literal("Q4")),
    due_date: v.string(),
    amount_due: v.number(),
    amount_paid: v.number(),
    paid_date: v.optional(v.string()),
    status: v.union(v.literal("pending"), v.literal("paid"), v.literal("overdue")),
  })
    .index("by_user", ["userId"])
    .index("by_user_fy", ["userId", "financial_year"]),

  gst_filings: defineTable({
    userId: v.id("users"),
    period: v.string(),
    gstr1_due: v.string(),
    gstr3b_due: v.string(),
    output_gst: v.number(),
    input_gst: v.number(),
    net_gst_liability: v.number(),
    status: v.union(v.literal("pending"), v.literal("filed")),
    filing_date: v.optional(v.string()),
  })
    .index("by_user", ["userId"])
    .index("by_user_period", ["userId", "period"]),

  gst_cash_ledger: defineTable({
    userId: v.id("users"),
    srNo: v.number(),
    date: v.string(),
    referenceNo: v.string(),
    taxPeriod: v.string(),
    description: v.string(),
    txnType: v.string(),
    // Tax amounts debited/credited
    igst: v.number(),
    cgst: v.number(),
    sgst: v.number(),
    cess: v.number(),
    total: v.number(),
    // Interest components
    interestIgst: v.number(),
    interestCgst: v.number(),
    interestSgst: v.number(),
    // Running balance after this txn
    balanceIgst: v.number(),
    balanceCgst: v.number(),
    balanceSgst: v.number(),
    balanceCess: v.number(),
    balanceTotal: v.number(),
  }).index("by_user", ["userId"]),

  reminders: defineTable({
    userId: v.id("users"),
    type: v.union(
      v.literal("advance_tax"),
      v.literal("gst_filing"),
      v.literal("investment_review"),
      v.literal("insurance_premium"),
      v.literal("loan_emi"),
      v.literal("custom")
    ),
    title: v.string(),
    due_date: v.string(),
    amount: v.optional(v.number()),
    is_recurring: v.boolean(),
    frequency: v.optional(v.string()),
    is_completed: v.boolean(),
    notes: v.optional(v.string()),
  })
    .index("by_user", ["userId"])
    .index("by_user_date", ["userId", "due_date"]),

  insurance_policies: defineTable({
    userId: v.id("users"),
    type: v.union(
      v.literal("term"),
      v.literal("health"),
      v.literal("vehicle"),
      v.literal("home"),
      v.literal("travel")
    ),
    provider: v.string(),
    policy_number: v.string(),
    sum_assured: v.number(),
    annual_premium: v.number(),
    next_due_date: v.string(),
    maturity_date: v.optional(v.string()),
    nominee: v.optional(v.string()),
    // Extended fields from PDF import
    policy_start_date: v.optional(v.string()),
    policy_end_date: v.optional(v.string()),
    premium_breakdown: v.optional(v.object({
      net_premium: v.number(),
      gst: v.number(),
      total_premium: v.number(),
    })),
    vehicle_details: v.optional(v.object({
      registration_no: v.optional(v.string()),
      make: v.optional(v.string()),
      model: v.optional(v.string()),
      variant: v.optional(v.string()),
      fuel_type: v.optional(v.string()),
      year: v.optional(v.string()),
      engine_no: v.optional(v.string()),
      chassis_no: v.optional(v.string()),
      rto_location: v.optional(v.string()),
      idv: v.optional(v.number()),
      body_type: v.optional(v.string()),
    })),
    insured_members: v.optional(v.array(v.object({
      name: v.string(),
      relationship: v.optional(v.string()),
      dob: v.optional(v.string()),
      member_id: v.optional(v.string()),
      gender: v.optional(v.string()),
      age: v.optional(v.number()),
    }))),
    add_ons: v.optional(v.array(v.object({
      name: v.string(),
      details: v.optional(v.string()),
      uin: v.optional(v.string()),
    }))),
    ncb_percent: v.optional(v.number()),
    policy_category: v.optional(v.string()),
    coverage_type: v.optional(v.string()),
    deductible: v.optional(v.number()),
    financier: v.optional(v.string()),
    previous_policy_number: v.optional(v.string()),
    previous_insurer: v.optional(v.string()),
  }).index("by_user", ["userId"]),

  insurance_documents: defineTable({
    userId: v.id("users"),
    policyId: v.id("insurance_policies"),
    storageId: v.id("_storage"),
    name: v.string(),
    file_size: v.number(),
    file_type: v.string(),
    uploaded_at: v.number(),
  }).index("by_policy", ["policyId"]),

  loans: defineTable({
    userId: v.id("users"),
    type: v.union(
      v.literal("home"),
      v.literal("car"),
      v.literal("personal"),
      v.literal("education")
    ),
    lender: v.string(),
    principal: v.number(),
    outstanding: v.number(),
    emi_amount: v.number(),
    interest_rate: v.number(),
    emi_date: v.number(),
    tenure_remaining: v.number(),
    // Extended fields from statement import
    account_number: v.optional(v.string()),
    sanctioned_amount: v.optional(v.number()),
    product_type: v.optional(v.string()),
    start_date: v.optional(v.string()),
    loan_term: v.optional(v.number()),
    ifsc_code: v.optional(v.string()),
    branch_name: v.optional(v.string()),
  }).index("by_user", ["userId"]),

  loan_transactions: defineTable({
    userId: v.id("users"),
    loanId: v.id("loans"),
    date: v.string(),
    value_date: v.optional(v.string()),
    description: v.string(),
    debit: v.number(),
    credit: v.number(),
    balance: v.number(),
    type: v.union(
      v.literal("interest"),
      v.literal("principal_repayment"),
      v.literal("compound_repayment"),
      v.literal("interest_repayment"),
      v.literal("charges"),
      v.literal("deposit"),
      v.literal("other")
    ),
    reference: v.optional(v.string()),
  }).index("by_loan", ["loanId"]),

  subscriptions: defineTable({
    userId: v.id("users"),
    name: v.string(),
    amount: v.number(),
    frequency: v.union(
      v.literal("monthly"),
      v.literal("quarterly"),
      v.literal("half_yearly"),
      v.literal("yearly")
    ),
    category: v.union(
      v.literal("entertainment"),
      v.literal("productivity"),
      v.literal("cloud_storage"),
      v.literal("insurance"),
      v.literal("utility"),
      v.literal("fitness"),
      v.literal("education"),
      v.literal("other")
    ),
    next_renewal_date: v.string(),
    auto_renew: v.boolean(),
    payment_method: v.union(
      v.literal("credit_card"),
      v.literal("debit_card"),
      v.literal("upi"),
      v.literal("bank_transfer")
    ),
    card_last4: v.optional(v.string()),
    status: v.union(
      v.literal("active"),
      v.literal("paused"),
      v.literal("cancelled")
    ),
    notes: v.optional(v.string()),
    detected_from: v.optional(v.string()),
  }).index("by_user", ["userId"]),

  documents: defineTable({
    userId: v.id("users"),
    name: v.string(),
    category: v.union(
      v.literal("pan_card"),
      v.literal("aadhaar"),
      v.literal("passport"),
      v.literal("voter_id"),
      v.literal("driving_license"),
      v.literal("bank_statement"),
      v.literal("salary_slip"),
      v.literal("form_16"),
      v.literal("itr"),
      v.literal("gst_return"),
      v.literal("investment_proof"),
      v.literal("insurance_policy"),
      v.literal("property_doc"),
      v.literal("invoice"),
      v.literal("receipt"),
      v.literal("other")
    ),
    storageId: v.id("_storage"),
    file_size: v.number(),
    file_type: v.string(),
    tags: v.optional(v.array(v.string())),
    financial_year: v.optional(v.string()),
    uploaded_at: v.number(),
    notes: v.optional(v.string()),
    extracted_text: v.optional(v.string()),
    extracted_data: v.optional(v.any()),
  })
    .index("by_user", ["userId"])
    .index("by_user_category", ["userId", "category"]),

  category_preferences: defineTable({
    userId: v.id("users"),
    scope: v.union(v.literal("expense"), v.literal("income")),
    slug: v.string(),
    label: v.string(),
    icon: v.optional(v.string()),
    color: v.optional(v.string()),
    sort_order: v.number(),
    hidden: v.boolean(),
    subcategories: v.optional(v.array(v.string())),
  }).index("by_user_scope", ["userId", "scope"]),

  bank_accounts: defineTable({
    userId: v.id("users"),
    bank_name: v.string(), // e.g. "ICICI", "HDFC", "Axis", "SBI"
    display_name: v.string(), // e.g. "Primary Savings"
    account_last4: v.optional(v.string()), // Last 4 digits
    ifsc_code: v.optional(v.string()),
    logo_id: v.string(), // Identifier for bank logo (e.g. "icici", "hdfc", "axis", "sbi", "custom")
    logo_color: v.optional(v.string()), // Custom color for logo
    account_type: v.union(v.literal("internal"), v.literal("external")), // internal = user's own, external = beneficiary
    sort_order: v.number(),
    is_active: v.boolean(),
  })
    .index("by_user", ["userId"])
    .index("by_user_type", ["userId", "account_type"]),

  credit_cards: defineTable({
    userId: v.id("users"),
    card_name: v.string(),
    card_last4: v.string(),
    card_network: v.union(v.literal("visa"), v.literal("mastercard"), v.literal("rupay"), v.literal("amex")),
    issuer: v.string(),
    credit_limit: v.optional(v.number()),
    billing_cycle_date: v.optional(v.number()),
    payment_due_date: v.optional(v.number()),
    status: v.union(v.literal("active"), v.literal("closed")),
    color: v.optional(v.string()),
    logo_id: v.optional(v.string()),
  }).index("by_user", ["userId"]),

  cc_transactions: defineTable({
    userId: v.id("users"),
    credit_card_id: v.id("credit_cards"),
    date: v.string(),
    amount: v.number(),
    type: v.union(v.literal("debit"), v.literal("credit")),
    description: v.string(),
    merchant_name: v.optional(v.string()),
    category: v.string(),
    subcategory: v.optional(v.string()),
    matched_expense_id: v.optional(v.id("expense_entries")),
    match_status: v.union(
      v.literal("matched"),
      v.literal("unmatched"),
      v.literal("manual_match"),
      v.literal("ignored")
    ),
    match_confidence: v.optional(v.union(v.literal("high"), v.literal("medium"), v.literal("low"))),
    statement_month: v.string(),
  })
    .index("by_user", ["userId"])
    .index("by_card", ["credit_card_id"])
    .index("by_card_month", ["credit_card_id", "statement_month"]),

  cc_statements: defineTable({
    userId: v.id("users"),
    credit_card_id: v.id("credit_cards"),
    statement_month: v.string(),
    statement_date: v.optional(v.string()),
    opening_balance: v.optional(v.number()),
    closing_balance: v.optional(v.number()),
    minimum_due: v.optional(v.number()),
    total_due: v.optional(v.number()),
    payment_due_date: v.optional(v.string()),
    payment_status: v.union(v.literal("paid"), v.literal("partial"), v.literal("unpaid")),
    transaction_count: v.optional(v.number()),
  })
    .index("by_user", ["userId"])
    .index("by_card_month", ["credit_card_id", "statement_month"]),

  // ═══════════════════════════════════════════════════════════════════════
  // Invoice Generator Tables
  // ═══════════════════════════════════════════════════════════════════════

  invoice_sellers: defineTable({
    userId: v.id("users"),
    name: v.string(),
    address: v.optional(v.string()),
    gstin: v.optional(v.string()),
    pan: v.optional(v.string()),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    logoDataUrl: v.optional(v.string()),
    logoPosition: v.optional(v.string()),
    invoicePrefix: v.optional(v.string()),
    upiId: v.optional(v.string()),
    signatureDataUrl: v.optional(v.string()),
    defaultBankId: v.optional(v.id("invoice_banks")),
  }).index("by_user", ["userId"]),

  invoice_buyers: defineTable({
    userId: v.id("users"),
    name: v.string(),
    address: v.optional(v.string()),
    gstin: v.optional(v.string()),
    pan: v.optional(v.string()),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    contactPerson: v.optional(v.string()),
  }).index("by_user", ["userId"]),

  invoice_banks: defineTable({
    userId: v.id("users"),
    sellerId: v.optional(v.id("invoice_sellers")),
    accountName: v.string(),
    accountNumber: v.string(),
    bankName: v.string(),
    branch: v.optional(v.string()),
    ifscCode: v.string(),
  }).index("by_user", ["userId"]),

  invoice_products: defineTable({
    userId: v.id("users"),
    name: v.string(),
    description: v.optional(v.string()),
    hsnSac: v.optional(v.string()),
    rate: v.number(),
    gstRate: v.optional(v.number()),
  }).index("by_user", ["userId"]),

  invoices: defineTable({
    userId: v.id("users"),
    sellerId: v.optional(v.id("invoice_sellers")),
    buyerId: v.optional(v.id("invoice_buyers")),
    bankId: v.optional(v.id("invoice_banks")),
    documentType: v.string(),
    invoiceNumber: v.string(),
    invoiceDate: v.string(),
    dueDate: v.optional(v.string()),
    terms: v.optional(v.string()),
    subject: v.optional(v.string()),
    placeOfSupplyCode: v.optional(v.string()),
    items: v.array(v.object({
      description: v.string(),
      hsnSac: v.optional(v.string()),
      qty: v.number(),
      rate: v.number(),
      gstRate: v.optional(v.number()),
    })),
    subtotal: v.number(),
    gstTotal: v.number(),
    tdsAmount: v.optional(v.number()),
    roundOff: v.optional(v.number()),
    netTotal: v.number(),
    status: v.string(),
    template: v.optional(v.string()),
    watermark: v.optional(v.string()),
    notes: v.optional(v.string()),
    tdsEnabled: v.optional(v.boolean()),
    tdsRate: v.optional(v.number()),
    tdsSection: v.optional(v.string()),
    gstInclusive: v.optional(v.boolean()),
    logoDataUrl: v.optional(v.string()),
    signatureDataUrl: v.optional(v.string()),
    showUpiQr: v.optional(v.boolean()),
    // Denormalized seller/buyer data for PDF rendering without joins
    sellerData: v.optional(v.any()),
    buyerData: v.optional(v.any()),
    bankData: v.optional(v.any()),
    // Link to ArthaSutra income entry (when paid)
    linkedIncomeId: v.optional(v.id("income_entries")),
  })
    .index("by_user", ["userId"])
    .index("by_seller", ["sellerId"])
    .index("by_status", ["userId", "status"]),

  invoice_payments: defineTable({
    userId: v.id("users"),
    invoiceId: v.id("invoices"),
    amount: v.number(),
    method: v.optional(v.string()),
    date: v.string(),
    note: v.optional(v.string()),
  }).index("by_invoice", ["invoiceId"]),

  invoice_counters: defineTable({
    userId: v.id("users"),
    sellerId: v.id("invoice_sellers"),
    nextNum: v.number(),
  }).index("by_user_seller", ["userId", "sellerId"]),
});
