"use client";

import { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useAuth } from "@/lib/auth-context";
import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Upload,
  FolderLock,
  FileText,
  File,
  FileImage,
  Download,
  Trash2,
  Search,
  Loader2,
  CloudUpload,
  X,
  Copy,
  Check,
  Eye,
  LayoutGrid,
  List,
  Edit3,
  ScanLine,
} from "lucide-react";

// --------------- Types ---------------

type DocumentCategory =
  | "pan_card"
  | "aadhaar"
  | "passport"
  | "voter_id"
  | "driving_license"
  | "bank_statement"
  | "salary_slip"
  | "form_16"
  | "itr"
  | "gst_return"
  | "investment_proof"
  | "insurance_policy"
  | "property_doc"
  | "invoice"
  | "receipt"
  | "other";

interface ExtractedData {
  pan_number?: string;
  aadhaar_number?: string;
  name?: string;
  dob?: string;
  address?: string;
  account_number?: string;
  ifsc?: string;
  bank_name?: string;
  invoice_number?: string;
  amount?: string;
  date?: string;
  gst_number?: string;
}

// --------------- Constants ---------------

const CATEGORY_OPTIONS: { value: DocumentCategory; label: string }[] = [
  { value: "pan_card", label: "PAN Card" },
  { value: "aadhaar", label: "Aadhaar" },
  { value: "passport", label: "Passport" },
  { value: "voter_id", label: "Voter ID" },
  { value: "driving_license", label: "Driving License" },
  { value: "bank_statement", label: "Bank Statement" },
  { value: "salary_slip", label: "Salary Slip" },
  { value: "form_16", label: "Form 16" },
  { value: "itr", label: "ITR" },
  { value: "gst_return", label: "GST Return" },
  { value: "investment_proof", label: "Investment Proof" },
  { value: "insurance_policy", label: "Insurance Policy" },
  { value: "property_doc", label: "Property Document" },
  { value: "invoice", label: "Invoice" },
  { value: "receipt", label: "Receipt" },
  { value: "other", label: "Other" },
];

const CATEGORY_TABS: { value: string; label: string; categories: DocumentCategory[] }[] = [
  { value: "all", label: "All", categories: [] },
  {
    value: "identity",
    label: "Identity",
    categories: ["pan_card", "aadhaar", "passport", "voter_id", "driving_license"],
  },
  { value: "tax", label: "Tax", categories: ["form_16", "itr", "gst_return"] },
  { value: "investment", label: "Investment", categories: ["investment_proof"] },
  { value: "insurance", label: "Insurance", categories: ["insurance_policy"] },
  { value: "bank", label: "Bank Statements", categories: ["bank_statement", "salary_slip"] },
  { value: "receipts", label: "Receipts", categories: ["invoice", "receipt"] },
  { value: "other", label: "Other", categories: ["property_doc", "other"] },
];

// --------------- Helpers ---------------

function categoryLabel(cat: string) {
  return CATEGORY_OPTIONS.find((c) => c.value === cat)?.label ?? cat;
}

function categoryBadgeColor(cat: string): string {
  const colors: Record<string, string> = {
    pan_card: "bg-blue-50 text-blue-600 border-blue-200",
    aadhaar: "bg-orange-50 text-orange-600 border-orange-200",
    passport: "bg-indigo-50 text-indigo-600 border-indigo-200",
    voter_id: "bg-violet-50 text-violet-600 border-violet-200",
    driving_license: "bg-teal-50 text-teal-600 border-teal-200",
    bank_statement: "bg-cyan-50 text-cyan-600 border-cyan-200",
    salary_slip: "bg-lime-50 text-lime-600 border-lime-200",
    form_16: "bg-purple-50 text-purple-600 border-purple-200",
    itr: "bg-purple-50 text-purple-700 border-purple-200",
    gst_return: "bg-fuchsia-50 text-fuchsia-600 border-fuchsia-200",
    investment_proof: "bg-emerald-50 text-emerald-600 border-emerald-200",
    insurance_policy: "bg-amber-50 text-amber-600 border-amber-200",
    property_doc: "bg-stone-50 text-stone-600 border-stone-200",
    invoice: "bg-rose-50 text-rose-600 border-rose-200",
    receipt: "bg-pink-50 text-pink-600 border-pink-200",
    other: "bg-gray-50 text-gray-600 border-gray-200",
  };
  return colors[cat] ?? colors.other;
}

