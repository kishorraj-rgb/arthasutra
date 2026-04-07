"use client";

import { useState, useRef, useCallback } from "react";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { formatCurrency, getCurrentFinancialYear } from "@/lib/utils";
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
} from "lucide-react";

const CATEGORY_OPTIONS = [
  { value: "identity", label: "Identity" },
  { value: "tax", label: "Tax" },
  { value: "investment", label: "Investment" },
  { value: "insurance", label: "Insurance" },
  { value: "bank_statement", label: "Bank Statement" },
  { value: "receipt", label: "Receipt" },
  { value: "other", label: "Other" },
];

const ALL_CATEGORIES = [{ value: "all", label: "All Categories" }, ...CATEGORY_OPTIONS];

function getFYOptions() {
  const now = new Date();
  const currentYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  const options = [{ value: "", label: "No FY" }];
  for (let y = currentYear; y >= currentYear - 4; y--) {
    options.push({ value: `${y}-${(y + 1).toString().slice(-2)}`, label: `FY ${y}-${(y + 1).toString().slice(-2)}` });
  }
  return options;
}

function categoryLabel(cat: string) {
  return CATEGORY_OPTIONS.find((c) => c.value === cat)?.label ?? cat;
}

function categoryBadgeColor(cat: string): string {
  const colors: Record<string, string> = {
    identity: "bg-blue-50 text-blue-600 border-blue-200",
    tax: "bg-purple-50 text-purple-600 border-purple-200",
    investment: "bg-emerald-50 text-emerald-600 border-emerald-200",
    insurance: "bg-amber-50 text-amber-600 border-amber-200",
    bank_statement: "bg-cyan-50 text-cyan-600 border-cyan-200",
    receipt: "bg-rose-50 text-rose-600 border-rose-200",
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

export default function VaultPage() {
  const { user } = useAuth();

  const documents = useQuery(
    api.vault.getDocuments,
    user ? { userId: user.userId } : "skip"
  );

  const generateUploadUrl = useMutation(api.vault.generateUploadUrl);
  const saveDocument = useMutation(api.vault.saveDocument);
  const deleteDocument = useMutation(api.vault.deleteDocument);

  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filterCategory, setFilterCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [dragActive, setDragActive] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    category: "other",
    financial_year: "",
    notes: "",
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFormChange(field: string, value: string) {
    setFormData((prev) => ({ ...prev, [field]: value }));
  }

  function handleFileSelect(file: File) {
    setSelectedFile(file);
    if (!formData.name) {
      setFormData((prev) => ({ ...prev, name: file.name.replace(/\.[^.]+$/, "") }));
    }
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

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFileSelect(file);
  }, []);

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
      await saveDocument({
        userId: user.userId,
        name: formData.name,
        category: formData.category as "identity" | "tax" | "investment" | "insurance" | "bank_statement" | "receipt" | "other",
        storageId,
        file_size: selectedFile.size,
        file_type: selectedFile.type,
        financial_year: formData.financial_year || undefined,
        notes: formData.notes || undefined,
      });

      setUploadDialogOpen(false);
      setSelectedFile(null);
      setFormData({ name: "", category: "other", financial_year: "", notes: "" });
    } catch (error) {
      console.error("Failed to upload document:", error);
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await deleteDocument({ id: id as any });
    } catch (error) {
      console.error("Failed to delete document:", error);
    }
  }

  // Filter documents
  const filteredDocs = (documents ?? []).filter((doc) => {
    const matchesCategory = filterCategory === "all" || doc.category === filterCategory;
    const matchesSearch =
      !searchQuery ||
      doc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (doc.notes && doc.notes.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

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
            <h1 className="font-display text-2xl font-bold text-text-primary">Document Vault</h1>
            <p className="text-text-secondary text-sm mt-1">Securely store and organize your financial documents</p>
          </div>
          <Button onClick={() => setUploadDialogOpen(true)}>
            <Upload className="h-4 w-4 mr-2" />
            Upload Document
          </Button>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3">
          <Select
            options={ALL_CATEGORIES}
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="w-44"
          />
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-tertiary" />
            <Input
              placeholder="Search documents..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

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
                {documents.length === 0 ? "No documents uploaded" : "No matching documents"}
              </h3>
              <p className="text-text-secondary text-sm max-w-md mb-6">
                {documents.length === 0
                  ? "Upload your financial documents to keep them safe and organized. Store tax returns, insurance policies, bank statements, and more."
                  : "Try adjusting your search or filter criteria."}
              </p>
              {documents.length === 0 && (
                <Button onClick={() => setUploadDialogOpen(true)}>
                  <Upload className="h-4 w-4 mr-2" />
                  Upload Document
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredDocs.map((doc) => {
              const FileIcon = getFileIcon(doc.file_type);
              return (
                <Card key={doc._id}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10 shrink-0">
                          <FileIcon className="h-5 w-5 text-accent-light" />
                        </div>
                        <div className="min-w-0">
                          <CardTitle className="text-sm leading-snug truncate">{doc.name}</CardTitle>
                          <p className="text-text-tertiary text-xs mt-0.5">{formatFileSize(doc.file_size)}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
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
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-medium ${categoryBadgeColor(doc.category)}`}>
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
                    {doc.notes && (
                      <p className="text-text-tertiary text-xs mt-2 line-clamp-2">{doc.notes}</p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

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
                      <p className="text-sm font-medium text-text-primary">{selectedFile.name}</p>
                      <p className="text-xs text-text-tertiary">{formatFileSize(selectedFile.size)}</p>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedFile(null);
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

              {/* Form Fields */}
              <div className="space-y-2">
                <Label htmlFor="doc-name">Document Name</Label>
                <Input
                  id="doc-name"
                  placeholder="e.g. ITR 2024-25"
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
            </div>

            <DialogFooter>
              <Button variant="ghost" onClick={() => setUploadDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleUpload} disabled={uploading || !selectedFile || !formData.name}>
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
