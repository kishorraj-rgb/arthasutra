"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth-context";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { User, Calculator, Receipt, Bell, Download, Loader2, CheckCircle2, Tags, ChevronUp, ChevronDown, Eye, EyeOff, RotateCcw, Plus, X, Save, Trash2, Home, UtensilsCrossed, Car, Heart, GraduationCap, Shield as ShieldIcon, TrendingUp, Zap, Film, ShoppingCart, ShoppingBag, Shirt, Sparkles, CreditCard, Landmark, Plane, Smartphone, Users as UsersIcon, Banknote, ArrowLeftRight, MoreHorizontal, Wallet, DollarSign, Building, Coins, ReceiptText } from "lucide-react";
import { EXPENSE_CATEGORIES, INCOME_TYPES, CATEGORY_COLORS, getMergedCategories } from "@/lib/utils";
import { BankLogo, BANK_PRESETS, BANK_PRESET_IDS } from "@/components/bank-logo";
import type { Id } from "../../../convex/_generated/dataModel";

// Icon mapping for categories
const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Home, UtensilsCrossed, Car, Heart, GraduationCap, Shield: ShieldIcon, TrendingUp, Zap, Film,
  ShoppingCart, ShoppingBag, Shirt, Sparkles, CreditCard, Landmark, Plane, Smartphone,
  Users: UsersIcon, Banknote, ArrowLeftRight, MoreHorizontal, Wallet, DollarSign, Building,
  Coins, Receipt: ReceiptText, User, School: GraduationCap, Save,
};

const SLUG_ICONS: Record<string, string> = {
  housing: "Home", food: "UtensilsCrossed", transport: "Car", medical: "Heart",
  education: "GraduationCap", insurance: "Shield", investment: "TrendingUp",
  driver_salary: "Users", school_fees: "GraduationCap", utilities: "Zap",
  entertainment: "Film", clothing: "Shirt", grocery: "ShoppingCart",
  shopping: "ShoppingBag", personal_care: "Sparkles", subscription: "CreditCard",
  donation: "Heart", emi: "Landmark", rent: "Home", travel: "Plane",
  tax_payment: "Receipt", credit_card_bill: "CreditCard", recharge: "Smartphone",
  household: "Users", cash_withdrawal: "Banknote", transfer: "ArrowLeftRight",
  other: "MoreHorizontal",
  salary: "Wallet", freelance: "DollarSign", rental: "Building", interest: "Coins",
  dividend: "TrendingUp", refund: "ArrowLeftRight", reimbursement: "Banknote",
};

function CategoryIcon({ slug, className, color }: { slug: string; className?: string; color?: string }) {
  const iconName = SLUG_ICONS[slug] || "MoreHorizontal";
  const IconComp = ICON_MAP[iconName] || MoreHorizontal;
  return <span style={{ color }}><IconComp className={className} /></span>;
}

// ---------------------------------------------------------------------------
// Section navigation config
// ---------------------------------------------------------------------------
const SECTIONS = [
  { id: "profile", label: "Profile & Tax", icon: User },
  { id: "banks", label: "Bank Accounts", icon: Landmark },
  { id: "categories", label: "Categories", icon: Tags },
  { id: "preferences", label: "Preferences", icon: Bell },
] as const;

type SectionId = (typeof SECTIONS)[number]["id"];

