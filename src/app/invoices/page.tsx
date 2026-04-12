/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useMemo, useCallback } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useAuth } from "@/lib/auth-context";
import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { formatCurrency } from "@/lib/utils";
import type { Id } from "../../../convex/_generated/dataModel";
import {
  Plus,
  Search,
  Edit,
  Trash2,
  FileText,
  IndianRupee,
  Clock,
  AlertTriangle,
  CreditCard,
  Building2,
  Users,
  Package,
  Loader2,
  X,
  Eye,
  Upload,
} from "lucide-react";
import { InvoiceViewDialog } from "@/components/invoice/InvoiceViewDialog";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Recursively strip null values (Convex rejects null for optional fields) */
function stripNulls(obj: any): any {
  if (obj === null || obj === undefined) return undefined;
  if (Array.isArray(obj)) return obj.map(stripNulls).filter((v: unknown) => v !== undefined);
  if (typeof obj === "object") {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      const cleaned = stripNulls(v);
      if (cleaned !== undefined) result[k] = cleaned;
    }
    return result;
  }
  return obj;
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface InvoiceItem {
  description: string;
  hsnSac?: string;
  qty: number;
  rate: number;
  gstRate?: number;
}

interface InvoiceFormData {
  id?: Id<"invoices">;
  sellerId: string;
  buyerId: string;
  bankId: string;
  documentType: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  items: InvoiceItem[];
  notes: string;
  tdsEnabled: boolean;
  tdsRate: number;
  tdsSection: string;
  status?: string;
  placeOfSupplyCode?: string;
}

const DOCUMENT_TYPES = [
  { value: "invoice", label: "Tax Invoice" },
  { value: "quotation", label: "Quotation" },
  { value: "proforma", label: "Proforma Invoice" },
  { value: "credit_note", label: "Credit Note" },
  { value: "debit_note", label: "Debit Note" },
  { value: "purchase_order", label: "Purchase Order" },
  { value: "delivery_challan", label: "Delivery Challan" },
];

const GST_RATES = [
  { value: "0", label: "0%" },
  { value: "5", label: "5%" },
  { value: "12", label: "12%" },
  { value: "18", label: "18%" },
  { value: "28", label: "28%" },
];

const STATUS_FILTERS = [
  { value: "all", label: "All" },
  { value: "draft", label: "Draft" },
  { value: "paid", label: "Paid" },
  { value: "partially_paid", label: "Partial" },
  { value: "overdue", label: "Overdue" },
  { value: "cancelled", label: "Cancelled" },
];

const STATUS_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  draft: { bg: "#f3f4f6", text: "#6b7280", border: "#d1d5db" },
  sent: { bg: "#eff6ff", text: "#2563eb", border: "#93c5fd" },
  paid: { bg: "#ecfdf5", text: "#059669", border: "#6ee7b7" },
  partially_paid: { bg: "#fffbeb", text: "#d97706", border: "#fcd34d" },
  overdue: { bg: "#fef2f2", text: "#dc2626", border: "#fca5a5" },
  cancelled: { bg: "#f3f4f6", text: "#9ca3af", border: "#d1d5db" },
};

const EMPTY_ITEM: InvoiceItem = {
  description: "",
  hsnSac: "",
  qty: 1,
  rate: 0,
  gstRate: 18,
};

// ─── GST Calculation ──────────────────────────────────────────────────────────

function calculateGST(
  sellerGstin: string,
  buyerGstin: string,
  items: InvoiceItem[]
) {
  const sellerState = sellerGstin?.substring(0, 2) || "";
  const buyerState = buyerGstin?.substring(0, 2) || "";
  const isInterState = sellerState !== buyerState;

  let totalTaxable = 0;
  let totalGst = 0;

  for (const item of items) {
    const taxable = item.qty * item.rate;
    const gst = (taxable * (item.gstRate || 0)) / 100;
    totalTaxable += taxable;
    totalGst += gst;
  }

  return {
    subtotal: totalTaxable,
    isInterState,
    igst: isInterState ? totalGst : 0,
    cgst: isInterState ? 0 : totalGst / 2,
    sgst: isInterState ? 0 : totalGst / 2,
    gstTotal: totalGst,
  };
}

function getStatusLabel(status: string): string {
  return status === "partially_paid"
    ? "Partial"
    : status.charAt(0).toUpperCase() + status.slice(1);
}

// ═══════════════════════════════════════════════════════════════════════════════
// Main Page Component
// ═══════════════════════════════════════════════════════════════════════════════

