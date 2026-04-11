"use client";

import { useState, useCallback, useRef } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useAuth } from "@/lib/auth-context";
import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { formatCurrency } from "@/lib/utils";
import {
  Shield, Plus, Heart, Car, Home, Plane, Clock, AlertTriangle,
  CheckCircle, CheckCircle2, Loader2, Upload, FileText, ChevronDown,
  ChevronUp, X, AlertCircle, Users, Fuel, Download, Trash2, Paperclip,
} from "lucide-react";
import type { Id } from "../../../convex/_generated/dataModel";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const typeIcons: Record<string, typeof Shield> = { term: Shield, health: Heart, vehicle: Car, home: Home, travel: Plane };
const typeColors: Record<string, string> = { term: "text-blue-400", health: "text-rose-400", vehicle: "text-purple-400", home: "text-emerald-400", travel: "text-accent-light" };

function getDaysUntil(dateStr: string): number {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return Math.ceil((new Date(dateStr).getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function formatDate(iso: string) {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PolicyDoc = any;

/** Recursively strip null values from an object (Convex rejects null for optional fields) */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
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

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function InsurancePage() {
  const { user } = useAuth();
  const policies = useQuery(api.insurance.getInsurancePolicies, user ? { userId: user.userId } : "skip");
  const addPolicy = useMutation(api.insurance.addInsurancePolicy);
  const updatePolicy = useMutation(api.insurance.updateInsurancePolicy);
  const deletePolicy = useMutation(api.insurance.deleteInsurancePolicy);

  // Manual add dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ type: "term", provider: "", policy_number: "", sum_assured: "", annual_premium: "", next_due_date: "", nominee: "" });

  // Import dialog
  const [importOpen, setImportOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importPassword, setImportPassword] = useState("");
  const [importParsing, setImportParsing] = useState(false);
  const [importError, setImportError] = useState("");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [importPreview, setImportPreview] = useState<any>(null);
  const [importSaving, setImportSaving] = useState(false);
  const [importResult, setImportResult] = useState<string | null>(null);
  const importFileRef = useRef<HTMLInputElement>(null);

  // Expanded policy
  const [expandedPolicyId, setExpandedPolicyId] = useState<string | null>(null);

  // Manual add
  const handleSubmit = async () => {
    if (!user || !form.provider || !form.sum_assured) return;
    setSaving(true);
    try {
      await addPolicy({
        userId: user.userId,
        type: form.type as "term" | "health" | "vehicle" | "home" | "travel",
        provider: form.provider,
        policy_number: form.policy_number,
        sum_assured: Number(form.sum_assured),
        annual_premium: Number(form.annual_premium) || 0,
        next_due_date: form.next_due_date || new Date().toISOString().split("T")[0],
        nominee: form.nominee || undefined,
      });
      setDialogOpen(false);
      setForm({ type: "term", provider: "", policy_number: "", sum_assured: "", annual_premium: "", next_due_date: "", nominee: "" });
    } finally { setSaving(false); }
  };

  // Import parse
  const handleImportParse = async () => {
    if (!importFile) return;
    setImportParsing(true);
    setImportError("");
    setImportPreview(null);

    try {
      const formData = new FormData();
      formData.append("file", importFile);
      if (importPassword) formData.append("password", importPassword);

      const resp = await fetch("/api/parse-insurance", { method: "POST", body: formData });

      if (!resp.ok) {
        const data = await resp.json().catch(() => ({ error: "Parse failed" }));
        setImportError(data.error || "Failed to parse insurance document");
        setImportParsing(false);
        return;
      }

      const data = await resp.json();
      if (!data.policyDetails) {
        setImportError("Could not extract policy details from the file.");
        setImportParsing(false);
        return;
      }
      setImportPreview(data);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "Unexpected error");
    } finally {
      setImportParsing(false);
    }
  };

  // Import confirm
  const handleImportConfirm = async () => {
    if (!user || !importPreview) return;
    setImportSaving(true);

    try {
      const d = importPreview.policyDetails;
      const existingPolicies = policies ?? [];
      const existing = d.policy_number
        ? existingPolicies.find((p: PolicyDoc) => p.policy_number === d.policy_number)
        : null;

      const validTypes = ["term", "health", "vehicle", "home", "travel"] as const;
      const pType = validTypes.includes(d.type) ? d.type : "vehicle";

      const policyData = stripNulls({
        type: pType,
        provider: d.provider || "Unknown",
        policy_number: d.policy_number || "",
        sum_assured: Number(d.sum_assured) || 0,
        annual_premium: Number(d.annual_premium) || 0,
        next_due_date: d.policy_end_date || d.next_due_date || new Date().toISOString().split("T")[0],
        nominee: d.nominee || undefined,
        policy_start_date: d.policy_start_date || undefined,
        policy_end_date: d.policy_end_date || undefined,
        premium_breakdown: importPreview.premium_breakdown || undefined,
        vehicle_details: importPreview.vehicle_details || undefined,
        insured_members: importPreview.insured_members?.length > 0 ? importPreview.insured_members : undefined,
        add_ons: importPreview.add_ons?.length > 0 ? importPreview.add_ons : undefined,
        ncb_percent: d.ncb_percent != null ? Number(d.ncb_percent) : undefined,
        policy_category: d.policy_category || undefined,
        coverage_type: d.coverage_type || undefined,
        deductible: d.deductible != null ? Number(d.deductible) : undefined,
        financier: d.financier || undefined,
        previous_policy_number: d.previous_policy_number || undefined,
        previous_insurer: d.previous_insurer || undefined,
      });

      if (existing) {
        await updatePolicy({ id: existing._id, ...policyData });
        setImportResult("Policy updated successfully");
        setExpandedPolicyId(existing._id);
      } else {
        const newId = await addPolicy({ userId: user.userId, ...policyData });
        setImportResult("Policy imported successfully");
        setExpandedPolicyId(newId);
      }

      // Auto-upload the source PDF as a document
      if (importFile) {
        try {
          const policyId = existing?._id || (expandedPolicyId as Id<"insurance_policies">);
          if (policyId) {
            const uploadUrl = await generateUploadUrl();
            const uploadResp = await fetch(uploadUrl, {
              method: "POST",
              headers: { "Content-Type": importFile.type || "application/pdf" },
              body: importFile,
            });
            if (uploadResp.ok) {
              const { storageId } = await uploadResp.json();
              await saveDocument({
                userId: user.userId,
                policyId: policyId as Id<"insurance_policies">,
                storageId,
                name: importFile.name,
                file_size: importFile.size,
                file_type: importFile.type || "application/pdf",
              });
            }
          }
        } catch {
          // Non-critical — document upload failure shouldn't block import
        }
      }
    } catch (err) {
      console.error("Insurance import error:", err);
      setImportError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImportSaving(false);
    }
  };

  const generateUploadUrl = useMutation(api.insurance.generateUploadUrl);
  const saveDocument = useMutation(api.insurance.saveInsuranceDocument);

  const resetImport = () => {
    setImportOpen(false);
    setImportFile(null);
    setImportPassword("");
    setImportError("");
    setImportPreview(null);
    setImportResult(null);
  };

  // Stats
  const totalPremium = policies?.reduce((s, p) => s + p.annual_premium, 0) ?? 0;
  const totalCover = policies?.reduce((s, p) => s + p.sum_assured, 0) ?? 0;
  const annualIncome = user?.annual_ctc || 3000000;
  const recommendedCover = annualIncome * 10;
  const coverAdequacy = Math.min(100, totalCover > 0 ? (totalCover / recommendedCover) * 100 : 0);

  return (
    <AppLayout>
      <div className="space-y-6 animate-page-enter">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold text-text-primary">Insurance</h1>
            <p className="text-text-secondary text-sm mt-1">Policy management, documents & premium tracking</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" className="gap-2" onClick={() => setImportOpen(true)}>
              <Upload className="h-4 w-4" />
              <span className="hidden sm:inline">Import Policy</span>
            </Button>
            <Button onClick={() => setDialogOpen(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Add Policy</span>
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="card-enter card-enter-1">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-blue-500/10 flex items-center justify-center"><Shield className="h-6 w-6 text-blue-400" /></div>
              <div><p className="text-xs text-text-secondary uppercase tracking-wider">Total Policies</p><p className="text-xl font-display font-bold text-text-primary stat-number tabular-nums">{policies?.length ?? 0}</p></div>
            </CardContent>
          </Card>
          <Card className="card-enter card-enter-2">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-accent/10 flex items-center justify-center"><Clock className="h-6 w-6 text-accent-light" /></div>
              <div><p className="text-xs text-text-secondary uppercase tracking-wider">Annual Premium</p><p className="text-xl font-display font-bold text-accent-light stat-number tabular-nums">{formatCurrency(totalPremium)}</p></div>
            </CardContent>
          </Card>
          <Card className="card-enter card-enter-3">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-emerald-500/10 flex items-center justify-center"><CheckCircle className="h-6 w-6 text-emerald-400" /></div>
              <div><p className="text-xs text-text-secondary uppercase tracking-wider">Total Cover</p><p className="text-xl font-display font-bold text-emerald-400 stat-number tabular-nums">{formatCurrency(totalCover)}</p></div>
            </CardContent>
          </Card>
          <Card className="card-enter card-enter-4">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-rose-500/10 flex items-center justify-center"><AlertTriangle className="h-6 w-6 text-rose-400" /></div>
              <div>
                <p className="text-xs text-text-secondary uppercase tracking-wider">Cover Adequacy</p>
                <p className="text-xl font-display font-bold text-text-primary stat-number tabular-nums">{coverAdequacy.toFixed(0)}%</p>
                <Progress value={coverAdequacy} className="mt-1 h-1.5" indicatorClassName={coverAdequacy >= 80 ? "bg-emerald-400" : "bg-rose-400"} />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Policy Cards */}
        {policies === undefined ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">{[1, 2].map((i) => <div key={i} className="h-48 rounded-xl bg-gray-100 animate-pulse" />)}</div>
        ) : policies.length === 0 ? (
          <Card><CardContent className="p-12 text-center"><Shield className="h-12 w-12 text-gray-300 mx-auto mb-4" /><p className="text-text-secondary">No insurance policies yet. Import a policy document or add one manually.</p></CardContent></Card>
        ) : (
          <div className="space-y-4">
            {policies.map((policy) => (
              <PolicyCard
                key={policy._id}
                policy={policy}
                expanded={expandedPolicyId === policy._id}
                onToggle={() => setExpandedPolicyId(expandedPolicyId === policy._id ? null : policy._id)}
                onDelete={() => deletePolicy({ id: policy._id })}
              />
            ))}
          </div>
        )}

        {/* Import Dialog */}
        <Dialog open={importOpen} onOpenChange={(open) => !open && resetImport()}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Import Insurance Policy</DialogTitle></DialogHeader>

            {importResult ? (
              <div className="py-6 text-center space-y-4">
                <CheckCircle2 className="h-16 w-16 text-emerald-400 mx-auto" />
                <div>
                  <p className="text-lg font-semibold text-text-primary">{importResult}</p>
                  <p className="text-sm text-text-secondary mt-1">Policy document has been attached automatically.</p>
                </div>
                <Button onClick={resetImport}>Done</Button>
              </div>
            ) : importPreview ? (
              <div className="space-y-4">
                {/* Preview extracted data */}
                <div className="rounded-xl border border-accent/20 bg-accent/5 p-4">
                  <h3 className="text-sm font-semibold text-text-primary mb-3">Policy Details Extracted</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                    <div><span className="text-text-tertiary">Provider</span><p className="font-medium text-text-primary">{importPreview.policyDetails.provider}</p></div>
                    <div><span className="text-text-tertiary">Type</span><p className="font-medium text-text-primary capitalize">{importPreview.policyDetails.type}</p></div>
                    <div><span className="text-text-tertiary">Policy No</span><p className="font-medium text-text-primary font-mono text-[11px]">{importPreview.policyDetails.policy_number}</p></div>
                    <div><span className="text-text-tertiary">Sum Assured</span><p className="font-medium text-emerald-500 stat-number">{formatCurrency(importPreview.policyDetails.sum_assured || 0)}</p></div>
                    <div><span className="text-text-tertiary">Premium</span><p className="font-medium text-accent-light stat-number">{formatCurrency(importPreview.policyDetails.annual_premium || 0)}</p></div>
                    <div><span className="text-text-tertiary">Coverage</span><p className="font-medium text-text-primary">{importPreview.policyDetails.coverage_type || "-"}</p></div>
                    <div><span className="text-text-tertiary">Period</span><p className="font-medium text-text-primary">{importPreview.policyDetails.policy_start_date ? formatDate(importPreview.policyDetails.policy_start_date) : "-"} — {importPreview.policyDetails.policy_end_date ? formatDate(importPreview.policyDetails.policy_end_date) : "-"}</p></div>
                    {importPreview.policyDetails.ncb_percent != null && <div><span className="text-text-tertiary">NCB</span><p className="font-medium text-text-primary">{importPreview.policyDetails.ncb_percent}%</p></div>}
                    {importPreview.policyDetails.nominee && <div><span className="text-text-tertiary">Nominee</span><p className="font-medium text-text-primary">{importPreview.policyDetails.nominee}</p></div>}
                  </div>
                </div>

                {/* Vehicle details */}
                {importPreview.vehicle_details?.make && (
                  <div className="rounded-xl border border-gray-200 bg-gray-50/50 p-4">
                    <h3 className="text-sm font-semibold text-text-primary mb-2 flex items-center gap-2"><Car className="h-4 w-4 text-purple-400" />Vehicle Details</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                      {importPreview.vehicle_details.registration_no && <div><span className="text-text-tertiary">Reg. No</span><p className="font-medium font-mono">{importPreview.vehicle_details.registration_no}</p></div>}
                      <div><span className="text-text-tertiary">Make</span><p className="font-medium">{importPreview.vehicle_details.make}</p></div>
                      <div><span className="text-text-tertiary">Model</span><p className="font-medium">{importPreview.vehicle_details.model || importPreview.vehicle_details.variant}</p></div>
                      {importPreview.vehicle_details.idv && <div><span className="text-text-tertiary">IDV</span><p className="font-medium stat-number">{formatCurrency(importPreview.vehicle_details.idv)}</p></div>}
                      {importPreview.vehicle_details.fuel_type && <div><span className="text-text-tertiary">Fuel</span><p className="font-medium">{importPreview.vehicle_details.fuel_type}</p></div>}
                      {importPreview.vehicle_details.year && <div><span className="text-text-tertiary">Year</span><p className="font-medium">{importPreview.vehicle_details.year}</p></div>}
                    </div>
                  </div>
                )}

                {/* Insured members */}
                {importPreview.insured_members?.length > 0 && (
                  <div className="rounded-xl border border-gray-200 bg-gray-50/50 p-4">
                    <h3 className="text-sm font-semibold text-text-primary mb-2 flex items-center gap-2"><Users className="h-4 w-4 text-rose-400" />Insured Members ({importPreview.insured_members.length})</h3>
                    <div className="space-y-1.5">
                      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                      {importPreview.insured_members.map((m: any, i: number) => (
                        <div key={i} className="flex items-center justify-between text-xs bg-white rounded-lg px-3 py-2 border border-gray-100">
                          <span className="font-medium text-text-primary">{m.name}</span>
                          <div className="flex items-center gap-3 text-text-tertiary">
                            {m.relationship && <span>{m.relationship}</span>}
                            {m.age && <span>{m.age}y</span>}
                            {m.gender && <span>{m.gender}</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Add-ons */}
                {importPreview.add_ons?.length > 0 && (
                  <div className="rounded-xl border border-gray-200 bg-gray-50/50 p-4">
                    <h3 className="text-sm font-semibold text-text-primary mb-2">Add-On Covers ({importPreview.add_ons.length})</h3>
                    <div className="flex flex-wrap gap-1.5">
                      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                      {importPreview.add_ons.map((a: any, i: number) => (
                        <Badge key={i} className="text-[10px]">{a.name}</Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Existing policy match */}
                {importPreview.policyDetails.policy_number && policies?.some((p: PolicyDoc) => p.policy_number === importPreview.policyDetails.policy_number) && (
                  <div className="flex items-center gap-2 text-sm bg-amber-50 text-amber-700 rounded-xl px-4 py-3 border border-amber-200">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    Policy already exists — will update details
                  </div>
                )}

                <DialogFooter>
                  <Button variant="secondary" onClick={() => setImportPreview(null)}>Back</Button>
                  <Button onClick={handleImportConfirm} disabled={importSaving} className="gap-2">
                    {importSaving ? <><Loader2 className="h-4 w-4 animate-spin" />Importing...</> : <><CheckCircle2 className="h-4 w-4" />Confirm Import</>}
                  </Button>
                </DialogFooter>
              </div>
            ) : (
              <div className="space-y-4">
                {/* File upload */}
                <div
                  className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer ${importFile ? "border-accent/40 bg-accent/5" : "border-gray-200 hover:border-gray-300"}`}
                  onClick={() => importFileRef.current?.click()}
                >
                  <input ref={importFileRef} type="file" accept=".pdf,.xlsx,.xls" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) { setImportFile(f); setImportError(""); setImportPreview(null); setImportResult(null); } }} />
                  {importFile ? (
                    <div className="flex items-center justify-center gap-3">
                      <FileText className="h-8 w-8 text-accent-light" />
                      <div className="text-left"><p className="text-sm font-medium text-text-primary">{importFile.name}</p><p className="text-xs text-text-tertiary">{(importFile.size / 1024).toFixed(1)} KB</p></div>
                      <button onClick={(e) => { e.stopPropagation(); setImportFile(null); }} className="p-1 rounded hover:bg-gray-200"><X className="h-4 w-4" /></button>
                    </div>
                  ) : (
                    <>
                      <Upload className="h-10 w-10 text-gray-300 mx-auto mb-2" />
                      <p className="text-sm text-text-secondary">Upload insurance policy document (PDF)</p>
                      <p className="text-xs text-text-tertiary mt-1">Vehicle, Health, Term Life and other insurance policies</p>
                    </>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">File Password <span className="text-text-tertiary">(if encrypted)</span></Label>
                  <Input type="password" placeholder="Leave empty if not encrypted" value={importPassword} onChange={(e) => setImportPassword(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && importFile) handleImportParse(); }} />
                </div>

                {importError && (
                  <div className="flex items-center gap-2 text-rose text-sm bg-rose/5 rounded-xl px-4 py-3">
                    <AlertCircle className="h-4 w-4 shrink-0" />{importError}
                  </div>
                )}

                <DialogFooter>
                  <Button variant="secondary" onClick={resetImport}>Cancel</Button>
                  <Button onClick={handleImportParse} disabled={!importFile || importParsing} className="gap-2">
                    {importParsing ? <><Loader2 className="h-4 w-4 animate-spin" />Extracting...</> : <><FileText className="h-4 w-4" />Parse Policy</>}
                  </Button>
                </DialogFooter>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Manual Add Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>Add Insurance Policy</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Policy Type</Label><Select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} options={[{ value: "term", label: "Term Life" }, { value: "health", label: "Health" }, { value: "vehicle", label: "Vehicle" }, { value: "home", label: "Home" }, { value: "travel", label: "Travel" }]} /></div>
                <div className="space-y-2"><Label>Provider</Label><Input value={form.provider} onChange={(e) => setForm({ ...form, provider: e.target.value })} placeholder="Insurance company" /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Policy Number</Label><Input value={form.policy_number} onChange={(e) => setForm({ ...form, policy_number: e.target.value })} placeholder="Policy number" /></div>
                <div className="space-y-2"><Label>Sum Assured</Label><Input type="number" value={form.sum_assured} onChange={(e) => setForm({ ...form, sum_assured: e.target.value })} placeholder="0" /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Annual Premium</Label><Input type="number" value={form.annual_premium} onChange={(e) => setForm({ ...form, annual_premium: e.target.value })} placeholder="0" /></div>
                <div className="space-y-2"><Label>Next Due Date</Label><Input type="date" value={form.next_due_date} onChange={(e) => setForm({ ...form, next_due_date: e.target.value })} /></div>
              </div>
              <div className="space-y-2"><Label>Nominee</Label><Input value={form.nominee} onChange={(e) => setForm({ ...form, nominee: e.target.value })} placeholder="Nominee name" /></div>
            </div>
            <DialogFooter>
              <Button variant="secondary" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleSubmit} disabled={saving}>{saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving...</> : "Add Policy"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}

// ---------------------------------------------------------------------------
// PolicyCard sub-component
// ---------------------------------------------------------------------------

function PolicyCard({ policy, expanded, onToggle, onDelete }: {
  policy: PolicyDoc;
  expanded: boolean;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const daysUntil = getDaysUntil(policy.next_due_date);
  const Icon = typeIcons[policy.type] || Shield;
  const color = typeColors[policy.type] || "text-text-secondary";

  // Documents (only fetched when expanded)
  const docs = useQuery(api.insurance.getInsuranceDocuments, expanded ? { policyId: policy._id } : "skip");
  const generateUploadUrl = useMutation(api.insurance.generateUploadUrl);
  const saveDocument = useMutation(api.insurance.saveInsuranceDocument);
  const deleteDocument = useMutation(api.insurance.deleteInsuranceDocument);
  const { user } = useAuth();

  const [uploading, setUploading] = useState(false);
  const docInputRef = useRef<HTMLInputElement>(null);

  const handleDocUpload = async (file: File) => {
    if (!user) return;
    setUploading(true);
    try {
      const uploadUrl = await generateUploadUrl();
      const resp = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type || "application/pdf" },
        body: file,
      });
      if (resp.ok) {
        const { storageId } = await resp.json();
        await saveDocument({
          userId: user.userId,
          policyId: policy._id,
          storageId,
          name: file.name,
          file_size: file.size,
          file_type: file.type || "application/pdf",
        });
      }
    } finally {
      setUploading(false);
    }
  };

  return (
    <Card className="group relative">
      <button onClick={onDelete} className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity text-text-tertiary hover:text-rose-400 text-xs z-10">Remove</button>

      {/* Clickable header */}
      <div className="cursor-pointer" onClick={onToggle}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-2.5 rounded-lg bg-surface-tertiary ${color}`}><Icon className="h-5 w-5" /></div>
              <div>
                <CardTitle className="text-base">{policy.provider}</CardTitle>
                <div className="flex items-center gap-2 mt-1">
                  <p className="text-text-tertiary text-xs font-mono">{policy.policy_number}</p>
                  <Badge>{policy.coverage_type || policy.type}</Badge>
                  {policy.ncb_percent != null && policy.ncb_percent > 0 && <Badge variant="success">NCB {policy.ncb_percent}%</Badge>}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {daysUntil < 0 ? <Badge variant="destructive"><AlertTriangle className="h-3 w-3 mr-1" />Overdue</Badge>
                : daysUntil <= 30 ? <Badge variant="warning">{daysUntil}d</Badge>
                : <Badge variant="success"><CheckCircle className="h-3 w-3 mr-1" />{daysUntil}d</Badge>}
              {expanded ? <ChevronUp className="h-5 w-5 text-text-tertiary" /> : <ChevronDown className="h-5 w-5 text-text-tertiary" />}
            </div>
          </div>
        </CardHeader>

        <CardContent className="pb-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div><p className="text-text-tertiary text-xs">Sum Assured</p><p className="stat-number text-sm text-emerald-500">{formatCurrency(policy.sum_assured)}</p></div>
            <div><p className="text-text-tertiary text-xs">Annual Premium</p><p className="stat-number text-sm text-accent-light">{formatCurrency(policy.annual_premium)}</p></div>
            <div className="hidden sm:block"><p className="text-text-tertiary text-xs">Valid Until</p><p className="text-sm text-text-primary">{formatDate(policy.policy_end_date || policy.next_due_date)}</p></div>
            <div className="hidden sm:block"><p className="text-text-tertiary text-xs">Nominee</p><p className="text-sm text-text-primary">{policy.nominee || "-"}</p></div>
          </div>
        </CardContent>
      </div>

      {/* Expanded section */}
      {expanded && (
        <div className="border-t border-gray-100 animate-page-enter">
          <CardContent className="pt-4 space-y-4">
            {/* Vehicle details */}
            {policy.vehicle_details?.make && (
              <div className="rounded-lg bg-purple-50/50 p-4 border border-purple-100">
                <h3 className="text-xs font-semibold text-purple-600 uppercase tracking-wider mb-2 flex items-center gap-1.5"><Car className="h-3.5 w-3.5" />Vehicle Details</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  {policy.vehicle_details.registration_no && <div><span className="text-text-tertiary">Reg. No</span><p className="font-medium font-mono">{policy.vehicle_details.registration_no}</p></div>}
                  <div><span className="text-text-tertiary">Make</span><p className="font-medium">{policy.vehicle_details.make}</p></div>
                  <div><span className="text-text-tertiary">Model</span><p className="font-medium">{policy.vehicle_details.model || policy.vehicle_details.variant}</p></div>
                  {policy.vehicle_details.variant && <div><span className="text-text-tertiary">Variant</span><p className="font-medium">{policy.vehicle_details.variant}</p></div>}
                  {policy.vehicle_details.fuel_type && <div><span className="text-text-tertiary">Fuel</span><p className="font-medium flex items-center gap-1"><Fuel className="h-3 w-3" />{policy.vehicle_details.fuel_type}</p></div>}
                  {policy.vehicle_details.year && <div><span className="text-text-tertiary">Year</span><p className="font-medium">{policy.vehicle_details.year}</p></div>}
                  {policy.vehicle_details.idv && <div><span className="text-text-tertiary">IDV</span><p className="font-medium stat-number">{formatCurrency(policy.vehicle_details.idv)}</p></div>}
                  {policy.vehicle_details.body_type && <div><span className="text-text-tertiary">Body</span><p className="font-medium">{policy.vehicle_details.body_type}</p></div>}
                  {policy.vehicle_details.engine_no && <div><span className="text-text-tertiary">Engine No</span><p className="font-medium font-mono text-[10px]">{policy.vehicle_details.engine_no}</p></div>}
                  {policy.vehicle_details.chassis_no && <div><span className="text-text-tertiary">Chassis No</span><p className="font-medium font-mono text-[10px]">{policy.vehicle_details.chassis_no}</p></div>}
                </div>
              </div>
            )}

            {/* Insured members */}
            {policy.insured_members?.length > 0 && (
              <div className="rounded-lg bg-rose-50/50 p-4 border border-rose-100">
                <h3 className="text-xs font-semibold text-rose-500 uppercase tracking-wider mb-2 flex items-center gap-1.5"><Users className="h-3.5 w-3.5" />Insured Members ({policy.insured_members.length})</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead><tr className="text-text-tertiary text-left">
                      <th className="pb-1 pr-4 font-medium">Name</th>
                      <th className="pb-1 pr-4 font-medium">Relationship</th>
                      <th className="pb-1 pr-4 font-medium">Age</th>
                      <th className="pb-1 pr-4 font-medium">DOB</th>
                      <th className="pb-1 font-medium">Gender</th>
                    </tr></thead>
                    <tbody>
                      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                      {policy.insured_members.map((m: any, i: number) => (
                        <tr key={i} className="border-t border-rose-100/50">
                          <td className="py-1.5 pr-4 font-medium text-text-primary">{m.name}</td>
                          <td className="py-1.5 pr-4 text-text-secondary">{m.relationship || "-"}</td>
                          <td className="py-1.5 pr-4 text-text-secondary">{m.age || "-"}</td>
                          <td className="py-1.5 pr-4 text-text-secondary">{m.dob ? formatDate(m.dob) : "-"}</td>
                          <td className="py-1.5 text-text-secondary">{m.gender || "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Add-ons */}
            {policy.add_ons?.length > 0 && (
              <div className="rounded-lg bg-amber-50/50 p-4 border border-amber-100">
                <h3 className="text-xs font-semibold text-amber-600 uppercase tracking-wider mb-2">Add-On Covers ({policy.add_ons.length})</h3>
                <div className="space-y-1">
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  {policy.add_ons.map((a: any, i: number) => (
                    <div key={i} className="flex items-start gap-2 text-xs">
                      <CheckCircle className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-medium text-text-primary">{a.name}</span>
                        {a.details && <span className="text-text-tertiary ml-1">— {a.details}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Premium breakdown */}
            {policy.premium_breakdown && (
              <div className="rounded-lg bg-accent/5 p-4 border border-accent/15">
                <h3 className="text-xs font-semibold text-accent-light uppercase tracking-wider mb-2">Premium Breakdown</h3>
                <div className="grid grid-cols-3 gap-4 text-xs">
                  <div><span className="text-text-tertiary">Net Premium</span><p className="font-medium stat-number">{formatCurrency(policy.premium_breakdown.net_premium)}</p></div>
                  <div><span className="text-text-tertiary">GST</span><p className="font-medium stat-number">{formatCurrency(policy.premium_breakdown.gst)}</p></div>
                  <div><span className="text-text-tertiary">Total Premium</span><p className="font-medium stat-number text-accent-light">{formatCurrency(policy.premium_breakdown.total_premium)}</p></div>
                </div>
              </div>
            )}

            {/* Extra info */}
            <div className="flex flex-wrap gap-4 text-xs text-text-secondary">
              {policy.policy_start_date && <span>Start: {formatDate(policy.policy_start_date)}</span>}
              {policy.financier && <span>Financier: {policy.financier}</span>}
              {policy.previous_insurer && <span>Previous: {policy.previous_insurer}</span>}
              {policy.deductible != null && policy.deductible > 0 && <span>Deductible: {formatCurrency(policy.deductible)}</span>}
              {policy.policy_category && <span className="capitalize">{policy.policy_category}</span>}
            </div>

            {/* Documents */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-text-primary flex items-center gap-1.5"><Paperclip className="h-4 w-4 text-text-tertiary" />Documents</h3>
                <div>
                  <input ref={docInputRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleDocUpload(f); }} />
                  <Button variant="outline" size="sm" className="text-xs gap-1.5" onClick={() => docInputRef.current?.click()} disabled={uploading}>
                    {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
                    Upload
                  </Button>
                </div>
              </div>
              {docs === undefined ? (
                <div className="flex items-center justify-center py-4"><Loader2 className="h-4 w-4 animate-spin text-text-tertiary" /></div>
              ) : docs.length === 0 ? (
                <p className="text-xs text-text-tertiary py-2">No documents attached yet.</p>
              ) : (
                <div className="space-y-1.5">
                  {docs.map((doc) => (
                    <div key={doc._id} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2 border border-gray-100">
                      <div className="flex items-center gap-2 min-w-0">
                        <FileText className="h-4 w-4 text-text-tertiary shrink-0" />
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-text-primary truncate">{doc.name}</p>
                          <p className="text-[10px] text-text-tertiary">{(doc.file_size / 1024).toFixed(1)} KB</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        {doc.url && (
                          <a href={doc.url} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded-lg hover:bg-gray-200 text-text-tertiary hover:text-text-primary transition-colors">
                            <Download className="h-3.5 w-3.5" />
                          </a>
                        )}
                        <button onClick={() => deleteDocument({ id: doc._id })} className="p-1.5 rounded-lg hover:bg-rose-50 text-text-tertiary hover:text-rose-400 transition-colors">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </div>
      )}
    </Card>
  );
}