export default function SettingsPage() {
  const { user } = useAuth();
  const profile = useQuery(api.users.getUser, user ? { userId: user.userId } : "skip");
  const updateProfile = useMutation(api.users.updateUserProfile);

  const [activeSection, setActiveSection] = useState<SectionId>("profile");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [pan, setPan] = useState("");
  const [aadhaar, setAadhaar] = useState("");
  const [userType, setUserType] = useState("both");
  const [annualCTC, setAnnualCTC] = useState("");
  const [monthlySalary, setMonthlySalary] = useState("");
  const [regime, setRegime] = useState("new");
  const [gstRegistered, setGstRegistered] = useState(false);
  const [gstin, setGstin] = useState("");
  const [fyStart, setFyStart] = useState("april");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Category Manager state
  const expenseCatPrefs = useQuery(api.categories.getCategoryPreferences, user ? { userId: user.userId, scope: "expense" as const } : "skip");
  const incomeCatPrefs = useQuery(api.categories.getCategoryPreferences, user ? { userId: user.userId, scope: "income" as const } : "skip");
  const batchSaveCategories = useMutation(api.categories.batchSaveCategoryPreferences);
  const resetCategories = useMutation(api.categories.resetCategoryPreferences);

  type CatItem = { slug: string; label: string; icon: string; color: string; hidden: boolean; sort_order: number; subcategories: string[] };

  const [expenseCats, setExpenseCats] = useState<CatItem[]>([]);
  const [incomeCats, setIncomeCats] = useState<CatItem[]>([]);
  const [catSaving, setCatSaving] = useState(false);
  const [catSaved, setCatSaved] = useState(false);
  const [newSubcategory, setNewSubcategory] = useState<Record<string, string>>({});

  // Bank Accounts Manager state
  const bankAccounts = useQuery(api.bankAccounts.getBankAccounts, user ? { userId: user.userId } : "skip");
  const addBankAccount = useMutation(api.bankAccounts.addBankAccount);
  const updateBankAccount = useMutation(api.bankAccounts.updateBankAccount);
  const deleteBankAccount = useMutation(api.bankAccounts.deleteBankAccount);
  const seedDefaultBanks = useMutation(api.bankAccounts.seedDefaultBanks);

  const [bankSeeded, setBankSeeded] = useState(false);
  useEffect(() => {
    if (user && bankAccounts !== undefined && bankAccounts.length === 0 && !bankSeeded) {
      setBankSeeded(true);
      seedDefaultBanks({ userId: user.userId });
    }
  }, [user, bankAccounts, bankSeeded, seedDefaultBanks]);

  const [showAddBank, setShowAddBank] = useState(false);
  const [bankSaving, setBankSaving] = useState(false);
  const [newBank, setNewBank] = useState({
    bank_name: "", display_name: "", account_last4: "", ifsc_code: "", logo_id: "", logo_color: "", account_type: "internal" as "internal" | "external",
  });

  const handleAddBank = async () => {
    if (!user || !newBank.bank_name || !newBank.display_name || !newBank.logo_id) return;
    setBankSaving(true);
    try {
      await addBankAccount({
        userId: user.userId, bank_name: newBank.bank_name, display_name: newBank.display_name,
        account_last4: newBank.account_last4 || undefined, ifsc_code: newBank.ifsc_code || undefined,
        logo_id: newBank.logo_id, logo_color: newBank.logo_color || undefined,
        account_type: newBank.account_type, sort_order: (bankAccounts?.length ?? 0),
      });
      setNewBank({ bank_name: "", display_name: "", account_last4: "", ifsc_code: "", logo_id: "", logo_color: "", account_type: "internal" });
      setShowAddBank(false);
    } finally { setBankSaving(false); }
  };

  const handleDeleteBank = async (id: Id<"bank_accounts">) => {
    if (!confirm("Remove this bank account?")) return;
    await deleteBankAccount({ id });
  };

  const handleToggleBankActive = async (id: Id<"bank_accounts">, isActive: boolean) => {
    await updateBankAccount({ id, is_active: isActive });
  };

  // Category helpers — merge defaults with prefs, including custom categories
  function buildCatList(
    defaults: ReadonlyArray<{ value: string; label: string; icon?: string }>,
    prefs: Array<{ slug: string; label: string; icon?: string; color?: string; hidden: boolean; sort_order: number; subcategories?: string[] }> | undefined
  ): CatItem[] {
    if (!prefs) return [];
    const merged = getMergedCategories(defaults, prefs.map((p) => ({ ...p, subcategories: p.subcategories || [] })));
    const result: CatItem[] = merged.map((c) => {
      const pref = prefs.find((p) => p.slug === c.value);
      return { slug: c.value, label: c.label, icon: c.icon, color: c.color || CATEGORY_COLORS[c.value] || "#6B7280", hidden: c.hidden, sort_order: c.sort_order, subcategories: pref?.subcategories || [] };
    });

    // Append custom categories that aren't in defaults (e.g. "Bank Charges")
    const defaultSlugs = new Set(defaults.map((d) => d.value));
    for (const pref of prefs) {
      if (!defaultSlugs.has(pref.slug)) {
        result.push({
          slug: pref.slug, label: pref.label, icon: pref.icon || "MoreHorizontal",
          color: pref.color || "#6B7280", hidden: pref.hidden, sort_order: pref.sort_order,
          subcategories: pref.subcategories || [],
        });
      }
    }

    return result.sort((a, b) => a.sort_order - b.sort_order);
  }

  useEffect(() => {
    if (expenseCatPrefs !== undefined) setExpenseCats(buildCatList(EXPENSE_CATEGORIES, expenseCatPrefs));
  }, [expenseCatPrefs]);

  useEffect(() => {
    if (incomeCatPrefs !== undefined) setIncomeCats(buildCatList(INCOME_TYPES as unknown as Array<{ value: string; label: string; icon?: string }>, incomeCatPrefs));
  }, [incomeCatPrefs]);

  const moveCategory = (list: CatItem[], setList: (v: CatItem[]) => void, index: number, direction: "up" | "down") => {
    const newList = [...list];
    const target = direction === "up" ? index - 1 : index + 1;
    if (target < 0 || target >= newList.length) return;
    [newList[index], newList[target]] = [newList[target], newList[index]];
    setList(newList.map((c, i) => ({ ...c, sort_order: i })));
  };
  const toggleHidden = (list: CatItem[], setList: (v: CatItem[]) => void, index: number) => {
    const newList = [...list]; newList[index] = { ...newList[index], hidden: !newList[index].hidden }; setList(newList);
  };
  const updateLabel = (list: CatItem[], setList: (v: CatItem[]) => void, index: number, label: string) => {
    const newList = [...list]; newList[index] = { ...newList[index], label }; setList(newList);
  };
  const addSubcategory = (list: CatItem[], setList: (v: CatItem[]) => void, index: number, sub: string) => {
    if (!sub.trim()) return; const newList = [...list]; const existing = newList[index].subcategories || [];
    if (existing.includes(sub.trim())) return;
    newList[index] = { ...newList[index], subcategories: [...existing, sub.trim()] }; setList(newList);
  };
  const removeSubcategory = (list: CatItem[], setList: (v: CatItem[]) => void, catIndex: number, subIndex: number) => {
    const newList = [...list]; const subs = [...(newList[catIndex].subcategories || [])]; subs.splice(subIndex, 1);
    newList[catIndex] = { ...newList[catIndex], subcategories: subs }; setList(newList);
  };
  const addNewCategory = (list: CatItem[], setList: (v: CatItem[]) => void) => {
    setList([...list, { slug: `custom_${Date.now()}`, label: "New Category", icon: "MoreHorizontal", color: "#6B7280", hidden: false, sort_order: list.length, subcategories: [] }]);
  };
  const deleteCategory = (list: CatItem[], setList: (v: CatItem[]) => void, index: number) => {
    setList(list.filter((_, i) => i !== index).map((c, i) => ({ ...c, sort_order: i })));
  };
  const handleSaveCategories = async (scope: "expense" | "income", cats: CatItem[]) => {
    if (!user) return; setCatSaving(true);
    try {
      await batchSaveCategories({ userId: user.userId, scope, categories: cats.map((c) => ({ slug: c.slug, label: c.label, icon: c.icon, color: c.color, sort_order: c.sort_order, hidden: c.hidden, subcategories: c.subcategories.length > 0 ? c.subcategories : undefined })) });
      setCatSaved(true); setTimeout(() => setCatSaved(false), 2000);
    } finally { setCatSaving(false); }
  };
  const handleResetCategories = async (scope: "expense" | "income") => { if (!user) return; await resetCategories({ userId: user.userId, scope }); };

  // Profile
  useEffect(() => {
    if (profile) {
      setName(profile.name || ""); setEmail(profile.email || ""); setPan(profile.pan_number || "");
      setAadhaar(profile.aadhaar_last4 || ""); setUserType(profile.user_type || "both");
      setAnnualCTC(profile.annual_ctc?.toString() || ""); setMonthlySalary(profile.monthly_salary?.toString() || "");
      setRegime(profile.regime_preference || "new"); setGstRegistered(profile.gst_registered || false);
      setGstin(profile.gstin || ""); setFyStart(profile.financial_year_start || "april");
    }
  }, [profile]);

  const handleSave = async () => {
    if (!user) return; setSaving(true);
    try {
      await updateProfile({
        userId: user.userId, name: name || undefined, pan_number: pan || undefined, aadhaar_last4: aadhaar || undefined,
        user_type: userType as "employee" | "consultant" | "both", annual_ctc: annualCTC ? Number(annualCTC) : undefined,
        monthly_salary: monthlySalary ? Number(monthlySalary) : undefined, regime_preference: regime as "old" | "new",
        gst_registered: gstRegistered, gstin: gstin || undefined, financial_year_start: fyStart || undefined,
      });
      setSaved(true); setTimeout(() => setSaved(false), 2000);
    } catch (err) { console.error("Failed to save:", err); } finally { setSaving(false); }
  };

  const profileFields = [
    { filled: !!name, label: "Full Name" }, { filled: !!pan, label: "PAN Number" },
    { filled: !!aadhaar, label: "Aadhaar" }, { filled: !!annualCTC || userType === "consultant", label: "Annual CTC" },
    { filled: !!regime, label: "Tax Regime" }, { filled: gstRegistered ? !!gstin : true, label: "GSTIN" },
  ];
  const completedFields = profileFields.filter((f) => f.filled).length;
  const profilePct = Math.round((completedFields / profileFields.length) * 100);

  // ---------------------------------------------------------------------------
  // Category list renderer (shared between expense/income)
  // ---------------------------------------------------------------------------
  function renderCategoryList(cats: CatItem[], setCats: (v: CatItem[]) => void, scope: "expense" | "income") {
    const accentColor = scope === "expense" ? "accent" : "emerald";
    return (
      <>
        <div className="space-y-1.5 max-h-[60vh] overflow-y-auto pr-1">
          {cats.map((cat, index) => (
            <div key={cat.slug} className={`rounded-lg border p-3 transition-all ${cat.hidden ? "border-gray-100 bg-gray-50/50 opacity-50" : "border-gray-200 bg-white"}`}>
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-8 h-8 rounded-lg shrink-0" style={{ backgroundColor: cat.color + "20" }}>
                  <CategoryIcon slug={cat.slug} className="h-4 w-4" color={cat.color} />
                </div>
                <Input value={cat.label} onChange={(e) => updateLabel(cats, setCats, index, e.target.value)} className="h-8 text-sm font-medium flex-1 max-w-[200px]" />
                <div className="flex items-center gap-1 ml-auto">
                  <button onClick={() => toggleHidden(cats, setCats, index)} className="p-1.5 rounded-md hover:bg-gray-100 transition-colors">
                    {cat.hidden ? <EyeOff className="h-4 w-4 text-gray-400" /> : <Eye className={`h-4 w-4 text-${accentColor}`} />}
                  </button>
                  <button onClick={() => moveCategory(cats, setCats, index, "up")} disabled={index === 0} className="p-1.5 rounded-md hover:bg-gray-100 disabled:opacity-20"><ChevronUp className="h-4 w-4" /></button>
                  <button onClick={() => moveCategory(cats, setCats, index, "down")} disabled={index === cats.length - 1} className="p-1.5 rounded-md hover:bg-gray-100 disabled:opacity-20"><ChevronDown className="h-4 w-4" /></button>
                  <button onClick={() => deleteCategory(cats, setCats, index)} className="p-1.5 rounded-md hover:bg-rose-50 text-gray-400 hover:text-rose transition-colors"><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>
              <div className="mt-2 ml-11 space-y-2">
                {(cat.subcategories || []).length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {cat.subcategories.map((sub, si) => (
                      <span key={si} className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-${accentColor}/8 text-${accentColor} text-xs font-medium border border-${accentColor}/15`}>
                        {sub}
                        <button onClick={() => removeSubcategory(cats, setCats, index, si)} className="hover:text-rose ml-0.5"><X className="h-3 w-3" /></button>
                      </span>
                    ))}
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <input
                    value={newSubcategory[cat.slug] || ""} onChange={(e) => setNewSubcategory({ ...newSubcategory, [cat.slug]: e.target.value })}
                    onKeyDown={(e) => { if (e.key === "Enter" && (newSubcategory[cat.slug] || "").trim()) { e.preventDefault(); addSubcategory(cats, setCats, index, newSubcategory[cat.slug] || ""); setNewSubcategory({ ...newSubcategory, [cat.slug]: "" }); } }}
                    placeholder="Add subcategory..." className="flex-1 max-w-[200px] h-7 px-2.5 text-xs rounded-lg border border-gray-200 bg-gray-50 placeholder:text-gray-400 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/20 focus:bg-white"
                  />
                  <button onClick={() => { if ((newSubcategory[cat.slug] || "").trim()) { addSubcategory(cats, setCats, index, newSubcategory[cat.slug] || ""); setNewSubcategory({ ...newSubcategory, [cat.slug]: "" }); } }}
                    className={`h-7 px-2.5 rounded-lg bg-${accentColor}/10 text-${accentColor} hover:bg-${accentColor}/20 text-xs font-medium transition-colors flex items-center gap-1`}>
                    <Plus className="h-3 w-3" /> Add
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
          <div className="flex items-center gap-3">
            <Button size="sm" variant="outline" onClick={() => addNewCategory(cats, setCats)}>
              <Plus className="h-4 w-4 mr-1" /> Add {scope === "expense" ? "Category" : "Type"}
            </Button>
            <button onClick={() => handleResetCategories(scope)} className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors">
              <RotateCcw className="h-3.5 w-3.5" /> Reset
            </button>
          </div>
          <Button size="sm" onClick={() => handleSaveCategories(scope, cats)} disabled={catSaving}>
            {catSaving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
            {catSaved ? "Saved!" : "Save All"}
          </Button>
        </div>
      </>
    );
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <AppLayout>
      <div className="animate-page-enter">
        {/* Header */}
        <div className="mb-6">
          <h1 className="font-display text-2xl font-bold text-text-primary">Settings</h1>
          <p className="text-text-secondary text-sm mt-1">Manage your profile, bank accounts & preferences</p>
        </div>

        {/* Section Navigation */}
        <div className="flex items-center gap-1 mb-6 border-b border-gray-200 overflow-x-auto">
          {SECTIONS.map((section) => {
            const Icon = section.icon;
            const isActive = activeSection === section.id;
            return (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-all ${
                  isActive
                    ? "border-accent text-accent"
                    : "border-transparent text-text-tertiary hover:text-text-secondary hover:border-gray-300"
                }`}
              >
                <Icon className="h-4 w-4" />
                {section.label}
              </button>
            );
          })}
        </div>

        {/* ================================================================ */}
        {/* SECTION: Profile & Tax */}
        {/* ================================================================ */}
        {activeSection === "profile" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-page-enter">
            <div className="lg:col-span-2 space-y-6">
              {/* Profile */}
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <User className="h-5 w-5 text-accent-light" />
                    <CardTitle>Personal Information</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Full Name</Label>
                      <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
                    </div>
                    <div className="space-y-2">
                      <Label>Email</Label>
                      <Input value={email} disabled className="opacity-50 cursor-not-allowed" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>PAN Number</Label>
                      <Input value={pan} onChange={(e) => setPan(e.target.value.toUpperCase())} placeholder="ABCDE1234F" maxLength={10} />
                    </div>
                    <div className="space-y-2">
                      <Label>Aadhaar (Last 4)</Label>
                      <Input value={aadhaar} onChange={(e) => setAadhaar(e.target.value)} placeholder="1234" maxLength={4} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>I am a</Label>
                    <Select value={userType} onChange={(e) => setUserType(e.target.value)} options={[
                      { value: "employee", label: "Salaried Employee" },
                      { value: "consultant", label: "Consultant / Freelancer" },
                      { value: "both", label: "Both" },
                    ]} />
                  </div>
                  {(userType === "employee" || userType === "both") && (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Annual CTC</Label>
                        <Input type="number" value={annualCTC} onChange={(e) => setAnnualCTC(e.target.value)} placeholder="0" />
                      </div>
                      <div className="space-y-2">
                        <Label>Monthly In-Hand</Label>
                        <Input type="number" value={monthlySalary} onChange={(e) => setMonthlySalary(e.target.value)} placeholder="0" />
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Tax + GST combined */}
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <Calculator className="h-5 w-5 text-accent-light" />
                    <CardTitle>Tax & GST</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Tax Regime</Label>
                      <Select value={regime} onChange={(e) => setRegime(e.target.value)} options={[
                        { value: "old", label: "Old Regime (deductions)" },
                        { value: "new", label: "New Regime (lower rates)" },
                      ]} />
                    </div>
                    <div className="space-y-2">
                      <Label>Financial Year Start</Label>
                      <Select value={fyStart} onChange={(e) => setFyStart(e.target.value)} options={[{ value: "april", label: "April (Standard)" }]} />
                    </div>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border border-gray-200 px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-text-primary">GST Registered</p>
                      <p className="text-xs text-text-tertiary">Enable if registered under GST</p>
                    </div>
                    <Switch checked={gstRegistered} onCheckedChange={setGstRegistered} />
                  </div>
                  {gstRegistered && (
                    <div className="grid grid-cols-2 gap-4 pt-1">
                      <div className="space-y-2">
                        <Label>GSTIN</Label>
                        <Input value={gstin} onChange={(e) => setGstin(e.target.value.toUpperCase())} placeholder="15-digit GSTIN" maxLength={15} />
                      </div>
                      <div className="space-y-2">
                        <Label>Default GST Rate</Label>
                        <Select options={[{ value: "5", label: "5%" }, { value: "12", label: "12%" }, { value: "18", label: "18% (Services)" }, { value: "28", label: "28%" }]} defaultValue="18" />
                      </div>
                    </div>
                  )}
                  <div className="flex justify-end pt-2">
                    <Button onClick={handleSave} disabled={saving}>
                      {saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving...</> : saved ? "Saved!" : "Save Changes"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Profile sidebar */}
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="h-5 w-5 text-accent-light" />
                    <CardTitle className="text-base">Profile Completion</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-text-secondary">Completed</span>
                    <span className="font-display font-bold text-accent-light">{profilePct}%</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2.5">
                    <div className="bg-accent h-2.5 rounded-full transition-all duration-500" style={{ width: `${profilePct}%` }} />
                  </div>
                  <div className="space-y-1.5 pt-1">
                    {profileFields.map((f) => (
                      <div key={f.label} className="flex items-center gap-2 text-xs">
                        <div className={`h-1.5 w-1.5 rounded-full ${f.filled ? "bg-emerald-400" : "bg-gray-300"}`} />
                        <span className={f.filled ? "text-text-secondary" : "text-text-tertiary"}>{f.label}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* ================================================================ */}
        {/* SECTION: Bank Accounts */}
        {/* ================================================================ */}
        {activeSection === "banks" && (
          <div className="max-w-3xl animate-page-enter">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Landmark className="h-5 w-5 text-accent-light" />
                    <CardTitle>Bank Accounts</CardTitle>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => { setShowAddBank(true); setNewBank({ ...newBank, account_type: "internal" }); }}>
                    <Plus className="h-4 w-4 mr-1" /> Add Account
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {/* Bank grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {(bankAccounts ?? [])
                    .sort((a, b) => a.sort_order - b.sort_order)
                    .map((bank) => (
                      <div
                        key={bank._id}
                        className={`rounded-xl border p-4 transition-all ${
                          bank.is_active ? "border-gray-200 bg-white hover:shadow-sm" : "border-gray-100 bg-gray-50/50 opacity-50"
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <BankLogo bankId={bank.logo_id} size="lg" customColor={bank.logo_color || undefined} />
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-sm text-text-primary">{bank.bank_name}</div>
                            <div className="text-xs text-text-tertiary mt-0.5">{bank.display_name}</div>
                            <div className="flex items-center gap-2 mt-1.5">
                              {bank.account_last4 && (
                                <span className="text-[11px] text-text-tertiary bg-gray-100 px-2 py-0.5 rounded-md">**** {bank.account_last4}</span>
                              )}
                              <Badge variant="secondary" className="text-[10px]">
                                {bank.account_type === "internal" ? "My Account" : "Beneficiary"}
                              </Badge>
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-2">
                            <Switch checked={bank.is_active} onCheckedChange={(v) => handleToggleBankActive(bank._id, v)} />
                            <button onClick={() => handleDeleteBank(bank._id)} className="p-1 rounded-md hover:bg-rose-50 text-gray-400 hover:text-rose transition-colors">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                </div>

                {(bankAccounts ?? []).length === 0 && (
                  <div className="text-center py-12 text-sm text-text-tertiary">
                    No bank accounts added yet. Click &quot;Add Account&quot; to get started.
                  </div>
                )}

                {/* Add Bank Form */}
                {showAddBank && (
                  <div className="mt-6 rounded-xl border border-accent/20 bg-accent/[0.03] p-5 space-y-4 animate-page-enter">
                    <h4 className="text-sm font-semibold text-text-primary">Add Bank Account</h4>

                    {/* Logo Picker */}
                    <div className="space-y-2">
                      <Label className="text-xs">Select Bank</Label>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {BANK_PRESET_IDS.map((id) => (
                          <button key={id} onClick={() => setNewBank({ ...newBank, logo_id: id, bank_name: BANK_PRESETS[id].name })}
                            className={`flex items-center gap-2 rounded-xl px-3 py-2.5 border text-xs transition-all ${
                              newBank.logo_id === id ? "border-accent bg-accent/5 text-accent shadow-sm" : "border-gray-200 bg-white text-text-secondary hover:border-gray-300"
                            }`}>
                            <BankLogo bankId={id} size="xs" />
                            <span className="truncate">{BANK_PRESETS[id].name}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs">Bank Name</Label>
                        <Input value={newBank.bank_name} onChange={(e) => setNewBank({ ...newBank, bank_name: e.target.value })} placeholder="e.g. ICICI Bank" className="h-9 text-sm" />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Display Name</Label>
                        <Input value={newBank.display_name} onChange={(e) => setNewBank({ ...newBank, display_name: e.target.value })} placeholder="e.g. Primary Savings" className="h-9 text-sm" />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Account No (last 4)</Label>
                        <Input value={newBank.account_last4} onChange={(e) => setNewBank({ ...newBank, account_last4: e.target.value })} placeholder="1234" maxLength={4} className="h-9 text-sm" />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Account Type</Label>
                        <Select value={newBank.account_type} onChange={(e) => setNewBank({ ...newBank, account_type: e.target.value as "internal" | "external" })}
                          options={[{ value: "internal", label: "My Account" }, { value: "external", label: "Beneficiary" }]} className="h-9" />
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      <Button size="sm" onClick={handleAddBank} disabled={bankSaving || !newBank.bank_name || !newBank.display_name || !newBank.logo_id}>
                        {bankSaving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />} Save
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setShowAddBank(false)}>Cancel</Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* ================================================================ */}
        {/* SECTION: Categories */}
        {/* ================================================================ */}
        {activeSection === "categories" && (
          <div className="max-w-3xl animate-page-enter">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <Tags className="h-5 w-5 text-accent-light" />
                  <CardTitle>Categories & Subcategories</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="expense">
                  <TabsList className="mb-4">
                    <TabsTrigger value="expense">Expense ({expenseCats.filter(c => !c.hidden).length} active)</TabsTrigger>
                    <TabsTrigger value="income">Income ({incomeCats.filter(c => !c.hidden).length} active)</TabsTrigger>
                  </TabsList>
                  <TabsContent value="expense">{renderCategoryList(expenseCats, setExpenseCats, "expense")}</TabsContent>
                  <TabsContent value="income">{renderCategoryList(incomeCats, setIncomeCats, "income")}</TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ================================================================ */}
        {/* SECTION: Preferences (Notifications + Export) */}
        {/* ================================================================ */}
        {activeSection === "preferences" && (
          <div className="max-w-3xl space-y-6 animate-page-enter">
            {/* Notifications */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <Bell className="h-5 w-5 text-accent-light" />
                  <CardTitle>Notifications</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-1">
                {[
                  { label: "Advance Tax Reminders", desc: "7 days before due date", default: true },
                  { label: "GST Filing Reminders", desc: "3 days before due date", default: true },
                  { label: "Insurance Premium Due", desc: "15 days before renewal", default: true },
                  { label: "EMI Due Date", desc: "3 days before EMI date", default: true },
                  { label: "Weekly Investment Review", desc: "Every Monday morning", default: false },
                  { label: "Monthly Financial Summary", desc: "1st of every month", default: true },
                ].map((item) => (
                  <div key={item.label} className="flex items-center justify-between py-3 border-b border-border-light last:border-0">
                    <div>
                      <p className="text-sm text-text-primary">{item.label}</p>
                      <p className="text-xs text-text-tertiary">{item.desc}</p>
                    </div>
                    <Switch defaultChecked={item.default} />
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Data Export */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <Download className="h-5 w-5 text-accent-light" />
                  <CardTitle>Data & Export</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-1">
                {[
                  { label: "Export Income Data", desc: "Download all income entries as CSV" },
                  { label: "Export Expense Data", desc: "Download all expense entries as CSV" },
                  { label: "Export Tax Report", desc: "Download tax computation sheet" },
                ].map((item) => (
                  <div key={item.label} className="flex items-center justify-between py-3 border-b border-border-light last:border-0">
                    <div>
                      <p className="text-sm text-text-primary">{item.label}</p>
                      <p className="text-xs text-text-tertiary">{item.desc}</p>
                    </div>
                    <Button variant="outline" size="sm"><Download className="h-3.5 w-3.5 mr-1.5" /> Export</Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