export default function InvoicesPage() {
  const { user } = useAuth();
  const userId = user?.userId;

  // ─── Queries ──────────────────────────────────────────────────────────
  const sellers = useQuery(api.invoices.getSellers, userId ? { userId } : "skip") ?? [];
  const buyers = useQuery(api.invoices.getBuyers, userId ? { userId } : "skip") ?? [];
  const banks = useQuery(api.invoices.getBanks, userId ? { userId } : "skip") ?? [];
  const products = useQuery(api.invoices.getProducts, userId ? { userId } : "skip") ?? [];
  const invoices = useQuery(api.invoices.getInvoices, userId ? { userId } : "skip") ?? [];
  const summary = useQuery(api.invoices.getInvoiceSummary, userId ? { userId } : "skip");

  // ─── Mutations ────────────────────────────────────────────────────────
  const saveInvoiceMut = useMutation(api.invoices.saveInvoice);
  const deleteInvoiceMut = useMutation(api.invoices.deleteInvoice);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const updateStatusMut = useMutation(api.invoices.updateInvoiceStatus);
  const commitNumberMut = useMutation(api.invoices.commitInvoiceNumber);
  const addPaymentMut = useMutation(api.invoices.addPayment);

  const addSellerMut = useMutation(api.invoices.addSeller);
  const updateSellerMut = useMutation(api.invoices.updateSeller);
  const deleteSellerMut = useMutation(api.invoices.deleteSeller);

  const addBuyerMut = useMutation(api.invoices.addBuyer);
  const updateBuyerMut = useMutation(api.invoices.updateBuyer);
  const deleteBuyerMut = useMutation(api.invoices.deleteBuyer);

  const addBankMut = useMutation(api.invoices.addBank);
  const deleteBankMut = useMutation(api.invoices.deleteBank);

  const addProductMut = useMutation(api.invoices.addProduct);
  const updateProductMut = useMutation(api.invoices.updateProduct);
  const deleteProductMut = useMutation(api.invoices.deleteProduct);

  // ─── State ────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState("invoices");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showInvoiceDialog, setShowInvoiceDialog] = useState(false);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [viewingInvoice, setViewingInvoice] = useState<any>(null);
  const [uploadingInvoice, setUploadingInvoice] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [showSellerDialog, setShowSellerDialog] = useState(false);
  const [showBuyerDialog, setShowBuyerDialog] = useState(false);
  const [showProductDialog, setShowProductDialog] = useState(false);
  const [showBankDialog, setShowBankDialog] = useState(false);
  const [saving, setSaving] = useState(false);

  // Invoice form
  const [invoiceForm, setInvoiceForm] = useState<InvoiceFormData>({
    sellerId: "",
    buyerId: "",
    bankId: "",
    documentType: "invoice",
    invoiceNumber: "",
    invoiceDate: new Date().toISOString().split("T")[0],
    dueDate: "",
    items: [{ ...EMPTY_ITEM }],
    notes: "",
    tdsEnabled: false,
    tdsRate: 10,
    tdsSection: "194J",
    status: "draft",
  });

  // Payment form
  const [paymentInvoiceId, setPaymentInvoiceId] = useState<Id<"invoices"> | null>(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("bank_transfer");
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split("T")[0]);
  const [paymentNote, setPaymentNote] = useState("");
  const [paymentCreateIncome, setPaymentCreateIncome] = useState(false);
  const [paymentSourceBank, setPaymentSourceBank] = useState("");
  const [paymentLinkIncomeId, setPaymentLinkIncomeId] = useState<string>("");
  const [linkFilterBank, setLinkFilterBank] = useState("");
  const [linkFilterMonth, setLinkFilterMonth] = useState("");
  const [linkFilterMinAmt, setLinkFilterMinAmt] = useState("");

  // Bank accounts + income entries for linking
  const bankAccounts = useQuery(
    api.bankAccounts.getBankAccounts,
    userId ? { userId } : "skip"
  );
  const incomeEntries = useQuery(
    api.income.getIncomeEntries,
    userId ? { userId } : "skip"
  );

  // Seller form
  const [sellerForm, setSellerForm] = useState<any>({ name: "" });
  const [editingSellerId, setEditingSellerId] = useState<Id<"invoice_sellers"> | null>(null);

  // Buyer form
  const [buyerForm, setBuyerForm] = useState<any>({ name: "" });
  const [editingBuyerId, setEditingBuyerId] = useState<Id<"invoice_buyers"> | null>(null);

  // Product form
  const [productForm, setProductForm] = useState<any>({ name: "", rate: 0 });
  const [editingProductId, setEditingProductId] = useState<Id<"invoice_products"> | null>(null);

  // Bank form
  const [bankForm, setBankForm] = useState<any>({ accountName: "", accountNumber: "", bankName: "", ifscCode: "" });

  // ─── Derived ──────────────────────────────────────────────────────────
  const selectedSeller = useMemo(
    () => sellers.find((s: any) => s._id === invoiceForm.sellerId),
    [sellers, invoiceForm.sellerId]
  );
  const selectedBuyer = useMemo(
    () => buyers.find((b: any) => b._id === invoiceForm.buyerId),
    [buyers, invoiceForm.buyerId]
  );

  const gstCalc = useMemo(() => {
    return calculateGST(
      selectedSeller?.gstin || "",
      selectedBuyer?.gstin || "",
      invoiceForm.items
    );
  }, [selectedSeller, selectedBuyer, invoiceForm.items]);

  const tdsAmount = useMemo(() => {
    if (!invoiceForm.tdsEnabled) return 0;
    return (gstCalc.subtotal * invoiceForm.tdsRate) / 100;
  }, [invoiceForm.tdsEnabled, invoiceForm.tdsRate, gstCalc.subtotal]);

  const roundOff = useMemo(() => {
    const raw = gstCalc.subtotal + gstCalc.gstTotal - tdsAmount;
    return Math.round(raw) - raw;
  }, [gstCalc, tdsAmount]);

  const netTotal = useMemo(() => {
    return gstCalc.subtotal + gstCalc.gstTotal - tdsAmount + roundOff;
  }, [gstCalc, tdsAmount, roundOff]);

  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv: any) => {
      if (statusFilter !== "all" && inv.status !== statusFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const buyerName =
          buyers.find((b: any) => b._id === inv.buyerId)?.name || "";
        return (
          inv.invoiceNumber.toLowerCase().includes(q) ||
          buyerName.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [invoices, statusFilter, searchQuery, buyers]);

  // ─── Handlers ─────────────────────────────────────────────────────────

  const openNewInvoice = useCallback(() => {
    setInvoiceForm({
      sellerId: sellers.length === 1 ? (sellers[0] as any)._id : "",
      buyerId: "",
      bankId: banks.length === 1 ? (banks[0] as any)._id : "",
      documentType: "invoice",
      invoiceNumber: "",
      invoiceDate: new Date().toISOString().split("T")[0],
      dueDate: "",
      items: [{ ...EMPTY_ITEM }],
      notes: "",
      tdsEnabled: false,
      tdsRate: 10,
      tdsSection: "194J",
      status: "draft",
    });
    setShowInvoiceDialog(true);
  }, [sellers, banks]);

  const openEditInvoice = useCallback((inv: any) => {
    setInvoiceForm({
      id: inv._id,
      sellerId: inv.sellerId || "",
      buyerId: inv.buyerId || "",
      bankId: inv.bankId || "",
      documentType: inv.documentType || "invoice",
      invoiceNumber: inv.invoiceNumber,
      invoiceDate: inv.invoiceDate,
      dueDate: inv.dueDate || "",
      items: inv.items || [{ ...EMPTY_ITEM }],
      notes: inv.notes || "",
      tdsEnabled: inv.tdsEnabled || false,
      tdsRate: inv.tdsRate || 10,
      tdsSection: inv.tdsSection || "194J",
      status: inv.status,
    });
    setShowInvoiceDialog(true);
  }, []);

  const updateItem = useCallback(
    (index: number, field: keyof InvoiceItem, value: any) => {
      setInvoiceForm((prev) => {
        const items = [...prev.items];
        items[index] = { ...items[index], [field]: value };
        return { ...prev, items };
      });
    },
    []
  );

  const addItem = useCallback(() => {
    setInvoiceForm((prev) => ({
      ...prev,
      items: [...prev.items, { ...EMPTY_ITEM }],
    }));
  }, []);

  const removeItem = useCallback((index: number) => {
    setInvoiceForm((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index),
    }));
  }, []);

  const prefillFromProduct = useCallback(
    (index: number, productId: string) => {
      const product = products.find((p: any) => p._id === productId);
      if (!product) return;
      setInvoiceForm((prev) => {
        const items = [...prev.items];
        items[index] = {
          description: product.name,
          hsnSac: product.hsnSac || "",
          qty: items[index].qty || 1,
          rate: product.rate,
          gstRate: product.gstRate ?? 18,
        };
        return { ...prev, items };
      });
    },
    [products]
  );

  const handleSaveInvoice = useCallback(
    async (status: string) => {
      if (!userId) return;
      setSaving(true);
      try {
        const seller = sellers.find((s: any) => s._id === invoiceForm.sellerId);
        const buyer = buyers.find((b: any) => b._id === invoiceForm.buyerId);
        const bank = banks.find((b: any) => b._id === invoiceForm.bankId);

        let invNum = invoiceForm.invoiceNumber;
        if (!invNum && seller) {
          const prefix = seller.invoicePrefix || "INV";
          await commitNumberMut({
            userId,
            sellerId: seller._id,
          });
          // commitInvoiceNumber returns void; generate based on prefix + timestamp
          invNum = `${prefix}-${String(Date.now()).slice(-6)}`;
        }

        await saveInvoiceMut({
          id: invoiceForm.id as any,
          userId,
          sellerId: invoiceForm.sellerId ? (invoiceForm.sellerId as Id<"invoice_sellers">) : undefined,
          buyerId: invoiceForm.buyerId ? (invoiceForm.buyerId as Id<"invoice_buyers">) : undefined,
          bankId: invoiceForm.bankId ? (invoiceForm.bankId as Id<"invoice_banks">) : undefined,
          documentType: invoiceForm.documentType,
          invoiceNumber: invNum || `INV-${Date.now()}`,
          invoiceDate: invoiceForm.invoiceDate,
          dueDate: invoiceForm.dueDate || undefined,
          items: invoiceForm.items.filter((i) => i.description.trim()),
          subtotal: gstCalc.subtotal,
          gstTotal: gstCalc.gstTotal,
          tdsAmount: tdsAmount || undefined,
          tdsEnabled: invoiceForm.tdsEnabled || undefined,
          tdsRate: invoiceForm.tdsEnabled ? invoiceForm.tdsRate : undefined,
          tdsSection: invoiceForm.tdsEnabled ? invoiceForm.tdsSection : undefined,
          roundOff: roundOff || undefined,
          netTotal,
          status,
          notes: invoiceForm.notes || undefined,
          sellerData: seller ? { name: seller.name, gstin: seller.gstin, address: seller.address, email: seller.email, phone: seller.phone } : undefined,
          buyerData: buyer ? { name: buyer.name, gstin: buyer.gstin, address: buyer.address, email: buyer.email, phone: buyer.phone } : undefined,
          bankData: bank ? { accountName: bank.accountName, accountNumber: bank.accountNumber, bankName: bank.bankName, ifscCode: bank.ifscCode, branch: bank.branch } : undefined,
        });

        setShowInvoiceDialog(false);
      } catch (e) {
        console.error("Failed to save invoice", e);
      } finally {
        setSaving(false);
      }
    },
    [
      userId,
      invoiceForm,
      sellers,
      buyers,
      banks,
      gstCalc,
      tdsAmount,
      roundOff,
      netTotal,
      saveInvoiceMut,
      commitNumberMut,
    ]
  );

  const handleDeleteInvoice = useCallback(
    async (id: Id<"invoices">) => {
      if (!confirm("Delete this invoice? This cannot be undone.")) return;
      await deleteInvoiceMut({ id });
    },
    [deleteInvoiceMut]
  );

  const openPaymentDialog = useCallback((invoiceId: Id<"invoices">) => {
    setPaymentInvoiceId(invoiceId);
    setPaymentAmount("");
    setPaymentMethod("bank_transfer");
    setPaymentDate(new Date().toISOString().split("T")[0]);
    setPaymentNote("");
    setShowPaymentDialog(true);
  }, []);

  const handleAddPayment = useCallback(async () => {
    if (!userId || !paymentInvoiceId || !paymentAmount) return;
    setSaving(true);
    try {
      await addPaymentMut({
        userId,
        invoiceId: paymentInvoiceId,
        amount: parseFloat(paymentAmount),
        method: paymentMethod,
        date: paymentDate,
        note: paymentNote || undefined,
        createIncomeEntry: paymentCreateIncome && !paymentLinkIncomeId,
        sourceBank: paymentSourceBank || undefined,
        linkIncomeId: paymentLinkIncomeId ? (paymentLinkIncomeId as Id<"income_entries">) : undefined,
      });
      setShowPaymentDialog(false);
    } catch (e) {
      console.error("Failed to add payment", e);
    } finally {
      setSaving(false);
    }
  }, [userId, paymentInvoiceId, paymentAmount, paymentMethod, paymentDate, paymentNote, addPaymentMut]);

  // Seller handlers
  const openNewSeller = useCallback(() => {
    setEditingSellerId(null);
    setSellerForm({ name: "", address: "", gstin: "", pan: "", email: "", phone: "", invoicePrefix: "" });
    setShowSellerDialog(true);
  }, []);

  const openEditSeller = useCallback((s: any) => {
    setEditingSellerId(s._id);
    setSellerForm({ name: s.name, address: s.address || "", gstin: s.gstin || "", pan: s.pan || "", email: s.email || "", phone: s.phone || "", invoicePrefix: s.invoicePrefix || "" });
    setShowSellerDialog(true);
  }, []);

  const handleSaveSeller = useCallback(async () => {
    if (!userId || !sellerForm.name) return;
    setSaving(true);
    try {
      if (editingSellerId) {
        await updateSellerMut({ id: editingSellerId, ...sellerForm });
      } else {
        await addSellerMut({ userId, ...sellerForm });
      }
      setShowSellerDialog(false);
    } finally {
      setSaving(false);
    }
  }, [userId, sellerForm, editingSellerId, addSellerMut, updateSellerMut]);

  // Buyer handlers
  const openNewBuyer = useCallback(() => {
    setEditingBuyerId(null);
    setBuyerForm({ name: "", address: "", gstin: "", pan: "", email: "", phone: "", contactPerson: "" });
    setShowBuyerDialog(true);
  }, []);

  const openEditBuyer = useCallback((b: any) => {
    setEditingBuyerId(b._id);
    setBuyerForm({ name: b.name, address: b.address || "", gstin: b.gstin || "", pan: b.pan || "", email: b.email || "", phone: b.phone || "", contactPerson: b.contactPerson || "" });
    setShowBuyerDialog(true);
  }, []);

  const handleSaveBuyer = useCallback(async () => {
    if (!userId || !buyerForm.name) return;
    setSaving(true);
    try {
      if (editingBuyerId) {
        await updateBuyerMut({ id: editingBuyerId, ...buyerForm });
      } else {
        await addBuyerMut({ userId, ...buyerForm });
      }
      setShowBuyerDialog(false);
    } finally {
      setSaving(false);
    }
  }, [userId, buyerForm, editingBuyerId, addBuyerMut, updateBuyerMut]);

  // Product handlers
  const openNewProduct = useCallback(() => {
    setEditingProductId(null);
    setProductForm({ name: "", description: "", hsnSac: "", rate: 0, gstRate: 18 });
    setShowProductDialog(true);
  }, []);

  const openEditProduct = useCallback((p: any) => {
    setEditingProductId(p._id);
    setProductForm({ name: p.name, description: p.description || "", hsnSac: p.hsnSac || "", rate: p.rate, gstRate: p.gstRate ?? 18 });
    setShowProductDialog(true);
  }, []);

  const handleSaveProduct = useCallback(async () => {
    if (!userId || !productForm.name) return;
    setSaving(true);
    try {
      if (editingProductId) {
        await updateProductMut({ id: editingProductId, ...productForm, rate: Number(productForm.rate), gstRate: Number(productForm.gstRate) });
      } else {
        await addProductMut({ userId, ...productForm, rate: Number(productForm.rate), gstRate: Number(productForm.gstRate) });
      }
      setShowProductDialog(false);
    } finally {
      setSaving(false);
    }
  }, [userId, productForm, editingProductId, addProductMut, updateProductMut]);

  // Bank handlers
  const openNewBank = useCallback(() => {
    setBankForm({ accountName: "", accountNumber: "", bankName: "", ifscCode: "", branch: "", sellerId: "" });
    setShowBankDialog(true);
  }, []);

  const handleSaveBank = useCallback(async () => {
    if (!userId || !bankForm.accountName || !bankForm.accountNumber) return;
    setSaving(true);
    try {
      await addBankMut({
        userId,
        accountName: bankForm.accountName,
        accountNumber: bankForm.accountNumber,
        bankName: bankForm.bankName,
        ifscCode: bankForm.ifscCode,
        branch: bankForm.branch || undefined,
        sellerId: bankForm.sellerId ? (bankForm.sellerId as Id<"invoice_sellers">) : undefined,
      });
      setShowBankDialog(false);
    } finally {
      setSaving(false);
    }
  }, [userId, bankForm, addBankMut]);

  // ─── Render ───────────────────────────────────────────────────────────

  if (!userId) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Invoices</h1>
          <p className="text-sm text-gray-500 mt-1">
            Create and manage GST-compliant invoices
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="cursor-pointer">
            <input
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              multiple
              className="hidden"
              onChange={async (e) => {
                const files = e.target.files;
                if (!files || files.length === 0) return;
                setUploadingInvoice(true);
                setUploadError("");
                try {
                  // For single file: open editor with AI data for review
                  // For multiple files: auto-save all
                  const file = files[0];
                  const formData = new FormData();
                  formData.append("file", file);
                  const resp = await fetch("/api/parse-invoice-doc", { method: "POST", body: formData });
                  if (!resp.ok) {
                    const err = await resp.json().catch(() => ({ error: "Parse failed" }));
                    setUploadError(`${file.name}: ${err.error}`);
                  } else {
                    const data = await resp.json();

                    // Auto-create/find seller
                    let sellerId = "";
                    if (data.seller?.name) {
                      const existing = sellers.find((s: any) =>
                        s.name === data.seller.name || (data.seller.gstin && s.gstin === data.seller.gstin)
                      );
                      if (existing) {
                        sellerId = existing._id;
                      } else {
                        sellerId = await addSellerMut(stripNulls({
                          userId: userId!, name: data.seller.name, address: data.seller.address,
                          gstin: data.seller.gstin, pan: data.seller.pan, email: data.seller.email, phone: data.seller.phone,
                        }));
                      }
                    }

                    // Auto-create/find buyer
                    let buyerId = "";
                    if (data.buyer?.name) {
                      const existing = buyers.find((b: any) =>
                        b.name === data.buyer.name || (data.buyer.gstin && b.gstin === data.buyer.gstin)
                      );
                      if (existing) {
                        buyerId = existing._id;
                      } else {
                        buyerId = await addBuyerMut(stripNulls({
                          userId: userId!, name: data.buyer.name, address: data.buyer.address,
                          gstin: data.buyer.gstin, pan: data.buyer.pan, email: data.buyer.email, phone: data.buyer.phone,
                        }));
                      }
                    }

                    // Populate the invoice editor form with AI-extracted data
                    setInvoiceForm({
                      id: undefined,
                      sellerId,
                      buyerId,
                      bankId: "",
                      documentType: data.invoice?.documentType || "invoice",
                      invoiceNumber: data.invoice?.invoiceNumber || "",
                      invoiceDate: data.invoice?.invoiceDate || new Date().toISOString().split("T")[0],
                      dueDate: data.invoice?.dueDate || "",
                      items: (data.items || [{ description: "", hsnSac: "", qty: 1, rate: 0, gstRate: 18 }]).map((item: any) => ({
                        description: item.description || "",
                        hsnSac: item.hsnSac || "",
                        qty: Number(item.qty) || 1,
                        rate: Number(item.rate) || 0,
                        gstRate: Number(item.gstRate) || 18,
                      })),
                      tdsEnabled: (data.totals?.tdsAmount || 0) > 0,
                      tdsRate: Number(data.totals?.tdsRate) || 10,
                      tdsSection: "194J",
                      notes: data.notes || "",
                      placeOfSupplyCode: data.invoice?.placeOfSupplyCode || "",
                    });
                    setShowInvoiceDialog(true);
                  }
                } catch (err) {
                  setUploadError(err instanceof Error ? err.message : "Upload failed");
                } finally {
                  setUploadingInvoice(false);
                  e.target.value = "";
                }
              }}
            />
            <span className={`inline-flex items-center gap-2 h-10 px-5 rounded-lg border border-gray-200 text-sm font-medium transition-colors cursor-pointer ${
              uploadingInvoice ? "opacity-50 cursor-wait" : "hover:bg-gray-50"
            }`}>
              {uploadingInvoice ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              <span className="hidden sm:inline">{uploadingInvoice ? "Scanning..." : "Upload Invoice"}</span>
            </span>
          </label>
          <Button onClick={openNewInvoice} className="bg-indigo-600 hover:bg-indigo-700">
            <Plus className="h-4 w-4 mr-2" />
            New Invoice
          </Button>
        </div>
      </div>

      {/* Upload Error/Success */}
      {uploadError && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600 flex items-center justify-between">
          <span className="whitespace-pre-line">{uploadError}</span>
          <button onClick={() => setUploadError("")} className="p-1 hover:bg-rose-100 rounded"><X className="h-4 w-4" /></button>
        </div>
      )}

      {/* KPI Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        <KpiCard
          title="Total Invoiced"
          value={formatCurrency(summary?.totalInvoiced ?? 0)}
          subtitle={`${summary?.invoiceCount ?? 0} invoices`}
          icon={<FileText className="h-5 w-5" />}
          color="blue"
        />
        <KpiCard
          title="Paid"
          value={formatCurrency(summary?.totalPaid ?? 0)}
          subtitle={`${summary?.paidCount ?? 0} paid`}
          icon={<IndianRupee className="h-5 w-5" />}
          color="emerald"
        />
        <KpiCard
          title="Outstanding"
          value={formatCurrency(summary?.totalOutstanding ?? 0)}
          subtitle="Awaiting payment"
          icon={<Clock className="h-5 w-5" />}
          color="amber"
        />
        <KpiCard
          title="Overdue"
          value={formatCurrency(summary?.totalOverdue ?? 0)}
          subtitle={`${summary?.overdueCount ?? 0} overdue`}
          icon={<AlertTriangle className="h-5 w-5" />}
          color="rose"
        />
        <KpiCard
          title="GST Collected"
          value={formatCurrency(summary?.gstCollected ?? 0)}
          subtitle={`${formatCurrency(summary?.gstPending ?? 0)} pending`}
          icon={<FileText className="h-5 w-5" />}
          color="purple"
        />
        <KpiCard
          title="TDS Deducted"
          value={formatCurrency(summary?.tdsDeducted ?? 0)}
          subtitle={`${formatCurrency(summary?.tdsPending ?? 0)} pending`}
          icon={<FileText className="h-5 w-5" />}
          color="indigo"
        />
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="invoices">
            <FileText className="h-4 w-4 mr-1.5" />
            Invoices
          </TabsTrigger>
          <TabsTrigger value="sellers">
            <Building2 className="h-4 w-4 mr-1.5" />
            Sellers
          </TabsTrigger>
          <TabsTrigger value="buyers">
            <Users className="h-4 w-4 mr-1.5" />
            Buyers
          </TabsTrigger>
          <TabsTrigger value="products">
            <Package className="h-4 w-4 mr-1.5" />
            Products
          </TabsTrigger>
        </TabsList>

        {/* ═══ Invoices Tab ═══ */}
        <TabsContent value="invoices">
          <Card>
            <CardContent className="pt-6">
              {/* Search + Filter */}
              <div className="flex flex-col sm:flex-row gap-3 mb-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search invoices..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Select
                  options={STATUS_FILTERS}
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-40"
                />
              </div>

              {/* Table */}
              {filteredInvoices.length === 0 ? (
                <div className="text-center py-16">
                  <FileText className="h-12 w-12 mx-auto text-gray-300 mb-3" />
                  <p className="text-gray-500 font-medium">No invoices yet</p>
                  <p className="text-gray-400 text-sm mt-1">
                    Create your first invoice to get started
                  </p>
                  <Button
                    onClick={openNewInvoice}
                    variant="outline"
                    className="mt-4 border-indigo-200 text-indigo-600 hover:bg-indigo-50"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Create Invoice
                  </Button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="text-left py-3 px-3 text-gray-500 font-medium">Invoice #</th>
                        <th className="text-left py-3 px-3 text-gray-500 font-medium">Date</th>
                        <th className="text-left py-3 px-3 text-gray-500 font-medium">Customer</th>
                        <th className="text-right py-3 px-3 text-gray-500 font-medium">Amount</th>
                        <th className="text-center py-3 px-3 text-gray-500 font-medium">Status</th>
                        <th className="text-right py-3 px-3 text-gray-500 font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredInvoices.map((inv: any) => {
                        const buyer = buyers.find((b: any) => b._id === inv.buyerId);
                        const sc = STATUS_COLORS[inv.status] || STATUS_COLORS.draft;
                        return (
                          <tr
                            key={inv._id}
                            className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors"
                          >
                            <td className="py-3 px-3 font-mono text-indigo-600 font-medium">
                              {inv.invoiceNumber}
                            </td>
                            <td className="py-3 px-3 text-gray-600">
                              {new Date(inv.invoiceDate).toLocaleDateString("en-IN", {
                                day: "2-digit",
                                month: "short",
                                year: "numeric",
                              })}
                            </td>
                            <td className="py-3 px-3 text-gray-800">
                              {buyer?.name || inv.buyerData?.name || "—"}
                            </td>
                            <td className="py-3 px-3 text-right font-mono font-medium text-gray-900">
                              {formatCurrency(inv.netTotal)}
                            </td>
                            <td className="py-3 px-3 text-center">
                              <span
                                className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold"
                                style={{
                                  backgroundColor: sc.bg,
                                  color: sc.text,
                                  border: `1px solid ${sc.border}`,
                                }}
                              >
                                {getStatusLabel(inv.status)}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-right">
                              <div className="flex items-center justify-end gap-1">
                                {inv.status !== "paid" && inv.status !== "cancelled" && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => openPaymentDialog(inv._id)}
                                    title="Record payment"
                                    className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                                  >
                                    <CreditCard className="h-3.5 w-3.5" />
                                  </Button>
                                )}
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setViewingInvoice(inv)}
                                  title="View Invoice"
                                  className="text-indigo-500 hover:text-indigo-700"
                                >
                                  <Eye className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => openEditInvoice(inv)}
                                  title="Edit"
                                  className="text-gray-500 hover:text-indigo-600"
                                >
                                  <Edit className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDeleteInvoice(inv._id)}
                                  title="Delete"
                                  className="text-gray-400 hover:text-rose-600"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══ Sellers Tab ═══ */}
        <TabsContent value="sellers">
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle className="text-base">Seller Profiles</CardTitle>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={openNewBank} className="border-indigo-200 text-indigo-600 hover:bg-indigo-50">
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Bank Account
                </Button>
                <Button size="sm" onClick={openNewSeller} className="bg-indigo-600 hover:bg-indigo-700">
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Add Seller
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {sellers.length === 0 ? (
                <EmptyState
                  icon={<Building2 className="h-10 w-10" />}
                  title="No sellers yet"
                  description="Add your business details to start invoicing"
                  action={
                    <Button variant="outline" size="sm" onClick={openNewSeller} className="border-indigo-200 text-indigo-600">
                      <Plus className="h-4 w-4 mr-1" /> Add Seller
                    </Button>
                  }
                />
              ) : (
                <div className="space-y-3">
                  {sellers.map((s: any) => {
                    const sellerBanks = banks.filter((b: any) => b.sellerId === s._id);
                    return (
                      <div
                        key={s._id}
                        className="flex items-start justify-between p-4 rounded-lg border border-gray-100 hover:border-indigo-100 hover:bg-indigo-50/30 transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-gray-900">{s.name}</p>
                          {s.gstin && (
                            <p className="text-xs text-gray-500 mt-0.5 font-mono">
                              GSTIN: {s.gstin}
                            </p>
                          )}
                          {s.email && (
                            <p className="text-xs text-gray-400 mt-0.5">{s.email}</p>
                          )}
                          {s.invoicePrefix && (
                            <Badge variant="secondary" className="mt-1 text-xs">
                              Prefix: {s.invoicePrefix}
                            </Badge>
                          )}
                          {sellerBanks.length > 0 && (
                            <div className="mt-2 space-y-1">
                              {sellerBanks.map((b: any) => (
                                <div key={b._id} className="flex items-center gap-2 text-xs text-gray-500">
                                  <CreditCard className="h-3 w-3" />
                                  <span>{b.bankName} - {b.accountNumber}</span>
                                  <button
                                    onClick={() => deleteBankMut({ id: b._id })}
                                    className="text-gray-300 hover:text-rose-500 ml-1"
                                  >
                                    <X className="h-3 w-3" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="flex gap-1 ml-3">
                          <Button variant="ghost" size="sm" onClick={() => openEditSeller(s)}>
                            <Edit className="h-3.5 w-3.5 text-gray-400" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              if (confirm("Delete this seller?"))
                                deleteSellerMut({ id: s._id });
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5 text-gray-400 hover:text-rose-500" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══ Buyers Tab ═══ */}
        <TabsContent value="buyers">
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle className="text-base">Customer Directory</CardTitle>
              <Button size="sm" onClick={openNewBuyer} className="bg-indigo-600 hover:bg-indigo-700">
                <Plus className="h-3.5 w-3.5 mr-1" />
                Add Customer
              </Button>
            </CardHeader>
            <CardContent>
              {buyers.length === 0 ? (
                <EmptyState
                  icon={<Users className="h-10 w-10" />}
                  title="No customers yet"
                  description="Add your customers to quickly create invoices"
                  action={
                    <Button variant="outline" size="sm" onClick={openNewBuyer} className="border-indigo-200 text-indigo-600">
                      <Plus className="h-4 w-4 mr-1" /> Add Customer
                    </Button>
                  }
                />
              ) : (
                <div className="space-y-3">
                  {buyers.map((b: any) => (
                    <div
                      key={b._id}
                      className="flex items-start justify-between p-4 rounded-lg border border-gray-100 hover:border-indigo-100 hover:bg-indigo-50/30 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900">{b.name}</p>
                        {b.gstin && (
                          <p className="text-xs text-gray-500 mt-0.5 font-mono">
                            GSTIN: {b.gstin}
                          </p>
                        )}
                        <div className="flex gap-3 mt-0.5">
                          {b.email && <p className="text-xs text-gray-400">{b.email}</p>}
                          {b.phone && <p className="text-xs text-gray-400">{b.phone}</p>}
                        </div>
                        {b.contactPerson && (
                          <p className="text-xs text-gray-400 mt-0.5">
                            Contact: {b.contactPerson}
                          </p>
                        )}
                      </div>
                      <div className="flex gap-1 ml-3">
                        <Button variant="ghost" size="sm" onClick={() => openEditBuyer(b)}>
                          <Edit className="h-3.5 w-3.5 text-gray-400" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            if (confirm("Delete this customer?"))
                              deleteBuyerMut({ id: b._id });
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5 text-gray-400 hover:text-rose-500" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══ Products Tab ═══ */}
        <TabsContent value="products">
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle className="text-base">Item Catalog</CardTitle>
              <Button size="sm" onClick={openNewProduct} className="bg-indigo-600 hover:bg-indigo-700">
                <Plus className="h-3.5 w-3.5 mr-1" />
                Add Item
              </Button>
            </CardHeader>
            <CardContent>
              {products.length === 0 ? (
                <EmptyState
                  icon={<Package className="h-10 w-10" />}
                  title="No items yet"
                  description="Add products or services for quick invoice line items"
                  action={
                    <Button variant="outline" size="sm" onClick={openNewProduct} className="border-indigo-200 text-indigo-600">
                      <Plus className="h-4 w-4 mr-1" /> Add Item
                    </Button>
                  }
                />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="text-left py-2.5 px-3 text-gray-500 font-medium">Name</th>
                        <th className="text-left py-2.5 px-3 text-gray-500 font-medium">HSN/SAC</th>
                        <th className="text-right py-2.5 px-3 text-gray-500 font-medium">Rate</th>
                        <th className="text-right py-2.5 px-3 text-gray-500 font-medium">GST</th>
                        <th className="text-right py-2.5 px-3 text-gray-500 font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {products.map((p: any) => (
                        <tr key={p._id} className="border-b border-gray-50 hover:bg-gray-50/50">
                          <td className="py-2.5 px-3 text-gray-900 font-medium">{p.name}</td>
                          <td className="py-2.5 px-3 text-gray-500 font-mono text-xs">
                            {p.hsnSac || "—"}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono">
                            {formatCurrency(p.rate)}
                          </td>
                          <td className="py-2.5 px-3 text-right text-gray-600">
                            {p.gstRate ?? 0}%
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button variant="ghost" size="sm" onClick={() => openEditProduct(p)}>
                                <Edit className="h-3.5 w-3.5 text-gray-400" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  if (confirm("Delete this item?"))
                                    deleteProductMut({ id: p._id });
                                }}
                              >
                                <Trash2 className="h-3.5 w-3.5 text-gray-400 hover:text-rose-500" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* Invoice Dialog                                                     */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <Dialog open={showInvoiceDialog} onOpenChange={setShowInvoiceDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {invoiceForm.id ? "Edit Invoice" : "New Invoice"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            {/* Row 1: Seller + Buyer */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>Seller / Business</Label>
                <Select
                  options={sellers.map((s: any) => ({
                    value: s._id,
                    label: s.name,
                  }))}
                  placeholder="Select seller..."
                  value={invoiceForm.sellerId}
                  onChange={(e) =>
                    setInvoiceForm((f) => ({ ...f, sellerId: e.target.value }))
                  }
                />
              </div>
              <div>
                <Label>Customer / Buyer</Label>
                <Select
                  options={buyers.map((b: any) => ({
                    value: b._id,
                    label: b.name,
                  }))}
                  placeholder="Select customer..."
                  value={invoiceForm.buyerId}
                  onChange={(e) =>
                    setInvoiceForm((f) => ({ ...f, buyerId: e.target.value }))
                  }
                />
              </div>
            </div>

            {/* Row 2: Doc type, Invoice #, Dates */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <Label>Document Type</Label>
                <Select
                  options={DOCUMENT_TYPES}
                  value={invoiceForm.documentType}
                  onChange={(e) =>
                    setInvoiceForm((f) => ({ ...f, documentType: e.target.value }))
                  }
                />
              </div>
              <div>
                <Label>Invoice Number</Label>
                <Input
                  placeholder="Auto-generated"
                  value={invoiceForm.invoiceNumber}
                  onChange={(e) =>
                    setInvoiceForm((f) => ({
                      ...f,
                      invoiceNumber: e.target.value,
                    }))
                  }
                />
              </div>
              <div>
                <Label>Invoice Date</Label>
                <Input
                  type="date"
                  value={invoiceForm.invoiceDate}
                  onChange={(e) =>
                    setInvoiceForm((f) => ({
                      ...f,
                      invoiceDate: e.target.value,
                    }))
                  }
                />
              </div>
              <div>
                <Label>Due Date</Label>
                <Input
                  type="date"
                  value={invoiceForm.dueDate}
                  onChange={(e) =>
                    setInvoiceForm((f) => ({ ...f, dueDate: e.target.value }))
                  }
                />
              </div>
            </div>

            {/* GST State Info */}
            {selectedSeller?.gstin && selectedBuyer?.gstin && (
              <div className="flex items-center gap-2 text-xs">
                <Badge
                  variant={gstCalc.isInterState ? "warning" : "success"}
                  className="text-xs"
                >
                  {gstCalc.isInterState ? "Inter-State (IGST)" : "Intra-State (CGST + SGST)"}
                </Badge>
                <span className="text-gray-400">
                  Seller: {selectedSeller.gstin.substring(0, 2)} | Buyer:{" "}
                  {selectedBuyer.gstin.substring(0, 2)}
                </span>
              </div>
            )}

            {/* Items Table */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-sm font-semibold">Line Items</Label>
                {products.length > 0 && (
                  <span className="text-xs text-gray-400">
                    Select a product to auto-fill
                  </span>
                )}
              </div>
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left py-2 px-3 text-gray-500 font-medium text-xs w-[30%]">
                        Description
                      </th>
                      <th className="text-left py-2 px-3 text-gray-500 font-medium text-xs w-[12%]">
                        HSN/SAC
                      </th>
                      <th className="text-right py-2 px-3 text-gray-500 font-medium text-xs w-[10%]">
                        Qty
                      </th>
                      <th className="text-right py-2 px-3 text-gray-500 font-medium text-xs w-[15%]">
                        Rate
                      </th>
                      <th className="text-right py-2 px-3 text-gray-500 font-medium text-xs w-[10%]">
                        GST %
                      </th>
                      <th className="text-right py-2 px-3 text-gray-500 font-medium text-xs w-[15%]">
                        Amount
                      </th>
                      <th className="w-[8%]"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoiceForm.items.map((item, idx) => {
                      const lineAmount = item.qty * item.rate;
                      return (
                        <tr key={idx} className="border-t border-gray-100">
                          <td className="py-1.5 px-2">
                            {products.length > 0 ? (
                              <div className="space-y-1">
                                <select
                                  className="w-full text-xs border border-gray-200 rounded px-2 py-1 bg-white text-gray-600"
                                  value=""
                                  onChange={(e) => {
                                    if (e.target.value)
                                      prefillFromProduct(idx, e.target.value);
                                  }}
                                >
                                  <option value="">Pick product...</option>
                                  {products.map((p: any) => (
                                    <option key={p._id} value={p._id}>
                                      {p.name}
                                    </option>
                                  ))}
                                </select>
                                <Input
                                  className="h-8 text-xs"
                                  placeholder="Or type description"
                                  value={item.description}
                                  onChange={(e) =>
                                    updateItem(idx, "description", e.target.value)
                                  }
                                />
                              </div>
                            ) : (
                              <Input
                                className="h-8 text-xs"
                                placeholder="Description"
                                value={item.description}
                                onChange={(e) =>
                                  updateItem(idx, "description", e.target.value)
                                }
                              />
                            )}
                          </td>
                          <td className="py-1.5 px-2">
                            <Input
                              className="h-8 text-xs"
                              placeholder="HSN"
                              value={item.hsnSac || ""}
                              onChange={(e) =>
                                updateItem(idx, "hsnSac", e.target.value)
                              }
                            />
                          </td>
                          <td className="py-1.5 px-2">
                            <Input
                              type="number"
                              className="h-8 text-xs text-right"
                              value={item.qty}
                              min={1}
                              onChange={(e) =>
                                updateItem(idx, "qty", Number(e.target.value) || 0)
                              }
                            />
                          </td>
                          <td className="py-1.5 px-2">
                            <Input
                              type="number"
                              className="h-8 text-xs text-right"
                              value={item.rate}
                              min={0}
                              onChange={(e) =>
                                updateItem(idx, "rate", Number(e.target.value) || 0)
                              }
                            />
                          </td>
                          <td className="py-1.5 px-2">
                            <select
                              className="w-full h-8 text-xs border border-gray-200 rounded px-1 bg-white text-right"
                              value={String(item.gstRate ?? 18)}
                              onChange={(e) =>
                                updateItem(
                                  idx,
                                  "gstRate",
                                  Number(e.target.value)
                                )
                              }
                            >
                              {GST_RATES.map((r) => (
                                <option key={r.value} value={r.value}>
                                  {r.label}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="py-1.5 px-2 text-right font-mono text-xs text-gray-700">
                            {formatCurrency(lineAmount)}
                          </td>
                          <td className="py-1.5 px-1">
                            {invoiceForm.items.length > 1 && (
                              <button
                                onClick={() => removeItem(idx)}
                                className="p-1 rounded text-gray-300 hover:text-rose-500 hover:bg-rose-50 transition-colors"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={addItem}
                className="mt-2 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50"
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                Add Item
              </Button>
            </div>

            {/* Totals */}
            <div className="flex justify-end">
              <div className="w-72 space-y-2 text-sm">
                <div className="flex justify-between text-gray-600">
                  <span>Subtotal</span>
                  <span className="font-mono">{formatCurrency(gstCalc.subtotal)}</span>
                </div>
                {gstCalc.isInterState ? (
                  <div className="flex justify-between text-gray-600">
                    <span>IGST</span>
                    <span className="font-mono">{formatCurrency(gstCalc.igst)}</span>
                  </div>
                ) : (
                  <>
                    <div className="flex justify-between text-gray-600">
                      <span>CGST</span>
                      <span className="font-mono">{formatCurrency(gstCalc.cgst)}</span>
                    </div>
                    <div className="flex justify-between text-gray-600">
                      <span>SGST</span>
                      <span className="font-mono">{formatCurrency(gstCalc.sgst)}</span>
                    </div>
                  </>
                )}

                {/* TDS Toggle */}
                <div className="border-t border-gray-100 pt-2">
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 text-gray-600 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={invoiceForm.tdsEnabled}
                        onChange={(e) =>
                          setInvoiceForm((f) => ({
                            ...f,
                            tdsEnabled: e.target.checked,
                          }))
                        }
                        className="rounded border-gray-300"
                      />
                      <span>TDS Deduction</span>
                    </label>
                    {invoiceForm.tdsEnabled && (
                      <span className="font-mono text-rose-600">
                        -{formatCurrency(tdsAmount)}
                      </span>
                    )}
                  </div>
                  {invoiceForm.tdsEnabled && (
                    <div className="flex gap-2 mt-1.5">
                      <Input
                        type="number"
                        className="h-7 text-xs w-20"
                        value={invoiceForm.tdsRate}
                        min={0}
                        max={100}
                        onChange={(e) =>
                          setInvoiceForm((f) => ({
                            ...f,
                            tdsRate: Number(e.target.value) || 0,
                          }))
                        }
                      />
                      <span className="text-xs text-gray-400 self-center">%</span>
                      <Input
                        className="h-7 text-xs flex-1"
                        placeholder="Section (e.g. 194J)"
                        value={invoiceForm.tdsSection}
                        onChange={(e) =>
                          setInvoiceForm((f) => ({
                            ...f,
                            tdsSection: e.target.value,
                          }))
                        }
                      />
                    </div>
                  )}
                </div>

                {roundOff !== 0 && (
                  <div className="flex justify-between text-gray-400 text-xs">
                    <span>Round off</span>
                    <span className="font-mono">
                      {roundOff > 0 ? "+" : ""}
                      {roundOff.toFixed(2)}
                    </span>
                  </div>
                )}

                <div className="flex justify-between border-t border-gray-200 pt-2 text-base font-bold text-gray-900">
                  <span>Net Total</span>
                  <span className="font-mono text-indigo-600">
                    {formatCurrency(netTotal)}
                  </span>
                </div>
              </div>
            </div>

            {/* Bank + Notes */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>Bank Account</Label>
                <Select
                  options={banks.map((b: any) => ({
                    value: b._id,
                    label: `${b.bankName} - ${b.accountNumber}`,
                  }))}
                  placeholder="Select bank account..."
                  value={invoiceForm.bankId}
                  onChange={(e) =>
                    setInvoiceForm((f) => ({ ...f, bankId: e.target.value }))
                  }
                />
              </div>
              <div>
                <Label>Notes / Terms</Label>
                <textarea
                  className="flex w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 transition-colors resize-none h-[72px]"
                  placeholder="Payment terms, notes..."
                  value={invoiceForm.notes}
                  onChange={(e) =>
                    setInvoiceForm((f) => ({ ...f, notes: e.target.value }))
                  }
                />
              </div>
            </div>
          </div>

          <DialogFooter className="mt-4 gap-2">
            <Button
              variant="secondary"
              onClick={() => setShowInvoiceDialog(false)}
            >
              Cancel
            </Button>
            <Button
              variant="outline"
              onClick={() => handleSaveInvoice("draft")}
              disabled={saving}
              className="border-indigo-200 text-indigo-600 hover:bg-indigo-50"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Save as Draft
            </Button>
            <Button
              onClick={() => handleSaveInvoice("draft")}
              disabled={saving}
              className="bg-indigo-600 hover:bg-indigo-700"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Save Invoice
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* Payment Dialog                                                     */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Amount</Label>
              <Input
                type="number"
                placeholder="0.00"
                value={paymentAmount}
                min={0}
                onChange={(e) => setPaymentAmount(e.target.value)}
              />
            </div>
            <div>
              <Label>Method</Label>
              <Select
                options={[
                  { value: "cash", label: "Cash" },
                  { value: "bank_transfer", label: "Bank Transfer" },
                  { value: "upi", label: "UPI" },
                  { value: "cheque", label: "Cheque" },
                ]}
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
              />
            </div>
            <div>
              <Label>Date</Label>
              <Input
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
              />
            </div>
            <div>
              <Label>Note (optional)</Label>
              <Input
                placeholder="Reference number, details..."
                value={paymentNote}
                onChange={(e) => setPaymentNote(e.target.value)}
              />
            </div>

            {/* Link to Income Tracker */}
            <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-3 space-y-3">
              <p className="text-xs font-semibold text-emerald-700">Link to Income Tracker</p>

              {/* Option 1: Link to existing income entry with filters */}
              <div>
                <Label className="text-xs text-emerald-600 mb-1.5 block">Link to Existing Income Entry</Label>
                <div className="grid grid-cols-3 gap-2 mb-2">
                  <select
                    value={linkFilterBank}
                    onChange={(e) => setLinkFilterBank(e.target.value)}
                    className="text-[11px] rounded-lg border border-gray-200 px-2 py-1.5 bg-white focus:border-emerald-400 focus:outline-none cursor-pointer"
                  >
                    <option value="">All Banks</option>
                    {(bankAccounts ?? []).filter((b: any) => b.is_active).map((bank: any) => (
                      <option key={bank._id} value={bank.bank_name}>{bank.display_name || bank.bank_name}</option>
                    ))}
                  </select>
                  <select
                    value={linkFilterMonth}
                    onChange={(e) => setLinkFilterMonth(e.target.value)}
                    className="text-[11px] rounded-lg border border-gray-200 px-2 py-1.5 bg-white focus:border-emerald-400 focus:outline-none cursor-pointer"
                  >
                    <option value="">All Months</option>
                    {Array.from(new Set((incomeEntries ?? []).map((e: any) => e.date.substring(0, 7)))).sort().reverse().map((m) => (
                      <option key={m} value={m}>{new Date(m + "-01").toLocaleDateString("en-IN", { month: "short", year: "numeric" })}</option>
                    ))}
                  </select>
                  <Input
                    type="number"
                    placeholder="Min ₹"
                    value={linkFilterMinAmt}
                    onChange={(e) => setLinkFilterMinAmt(e.target.value)}
                    className="text-[11px] h-auto py-1.5"
                  />
                </div>
                {(() => {
                  const filtered = (incomeEntries ?? []).filter((e: any) => {
                    if (linkFilterBank && (e.source_bank || "") !== linkFilterBank) {
                      // Also check description for bank name
                      const desc = (e.description || "").toLowerCase();
                      if (!desc.includes(linkFilterBank.toLowerCase())) return false;
                    }
                    if (linkFilterMonth && !e.date.startsWith(linkFilterMonth)) return false;
                    if (linkFilterMinAmt && e.amount < Number(linkFilterMinAmt)) return false;
                    return true;
                  }).sort((a: any, b: any) => b.date.localeCompare(a.date)).slice(0, 15);

                  return filtered.length > 0 ? (
                    <select
                      value={paymentLinkIncomeId}
                      onChange={(e) => { setPaymentLinkIncomeId(e.target.value); if (e.target.value) setPaymentCreateIncome(false); }}
                      className="w-full text-[11px] rounded-lg border border-emerald-200 px-3 py-2 bg-white focus:border-emerald-400 focus:outline-none cursor-pointer"
                      size={Math.min(filtered.length + 1, 8)}
                    >
                      <option value="">— Select income entry ({filtered.length} shown) —</option>
                      {filtered.map((e: any) => (
                        <option key={e._id} value={e._id}>
                          {new Date(e.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "2-digit" })} — {formatCurrency(e.amount)} — {e.description?.substring(0, 45)}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <p className="text-[10px] text-text-tertiary">No entries match the filters. Try adjusting bank, month, or amount.</p>
                  );
                })()}
              </div>

              {/* Option 2: Create new income entry */}
              {!paymentLinkIncomeId && (
                <div className="border-t border-emerald-200 pt-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={paymentCreateIncome}
                      onChange={(e) => setPaymentCreateIncome(e.target.checked)}
                      className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-400/20"
                      id="create-income"
                    />
                    <label htmlFor="create-income" className="text-xs font-medium text-emerald-600 cursor-pointer">
                      Or create a NEW income entry
                    </label>
                  </div>
                  {paymentCreateIncome && (
                    <select
                      value={paymentSourceBank}
                      onChange={(e) => setPaymentSourceBank(e.target.value)}
                      className="w-full text-xs rounded-lg border border-emerald-200 px-3 py-2 bg-white focus:border-emerald-400 focus:outline-none cursor-pointer mt-1"
                    >
                      <option value="">Select bank account...</option>
                      {(bankAccounts ?? []).filter((b: any) => b.is_active).map((bank: any) => (
                        <option key={bank._id} value={bank.bank_name}>
                          {bank.display_name || bank.bank_name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button variant="secondary" onClick={() => setShowPaymentDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleAddPayment}
              disabled={saving || !paymentAmount}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Record Payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* Seller Dialog                                                      */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <Dialog open={showSellerDialog} onOpenChange={setShowSellerDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingSellerId ? "Edit Seller" : "Add Seller"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Business Name *</Label>
              <Input
                value={sellerForm.name}
                onChange={(e) =>
                  setSellerForm((f: any) => ({ ...f, name: e.target.value }))
                }
                placeholder="Your business name"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>GSTIN</Label>
                <Input
                  value={sellerForm.gstin}
                  onChange={(e) =>
                    setSellerForm((f: any) => ({ ...f, gstin: e.target.value }))
                  }
                  placeholder="22AAAAA0000A1Z5"
                />
              </div>
              <div>
                <Label>PAN</Label>
                <Input
                  value={sellerForm.pan}
                  onChange={(e) =>
                    setSellerForm((f: any) => ({ ...f, pan: e.target.value }))
                  }
                  placeholder="AAAAA0000A"
                />
              </div>
            </div>
            <div>
              <Label>Address</Label>
              <textarea
                className="flex w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm resize-none h-16 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                value={sellerForm.address}
                onChange={(e) =>
                  setSellerForm((f: any) => ({ ...f, address: e.target.value }))
                }
                placeholder="Full business address"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Email</Label>
                <Input
                  type="email"
                  value={sellerForm.email}
                  onChange={(e) =>
                    setSellerForm((f: any) => ({ ...f, email: e.target.value }))
                  }
                  placeholder="billing@example.com"
                />
              </div>
              <div>
                <Label>Phone</Label>
                <Input
                  value={sellerForm.phone}
                  onChange={(e) =>
                    setSellerForm((f: any) => ({ ...f, phone: e.target.value }))
                  }
                  placeholder="+91 98765 43210"
                />
              </div>
            </div>
            <div>
              <Label>Invoice Prefix</Label>
              <Input
                value={sellerForm.invoicePrefix}
                onChange={(e) =>
                  setSellerForm((f: any) => ({
                    ...f,
                    invoicePrefix: e.target.value,
                  }))
                }
                placeholder="INV"
                className="w-32"
              />
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button variant="secondary" onClick={() => setShowSellerDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveSeller}
              disabled={saving || !sellerForm.name}
              className="bg-indigo-600 hover:bg-indigo-700"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {editingSellerId ? "Update" : "Add Seller"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* Buyer Dialog                                                       */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <Dialog open={showBuyerDialog} onOpenChange={setShowBuyerDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingBuyerId ? "Edit Customer" : "Add Customer"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Customer Name *</Label>
              <Input
                value={buyerForm.name}
                onChange={(e) =>
                  setBuyerForm((f: any) => ({ ...f, name: e.target.value }))
                }
                placeholder="Customer / Company name"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>GSTIN</Label>
                <Input
                  value={buyerForm.gstin}
                  onChange={(e) =>
                    setBuyerForm((f: any) => ({ ...f, gstin: e.target.value }))
                  }
                  placeholder="22AAAAA0000A1Z5"
                />
              </div>
              <div>
                <Label>PAN</Label>
                <Input
                  value={buyerForm.pan}
                  onChange={(e) =>
                    setBuyerForm((f: any) => ({ ...f, pan: e.target.value }))
                  }
                  placeholder="AAAAA0000A"
                />
              </div>
            </div>
            <div>
              <Label>Address</Label>
              <textarea
                className="flex w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm resize-none h-16 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                value={buyerForm.address}
                onChange={(e) =>
                  setBuyerForm((f: any) => ({ ...f, address: e.target.value }))
                }
                placeholder="Customer address"
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Email</Label>
                <Input
                  type="email"
                  value={buyerForm.email}
                  onChange={(e) =>
                    setBuyerForm((f: any) => ({ ...f, email: e.target.value }))
                  }
                />
              </div>
              <div>
                <Label>Phone</Label>
                <Input
                  value={buyerForm.phone}
                  onChange={(e) =>
                    setBuyerForm((f: any) => ({ ...f, phone: e.target.value }))
                  }
                />
              </div>
              <div>
                <Label>Contact Person</Label>
                <Input
                  value={buyerForm.contactPerson}
                  onChange={(e) =>
                    setBuyerForm((f: any) => ({
                      ...f,
                      contactPerson: e.target.value,
                    }))
                  }
                />
              </div>
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button variant="secondary" onClick={() => setShowBuyerDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveBuyer}
              disabled={saving || !buyerForm.name}
              className="bg-indigo-600 hover:bg-indigo-700"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {editingBuyerId ? "Update" : "Add Customer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* Product Dialog                                                     */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <Dialog open={showProductDialog} onOpenChange={setShowProductDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingProductId ? "Edit Item" : "Add Item"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Item Name *</Label>
              <Input
                value={productForm.name}
                onChange={(e) =>
                  setProductForm((f: any) => ({ ...f, name: e.target.value }))
                }
                placeholder="Product or service name"
              />
            </div>
            <div>
              <Label>Description</Label>
              <Input
                value={productForm.description}
                onChange={(e) =>
                  setProductForm((f: any) => ({
                    ...f,
                    description: e.target.value,
                  }))
                }
                placeholder="Brief description"
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>HSN/SAC</Label>
                <Input
                  value={productForm.hsnSac}
                  onChange={(e) =>
                    setProductForm((f: any) => ({
                      ...f,
                      hsnSac: e.target.value,
                    }))
                  }
                  placeholder="998314"
                />
              </div>
              <div>
                <Label>Rate</Label>
                <Input
                  type="number"
                  value={productForm.rate}
                  min={0}
                  onChange={(e) =>
                    setProductForm((f: any) => ({
                      ...f,
                      rate: e.target.value,
                    }))
                  }
                />
              </div>
              <div>
                <Label>GST Rate (%)</Label>
                <Select
                  options={GST_RATES}
                  value={String(productForm.gstRate ?? 18)}
                  onChange={(e) =>
                    setProductForm((f: any) => ({
                      ...f,
                      gstRate: Number(e.target.value),
                    }))
                  }
                />
              </div>
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button
              variant="secondary"
              onClick={() => setShowProductDialog(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveProduct}
              disabled={saving || !productForm.name}
              className="bg-indigo-600 hover:bg-indigo-700"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {editingProductId ? "Update" : "Add Item"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* Bank Dialog                                                        */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <Dialog open={showBankDialog} onOpenChange={setShowBankDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Bank Account</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Link to Seller</Label>
              <Select
                options={sellers.map((s: any) => ({
                  value: s._id,
                  label: s.name,
                }))}
                placeholder="(Optional) select seller..."
                value={bankForm.sellerId}
                onChange={(e) =>
                  setBankForm((f: any) => ({ ...f, sellerId: e.target.value }))
                }
              />
            </div>
            <div>
              <Label>Account Name *</Label>
              <Input
                value={bankForm.accountName}
                onChange={(e) =>
                  setBankForm((f: any) => ({
                    ...f,
                    accountName: e.target.value,
                  }))
                }
                placeholder="Account holder name"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Account Number *</Label>
                <Input
                  value={bankForm.accountNumber}
                  onChange={(e) =>
                    setBankForm((f: any) => ({
                      ...f,
                      accountNumber: e.target.value,
                    }))
                  }
                />
              </div>
              <div>
                <Label>IFSC Code *</Label>
                <Input
                  value={bankForm.ifscCode}
                  onChange={(e) =>
                    setBankForm((f: any) => ({
                      ...f,
                      ifscCode: e.target.value,
                    }))
                  }
                  placeholder="SBIN0001234"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Bank Name *</Label>
                <Input
                  value={bankForm.bankName}
                  onChange={(e) =>
                    setBankForm((f: any) => ({
                      ...f,
                      bankName: e.target.value,
                    }))
                  }
                  placeholder="State Bank of India"
                />
              </div>
              <div>
                <Label>Branch</Label>
                <Input
                  value={bankForm.branch}
                  onChange={(e) =>
                    setBankForm((f: any) => ({ ...f, branch: e.target.value }))
                  }
                  placeholder="Branch name"
                />
              </div>
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button variant="secondary" onClick={() => setShowBankDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveBank}
              disabled={
                saving ||
                !bankForm.accountName ||
                !bankForm.accountNumber ||
                !bankForm.ifscCode ||
                !bankForm.bankName
              }
              className="bg-indigo-600 hover:bg-indigo-700"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Add Bank
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Invoice View/Preview Dialog */}
      {viewingInvoice && (
        <InvoiceViewDialog
          open={!!viewingInvoice}
          onClose={() => setViewingInvoice(null)}
          invoice={viewingInvoice}
          seller={viewingInvoice.sellerData || sellers.find((s: any) => s._id === viewingInvoice.sellerId)}
          buyer={viewingInvoice.buyerData || buyers.find((b: any) => b._id === viewingInvoice.buyerId)}
          bank={viewingInvoice.bankData || banks.find((b: any) => b._id === viewingInvoice.bankId)}
        />
      )}
    </AppLayout>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Sub-components
// ═══════════════════════════════════════════════════════════════════════════════

const KPI_COLORS: Record<string, { bg: string; icon: string; text: string }> = {
  blue: { bg: "bg-blue-50", icon: "text-blue-600", text: "text-blue-700" },
  emerald: { bg: "bg-emerald-50", icon: "text-emerald-600", text: "text-emerald-700" },
  amber: { bg: "bg-amber-50", icon: "text-amber-600", text: "text-amber-700" },
  rose: { bg: "bg-rose-50", icon: "text-rose-600", text: "text-rose-700" },
  purple: { bg: "bg-purple-50", icon: "text-purple-600", text: "text-purple-700" },
  indigo: { bg: "bg-indigo-50", icon: "text-indigo-600", text: "text-indigo-700" },
};

function KpiCard({
  title,
  value,
  subtitle,
  icon,
  color,
}: {
  title: string;
  value: string;
  subtitle: string;
  icon: React.ReactNode;
  color: string;
}) {
  const c = KPI_COLORS[color] || KPI_COLORS.blue;
  return (
    <Card className="relative overflow-hidden">
      <CardContent className="pt-5 pb-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
              {title}
            </p>
            <p className={`text-xl font-bold mt-1 font-mono ${c.text}`}>
              {value}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>
          </div>
          <div className={`p-2.5 rounded-xl ${c.bg}`}>
            <span className={c.icon}>{icon}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="text-center py-12">
      <div className="text-gray-300 flex justify-center mb-3">{icon}</div>
      <p className="text-gray-500 font-medium">{title}</p>
      <p className="text-gray-400 text-sm mt-1">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