function getFileIcon(fileType: string) {
  if (fileType.startsWith("image/")) return FileImage;
  if (fileType === "application/pdf") return FileText;
  return File;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function autoDetectCategory(fileName: string): DocumentCategory {
  const lower = fileName.toLowerCase();
  if (lower.includes("pan")) return "pan_card";
  if (lower.includes("aadhaar") || lower.includes("aadhar")) return "aadhaar";
  if (lower.includes("passport")) return "passport";
  if (lower.includes("voter") || lower.includes("epic")) return "voter_id";
  if (lower.includes("driving") || lower.includes("license") || lower.includes("dl"))
    return "driving_license";
  if (lower.includes("bank") || lower.includes("statement")) return "bank_statement";
  if (lower.includes("salary") || lower.includes("payslip") || lower.includes("pay_slip"))
    return "salary_slip";
  if (lower.includes("form16") || lower.includes("form_16") || lower.includes("form 16"))
    return "form_16";
  if (lower.includes("itr")) return "itr";
  if (lower.includes("gst")) return "gst_return";
  if (lower.includes("invest")) return "investment_proof";
  if (lower.includes("insurance") || lower.includes("policy")) return "insurance_policy";
  if (lower.includes("property") || lower.includes("deed")) return "property_doc";
  if (lower.includes("invoice")) return "invoice";
  if (lower.includes("receipt") || lower.includes("bill")) return "receipt";
  return "other";
}

function getExtractedDataLabel(key: string): string {
  const labels: Record<string, string> = {
    pan_number: "PAN Number",
    aadhaar_number: "Aadhaar Number",
    name: "Name",
    dob: "Date of Birth",
    address: "Address",
    account_number: "Account Number",
    ifsc: "IFSC Code",
    bank_name: "Bank Name",
    invoice_number: "Invoice Number",
    amount: "Amount",
    date: "Date",
    gst_number: "GST Number",
  };
  return labels[key] ?? key;
}

function isCopyableField(key: string): boolean {
  return [
    "pan_number",
    "aadhaar_number",
    "account_number",
    "ifsc",
    "invoice_number",
    "gst_number",
  ].includes(key);
}

function getExtractedDataSummary(data: ExtractedData | undefined): string | null {
  if (!data) return null;
  if (data.pan_number) return `PAN: ${data.pan_number}`;
  if (data.aadhaar_number) return `Aadhaar: ${data.aadhaar_number}`;
  if (data.account_number) return `A/C: ${data.account_number}`;
  if (data.invoice_number) return `Inv: ${data.invoice_number}`;
  if (data.gst_number) return `GST: ${data.gst_number}`;
  return null;
}

function getFYOptions() {
  const now = new Date();
  const currentYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  const options = [{ value: "", label: "No FY" }];
  for (let y = currentYear; y >= currentYear - 4; y--) {
    options.push({
      value: `${y}-${(y + 1).toString().slice(-2)}`,
      label: `FY ${y}-${(y + 1).toString().slice(-2)}`,
    });
  }
  return options;
}

// --------------- Copy Button Component ---------------

function CopyButton({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <button
      onClick={handleCopy}
      className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-text-tertiary hover:text-accent hover:bg-accent/10 transition-colors"
      title={label ? `Copy ${label}` : "Copy to clipboard"}
    >
      {copied ? (
        <>
          <Check className="h-3 w-3 text-emerald-500" />
          <span className="text-emerald-500">Copied!</span>
        </>
      ) : (
        <Copy className="h-3 w-3" />
      )}
    </button>
  );
}

// --------------- Main Component ---------------

export default function VaultPage() {
  const { user } = useAuth();

  const documents = useQuery(
    api.vault.getDocuments,
    user ? { userId: user.userId } : "skip"
  );

  const generateUploadUrl = useMutation(api.vault.generateUploadUrl);
  const saveDocument = useMutation(api.vault.saveDocument);
  const deleteDocument = useMutation(api.vault.deleteDocument);
  const updateDocument = useMutation(api.vault.updateDocument);
  const updateDocumentData = useMutation(api.vault.updateDocumentData);

  // UI State
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [activeTab, setActiveTab] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [dragActive, setDragActive] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [previewDoc, setPreviewDoc] = useState<string | null>(null);

  // OCR State
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrResult, setOcrResult] = useState<{
    text: string;
    data: ExtractedData;
  } | null>(null);
  const [ocrError, setOcrError] = useState<string | null>(null);

  // Upload form
  const [formData, setFormData] = useState({
    name: "",
    category: "other" as DocumentCategory,
    financial_year: "",
    notes: "",
  });

  // Edit state for detail panel
  const [editingName, setEditingName] = useState<string | null>(null);
  const [editNameValue, setEditNameValue] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFormChange(field: string, value: string) {
    setFormData((prev) => ({ ...prev, [field]: value }));
  }

  function handleFileSelect(file: File) {
    setSelectedFile(file);
    const detected = autoDetectCategory(file.name);
    setFormData((prev) => ({
      ...prev,
      name: prev.name || file.name.replace(/\.[^.]+$/, ""),
      category: detected,
    }));
    // Reset OCR state when new file is selected
    setOcrResult(null);
    setOcrError(null);
  }

  function handleFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFileSelect(file);
  }

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(false);
      const file = e.dataTransfer.files?.[0];
      if (file) handleFileSelect(file);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  async function runOcr(fileUrl: string, category: string, docId?: string) {
    setOcrLoading(true);
    setOcrError(null);
    try {
      const res = await fetch("/api/ocr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileUrl, category }),
      });
      const result = await res.json();
      if (!res.ok) {
        setOcrError(result.error || "OCR failed");
        return null;
      }
      setOcrResult(result);
      // If we have a doc ID, persist the extracted data
      if (docId) {
        await updateDocumentData({
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          id: docId as any,
          extracted_text: result.text || undefined,
          extracted_data: result.data && Object.keys(result.data).length > 0 ? result.data : undefined,
        });
      }
      return result;
    } catch (err) {
      setOcrError(err instanceof Error ? err.message : "OCR request failed");
      return null;
    } finally {
      setOcrLoading(false);
    }
  }

  async function handleUpload() {
    if (!user || !selectedFile || !formData.name) return;
    setUploading(true);
    try {
      // Step 1: Generate upload URL
      const uploadUrl = await generateUploadUrl();

      // Step 2: Upload file to Convex storage
      const result = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": selectedFile.type },
        body: selectedFile,
      });
      const { storageId } = await result.json();

      // Step 3: Save document record
      const docId = await saveDocument({
        userId: user.userId,
        name: formData.name,
        category: formData.category,
        storageId,
        file_size: selectedFile.size,
        file_type: selectedFile.type,
        financial_year: formData.financial_year || undefined,
        notes: formData.notes || undefined,
      });

      // Step 4: Auto-trigger OCR for images
      if (selectedFile.type.startsWith("image/")) {
        // We need the file URL - fetch documents to get it
        // For now, trigger OCR after a short wait to allow Convex to process
        setTimeout(async () => {
          const docs = documents;
          // Find the newly uploaded doc by matching storageId from the refreshed list
          // Since we don't have the URL immediately, we'll rely on the document list refresh
          // The user can also manually trigger OCR from the detail panel
        }, 1000);
      }

      setUploadDialogOpen(false);
      setSelectedFile(null);
      setOcrResult(null);
      setOcrError(null);
      setFormData({ name: "", category: "other", financial_year: "", notes: "" });
    } catch (error) {
      console.error("Failed to upload document:", error);
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(id: string) {
    if (previewDoc === id) setPreviewDoc(null);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await deleteDocument({ id: id as any });
    } catch (error) {
      console.error("Failed to delete document:", error);
    }
  }

  async function handleSaveName(id: string, newName: string) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await updateDocument({ id: id as any, name: newName });
    } catch (error) {
      console.error("Failed to update document:", error);
    }
    setEditingName(null);
  }

  // Filter documents
  const currentTabCategories =
    CATEGORY_TABS.find((t) => t.value === activeTab)?.categories ?? [];

  const filteredDocs = (documents ?? []).filter((doc) => {
    const matchesTab =
      activeTab === "all" || currentTabCategories.includes(doc.category as DocumentCategory);
    const matchesSearch =
      !searchQuery ||
      doc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (doc.notes && doc.notes.toLowerCase().includes(searchQuery.toLowerCase())) ||
      categoryLabel(doc.category).toLowerCase().includes(searchQuery.toLowerCase());
    return matchesTab && matchesSearch;
  });

  // Preview document
  const previewDocument = previewDoc
    ? (documents ?? []).find((d) => d._id === previewDoc)
    : null;

  if (!user) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-96">
          <p className="text-text-secondary">Loading...</p>
        </div>
      </AppLayout>
    );
  }

  const isLoading = documents === undefined;

  return (
    <AppLayout>
      <div className="space-y-6 animate-enter">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold text-text-primary">
              Document Vault
            </h1>
            <p className="text-text-secondary text-sm mt-1">
              Securely store, organize, and extract data from your financial documents
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden">
              <button
                onClick={() => setViewMode("grid")}
                className={`p-2 transition-colors ${viewMode === "grid" ? "bg-accent/10 text-accent" : "text-text-tertiary hover:text-text-secondary"}`}
                title="Grid view"
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={`p-2 transition-colors ${viewMode === "list" ? "bg-accent/10 text-accent" : "text-text-tertiary hover:text-text-secondary"}`}
                title="List view"
              >
                <List className="h-4 w-4" />
              </button>
            </div>
            <Button onClick={() => setUploadDialogOpen(true)}>
              <Upload className="h-4 w-4 mr-2" />
              Upload Document
            </Button>
          </div>
        </div>

        {/* Category Tabs */}
        <div className="overflow-x-auto">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="w-full justify-start">
              {CATEGORY_TABS.map((tab) => (
                <TabsTrigger key={tab.value} value={tab.value} className="text-xs">
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>

        {/* Search */}
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-tertiary" />
          <Input
            placeholder="Search documents..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Content area with optional preview panel */}
        <div className={`flex gap-6 ${previewDoc ? "" : ""}`}>
          {/* Document Grid/List */}
          <div className={`flex-1 min-w-0 ${previewDoc ? "max-w-[60%]" : ""}`}>
            {isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div key={i} className="h-40 rounded-xl bg-gray-100 animate-pulse" />
                ))}
              </div>
            ) : filteredDocs.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-accent/10 mb-4">
                    <FolderLock className="h-8 w-8 text-accent-light" />
                  </div>
                  <h3 className="text-lg font-semibold text-text-primary mb-2">
                    {(documents ?? []).length === 0
                      ? "No documents uploaded"
                      : "No matching documents"}
                  </h3>
                  <p className="text-text-secondary text-sm max-w-md mb-6">
                    {(documents ?? []).length === 0
                      ? "Upload your financial documents to keep them safe and organized. Store PAN cards, Aadhaar, tax returns, bank statements, and more."
                      : "Try adjusting your search or filter criteria."}
                  </p>
                  {(documents ?? []).length === 0 && (
                    <Button onClick={() => setUploadDialogOpen(true)}>
                      <Upload className="h-4 w-4 mr-2" />
                      Upload Document
                    </Button>
                  )}
                </CardContent>
              </Card>
            ) : viewMode === "grid" ? (
              <motion.div
                className={`grid gap-4 ${
                  previewDoc
                    ? "grid-cols-1 md:grid-cols-2"
                    : "grid-cols-1 md:grid-cols-2 xl:grid-cols-3"
                }`}
                initial="hidden"
                animate="show"
                variants={{ hidden: {}, show: { transition: { staggerChildren: 0.05 } } }}
              >
                {filteredDocs.map((doc) => {
                  const FileIcon = getFileIcon(doc.file_type);
                  const extractedSummary = getExtractedDataSummary(
                    doc.extracted_data as ExtractedData | undefined
                  );
                  const isSelected = previewDoc === doc._id;

                  return (
                    <Card
                      key={doc._id}
                      className={`cursor-pointer transition-all hover:shadow-md ${
                        isSelected ? "ring-2 ring-accent border-accent" : ""
                      }`}
                      onClick={() => setPreviewDoc(isSelected ? null : doc._id)}
                    >
                      {/* Thumbnail area */}
                      {doc.file_type.startsWith("image/") && doc.url ? (
                        <div className="h-32 bg-gray-50 rounded-t-xl overflow-hidden">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={doc.url}
                            alt={doc.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ) : (
                        <div className="h-20 bg-gray-50 rounded-t-xl flex items-center justify-center">
                          <FileIcon className="h-10 w-10 text-gray-300" />
                        </div>
                      )}

                      <CardHeader className="pb-2 pt-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            {editingName === doc._id ? (
                              <input
                                className="text-sm font-semibold w-full border-b border-accent outline-none bg-transparent"
                                value={editNameValue}
                                onChange={(e) => setEditNameValue(e.target.value)}
                                onBlur={() => handleSaveName(doc._id, editNameValue)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter")
                                    handleSaveName(doc._id, editNameValue);
                                  if (e.key === "Escape") setEditingName(null);
                                }}
                                autoFocus
                                onClick={(e) => e.stopPropagation()}
                              />
                            ) : (
                              <CardTitle
                                className="text-sm leading-snug truncate cursor-text"
                                onDoubleClick={(e) => {
                                  e.stopPropagation();
                                  setEditingName(doc._id);
                                  setEditNameValue(doc.name);
                                }}
                                title="Double-click to rename"
                              >
                                {doc.name}
                              </CardTitle>
                            )}
                            <p className="text-text-tertiary text-xs mt-0.5">
                              {formatFileSize(doc.file_size)}
                            </p>
                          </div>
                          <div
                            className="flex items-center gap-0.5 shrink-0"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              onClick={() => setPreviewDoc(doc._id)}
                              className="rounded p-1 text-text-tertiary hover:text-accent hover:bg-accent/10 transition-colors"
                              title="Preview"
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </button>
                            {doc.url && (
                              <a
                                href={doc.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="rounded p-1 text-text-tertiary hover:text-accent hover:bg-accent/10 transition-colors"
                                title="Download"
                              >
                                <Download className="h-3.5 w-3.5" />
                              </a>
                            )}
                            <button
                              onClick={() => handleDelete(doc._id)}
                              className="rounded p-1 text-text-tertiary hover:text-rose-400 hover:bg-rose-400/10 transition-colors"
                              title="Delete"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <div className="flex items-center justify-between">
                          <span
                            className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-medium ${categoryBadgeColor(doc.category)}`}
                          >
                            {categoryLabel(doc.category)}
                          </span>
                          <div className="flex items-center gap-2">
                            {doc.financial_year && (
                              <Badge variant="secondary" className="text-[10px]">
                                FY {doc.financial_year}
                              </Badge>
                            )}
                            <span className="text-text-tertiary text-xs">
                              {new Date(doc.uploaded_at).toLocaleDateString("en-IN")}
                            </span>
                          </div>
                        </div>
                        {extractedSummary && (
                          <div className="mt-2 flex items-center gap-1">
                            <span className="text-xs font-mono text-accent bg-accent/5 rounded px-1.5 py-0.5">
                              {extractedSummary}
                            </span>
                            <CopyButton
                              text={extractedSummary.split(": ")[1] || extractedSummary}
                            />
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </motion.div>
            ) : (
              /* List View */
              <div className="space-y-2">
                {filteredDocs.map((doc) => {
                  const FileIcon = getFileIcon(doc.file_type);
                  const extractedSummary = getExtractedDataSummary(
                    doc.extracted_data as ExtractedData | undefined
                  );
                  const isSelected = previewDoc === doc._id;

                  return (
                    <div
                      key={doc._id}
                      onClick={() => setPreviewDoc(isSelected ? null : doc._id)}
                      className={`flex items-center gap-4 p-3 rounded-xl border cursor-pointer transition-all hover:shadow-sm ${
                        isSelected
                          ? "ring-2 ring-accent border-accent bg-accent/5"
                          : "border-gray-200 bg-white hover:border-gray-300"
                      }`}
                    >
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-50 shrink-0">
                        <FileIcon className="h-5 w-5 text-gray-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-text-primary truncate">
                          {doc.name}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span
                            className={`inline-flex items-center rounded-md border px-1.5 py-0 text-[10px] font-medium ${categoryBadgeColor(doc.category)}`}
                          >
                            {categoryLabel(doc.category)}
                          </span>
                          <span className="text-text-tertiary text-xs">
                            {formatFileSize(doc.file_size)}
                          </span>
                          <span className="text-text-tertiary text-xs">
                            {new Date(doc.uploaded_at).toLocaleDateString("en-IN")}
                          </span>
                          {extractedSummary && (
                            <span className="text-xs font-mono text-accent">
                              {extractedSummary}
                            </span>
                          )}
                        </div>
                      </div>
                      <div
                        className="flex items-center gap-1 shrink-0"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {extractedSummary && (
                          <CopyButton
                            text={extractedSummary.split(": ")[1] || extractedSummary}
                          />
                        )}
                        {doc.url && (
                          <a
                            href={doc.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rounded p-1.5 text-text-tertiary hover:text-accent hover:bg-accent/10 transition-colors"
                            title="Download"
                          >
                            <Download className="h-4 w-4" />
                          </a>
                        )}
                        <button
                          onClick={() => handleDelete(doc._id)}
                          className="rounded p-1.5 text-text-tertiary hover:text-rose-400 hover:bg-rose-400/10 transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Detail / Preview Panel */}
          {previewDocument && (
            <div className="w-[40%] shrink-0 hidden lg:block">
              <Card className="sticky top-6">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base truncate">
                      {previewDocument.name}
                    </CardTitle>
                    <button
                      onClick={() => setPreviewDoc(null)}
                      className="p-1 rounded hover:bg-gray-100"
                    >
                      <X className="h-4 w-4 text-text-tertiary" />
                    </button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Preview */}
                  {previewDocument.file_type.startsWith("image/") && previewDocument.url ? (
                    <div className="rounded-lg overflow-hidden border border-gray-200 bg-gray-50">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={previewDocument.url}
                        alt={previewDocument.name}
                        className="w-full h-auto max-h-64 object-contain"
                      />
                    </div>
                  ) : previewDocument.file_type === "application/pdf" &&
                    previewDocument.url ? (
                    <div className="rounded-lg overflow-hidden border border-gray-200">
                      <iframe
                        src={previewDocument.url}
                        className="w-full h-64"
                        title={previewDocument.name}
                      />
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-32 bg-gray-50 rounded-lg border border-gray-200">
                      <File className="h-12 w-12 text-gray-300" />
                    </div>
                  )}

                  {/* Meta info */}
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <p className="text-text-tertiary text-xs">Category</p>
                      <span
                        className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-medium mt-0.5 ${categoryBadgeColor(previewDocument.category)}`}
                      >
                        {categoryLabel(previewDocument.category)}
                      </span>
                    </div>
                    <div>
                      <p className="text-text-tertiary text-xs">File Size</p>
                      <p className="text-text-primary text-sm mt-0.5">
                        {formatFileSize(previewDocument.file_size)}
                      </p>
                    </div>
                    <div>
                      <p className="text-text-tertiary text-xs">Uploaded</p>
                      <p className="text-text-primary text-sm mt-0.5">
                        {new Date(previewDocument.uploaded_at).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </p>
                    </div>
                    {previewDocument.financial_year && (
                      <div>
                        <p className="text-text-tertiary text-xs">Financial Year</p>
                        <p className="text-text-primary text-sm mt-0.5">
                          FY {previewDocument.financial_year}
                        </p>
                      </div>
                    )}
                  </div>

                  {previewDocument.notes && (
                    <div>
                      <p className="text-text-tertiary text-xs mb-1">Notes</p>
                      <p className="text-text-primary text-sm">
                        {previewDocument.notes}
                      </p>
                    </div>
                  )}

                  {/* Extracted Data Table */}
                  {previewDocument.extracted_data &&
                    Object.keys(previewDocument.extracted_data as object).length > 0 && (
                      <div>
                        <p className="text-text-tertiary text-xs mb-2 flex items-center gap-1">
                          <ScanLine className="h-3 w-3" /> Extracted Data
                        </p>
                        <div className="space-y-1.5 rounded-lg border border-gray-200 p-3 bg-gray-50">
                          {Object.entries(
                            previewDocument.extracted_data as ExtractedData
                          ).map(([key, value]) => {
                            if (!value) return null;
                            return (
                              <div
                                key={key}
                                className="flex items-center justify-between text-sm"
                              >
                                <span className="text-text-secondary text-xs">
                                  {getExtractedDataLabel(key)}
                                </span>
                                <div className="flex items-center gap-1">
                                  <span className="font-mono text-text-primary text-xs">
                                    {value}
                                  </span>
                                  {isCopyableField(key) && (
                                    <CopyButton
                                      text={value}
                                      label={getExtractedDataLabel(key)}
                                    />
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                  {/* OCR Button - only for images without extracted data */}
                  {previewDocument.file_type.startsWith("image/") &&
                    previewDocument.url &&
                    (!previewDocument.extracted_data ||
                      Object.keys(previewDocument.extracted_data as object).length === 0) && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={() =>
                          runOcr(
                            previewDocument.url!,
                            previewDocument.category,
                            previewDocument._id
                          )
                        }
                        disabled={ocrLoading}
                      >
                        {ocrLoading ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <ScanLine className="h-4 w-4 mr-2" />
                        )}
                        Extract Text (OCR)
                      </Button>
                    )}

                  {/* Action buttons */}
                  <div className="flex gap-2">
                    {previewDocument.url && (
                      <a
                        href={previewDocument.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1"
                      >
                        <Button variant="outline" size="sm" className="w-full">
                          <Download className="h-4 w-4 mr-2" />
                          Download
                        </Button>
                      </a>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setEditingName(previewDocument._id);
                        setEditNameValue(previewDocument.name);
                      }}
                    >
                      <Edit3 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>

        {/* Upload Dialog */}
        <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Upload Document</DialogTitle>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {/* Drag & Drop Zone */}
              <div
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 cursor-pointer transition-colors ${
                  dragActive
                    ? "border-accent bg-accent/5"
                    : selectedFile
                      ? "border-emerald-300 bg-emerald-50/50"
                      : "border-gray-200 hover:border-accent/50 hover:bg-gray-50"
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  onChange={handleFileInputChange}
                  className="hidden"
                  accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx"
                />
                {selectedFile ? (
                  <div className="flex items-center gap-3">
                    <FileText className="h-8 w-8 text-emerald-500" />
                    <div>
                      <p className="text-sm font-medium text-text-primary">
                        {selectedFile.name}
                      </p>
                      <p className="text-xs text-text-tertiary">
                        {formatFileSize(selectedFile.size)}
                      </p>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedFile(null);
                        setOcrResult(null);
                        setOcrError(null);
                      }}
                      className="p-1 rounded hover:bg-gray-100"
                    >
                      <X className="h-4 w-4 text-text-tertiary" />
                    </button>
                  </div>
                ) : (
                  <>
                    <CloudUpload className="h-10 w-10 text-text-tertiary mb-2" />
                    <p className="text-sm text-text-secondary mb-1">
                      Drag &amp; drop a file here, or click to browse
                    </p>
                    <p className="text-xs text-text-tertiary">
                      PDF, Images, Word, Excel (max 10MB)
                    </p>
                  </>
                )}
              </div>

              {/* Auto-detected category notice */}
              {selectedFile && formData.category !== "other" && (
                <div className="flex items-center gap-2 text-xs text-accent bg-accent/5 rounded-lg px-3 py-2">
                  <ScanLine className="h-3.5 w-3.5" />
                  <span>
                    Auto-detected category:{" "}
                    <strong>{categoryLabel(formData.category)}</strong>
                  </span>
                </div>
              )}

              {/* Form Fields */}
              <div className="space-y-2">
                <Label htmlFor="doc-name">Document Name</Label>
                <Input
                  id="doc-name"
                  placeholder="e.g. PAN Card, ITR 2024-25"
                  value={formData.name}
                  onChange={(e) => handleFormChange("name", e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="doc-category">Category</Label>
                  <Select
                    id="doc-category"
                    options={CATEGORY_OPTIONS}
                    value={formData.category}
                    onChange={(e) => handleFormChange("category", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="doc-fy">Financial Year</Label>
                  <Select
                    id="doc-fy"
                    options={getFYOptions()}
                    value={formData.financial_year}
                    onChange={(e) => handleFormChange("financial_year", e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="doc-notes">Notes (optional)</Label>
                <Input
                  id="doc-notes"
                  placeholder="Any additional notes"
                  value={formData.notes}
                  onChange={(e) => handleFormChange("notes", e.target.value)}
                />
              </div>

              {/* OCR Error */}
              {ocrError && (
                <div className="text-xs text-rose-600 bg-rose-50 rounded-lg px-3 py-2 border border-rose-200">
                  {ocrError}
                </div>
              )}

              {/* OCR Results Preview */}
              {ocrResult && ocrResult.data && Object.keys(ocrResult.data).length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs text-text-secondary font-medium flex items-center gap-1">
                    <ScanLine className="h-3 w-3" /> Extracted Data Preview
                  </p>
                  <div className="space-y-1 rounded-lg border border-gray-200 p-3 bg-gray-50">
                    {Object.entries(ocrResult.data).map(([key, value]) => {
                      if (!value) return null;
                      return (
                        <div
                          key={key}
                          className="flex items-center justify-between text-sm"
                        >
                          <span className="text-text-secondary text-xs">
                            {getExtractedDataLabel(key)}
                          </span>
                          <div className="flex items-center gap-1">
                            <span className="font-mono text-text-primary text-xs">
                              {value}
                            </span>
                            {isCopyableField(key) && (
                              <CopyButton text={value} label={getExtractedDataLabel(key)} />
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button
                variant="ghost"
                onClick={() => {
                  setUploadDialogOpen(false);
                  setSelectedFile(null);
                  setOcrResult(null);
                  setOcrError(null);
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleUpload}
                disabled={uploading || !selectedFile || !formData.name}
              >
                {uploading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Upload
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
