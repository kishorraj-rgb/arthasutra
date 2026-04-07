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
    category: v.union(
      v.literal("housing"),
      v.literal("food"),
      v.literal("transport"),
      v.literal("medical"),
      v.literal("education"),
      v.literal("insurance"),
      v.literal("investment"),
      v.literal("driver_salary"),
      v.literal("school_fees"),
      v.literal("utilities"),
      v.literal("entertainment"),
      v.literal("clothing"),
      v.literal("grocery"),
      v.literal("shopping"),
      v.literal("personal_care"),
      v.literal("subscription"),
      v.literal("donation"),
      v.literal("emi"),
      v.literal("rent"),
      v.literal("travel"),
      v.literal("tax_payment"),
      v.literal("credit_card_bill"),
      v.literal("recharge"),
      v.literal("household"),
      v.literal("cash_withdrawal"),
      v.literal("transfer"),
      v.literal("other")
    ),
    description: v.string(),
    subcategory: v.optional(v.string()),
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
  }).index("by_user", ["userId"]),

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
  }).index("by_user", ["userId"]),

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
});
