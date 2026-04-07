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
import { User, Calculator, Receipt, Bell, Download, Loader2, Lightbulb, Calendar, CheckCircle2, Tags, ChevronUp, ChevronDown, Eye, EyeOff, RotateCcw, Plus, X, Save, Trash2, Home, UtensilsCrossed, Car, Heart, GraduationCap, Shield as ShieldIcon, TrendingUp, Zap, Film, ShoppingCart, ShoppingBag, Shirt, Sparkles, CreditCard, Landmark, Plane, Smartphone, Users as UsersIcon, Banknote, ArrowLeftRight, MoreHorizontal, Wallet, DollarSign, Building, Coins, ReceiptText } from "lucide-react";
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

// Slug-to-icon name mapping
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

export default function SettingsPage() {
  const { user } = useAuth();
  const profile = useQuery(api.users.getUser, user ? { userId: user.userId } : "skip");
  const updateProfile = useMutation(api.users.updateUserProfile);

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

  // Auto-seed default banks (ICICI, HDFC, Axis, SBI) on first visit
  const [bankSeeded, setBankSeeded] = useState(false);
  useEffect(() => {
    if (user && bankAccounts !== undefined && bankAccounts.length === 0 && !bankSeeded) {
      setBankSeeded(true);
      seedDefaultBanks({ userId: user.userId });
    }
  }, [user, bankAccounts, bankSeeded, seedDefaultBanks]);

  type BankItem = {
    _id?: Id<"bank_accounts">;
    bank_name: string;
    display_name: string;
    account_last4: string;
    ifsc_code: string;
    logo_id: string;
    logo_color: string;
    account_type: "internal" | "external";
    sort_order: number;
    is_active: boolean;
  };

  const [showAddBank, setShowAddBank] = useState(false);
  const [bankSaving, setBankSaving] = useState(false);
  const [newBank, setNewBank] = useState<Omit<BankItem, "_id" | "sort_order" | "is_active">>({
    bank_name: "",
    display_name: "",
    account_last4: "",
    ifsc_code: "",
    logo_id: "",
    logo_color: "",
    account_type: "internal",
  });

  const handleAddBank = async () => {
    if (!user || !newBank.bank_name || !newBank.display_name || !newBank.logo_id) return;
    setBankSaving(true);
    try {
      await addBankAccount({
        userId: user.userId,
        bank_name: newBank.bank_name,
        display_name: newBank.display_name,
        account_last4: newBank.account_last4 || undefined,
        ifsc_code: newBank.ifsc_code || undefined,
        logo_id: newBank.logo_id,
        logo_color: newBank.logo_color || undefined,
        account_type: newBank.account_type,
        sort_order: (bankAccounts?.length ?? 0),
      });
      setNewBank({ bank_name: "", display_name: "", account_last4: "", ifsc_code: "", logo_id: "", logo_color: "", account_type: "internal" });
      setShowAddBank(false);
    } finally {
      setBankSaving(false);
    }
  };

  const handleDeleteBank = async (id: Id<"bank_accounts">) => {
    if (!confirm("Remove this bank account?")) return;
    await deleteBankAccount({ id });
  };

  const handleToggleBankActive = async (id: Id<"bank_accounts">, isActive: boolean) => {
    await updateBankAccount({ id, is_active: isActive });
  };

  // Initialize category state from defaults + prefs
  useEffect(() => {
    if (expenseCatPrefs !== undefined) {
      const merged = getMergedCategories(EXPENSE_CATEGORIES, expenseCatPrefs.map((p) => ({ ...p, subcategories: p.subcategories || [] })));
      setExpenseCats(merged.map((c) => {
        const pref = expenseCatPrefs.find((p) => p.slug === c.value);
        return { slug: c.value, label: c.label, icon: c.icon, color: c.color || CATEGORY_COLORS[c.value] || "#6B7280", hidden: c.hidden, sort_order: c.sort_order, subcategories: pref?.subcategories || [] };
      }));
    }
  }, [expenseCatPrefs]);

  useEffect(() => {
    if (incomeCatPrefs !== undefined) {
      const merged = getMergedCategories(INCOME_TYPES as unknown as Array<{ value: string; label: string; icon?: string }>, incomeCatPrefs.map((p) => ({ ...p, subcategories: p.subcategories || [] })));
      setIncomeCats(merged.map((c) => {
        const pref = incomeCatPrefs.find((p) => p.slug === c.value);
        return { slug: c.value, label: c.label, icon: c.icon, color: c.color || CATEGORY_COLORS[c.value] || "#6B7280", hidden: c.hidden, sort_order: c.sort_order, subcategories: pref?.subcategories || [] };
      }));
    }
  }, [incomeCatPrefs]);

  const moveCategory = (list: CatItem[], setList: (v: CatItem[]) => void, index: number, direction: "up" | "down") => {
    const newList = [...list];
    const target = direction === "up" ? index - 1 : index + 1;
    if (target < 0 || target >= newList.length) return;
    [newList[index], newList[target]] = [newList[target], newList[index]];
    setList(newList.map((c, i) => ({ ...c, sort_order: i })));
  };

  const toggleHidden = (list: CatItem[], setList: (v: CatItem[]) => void, index: number) => {
    const newList = [...list];
    newList[index] = { ...newList[index], hidden: !newList[index].hidden };
    setList(newList);
  };

  const updateLabel = (list: CatItem[], setList: (v: CatItem[]) => void, index: number, label: string) => {
    const newList = [...list];
    newList[index] = { ...newList[index], label };
    setList(newList);
  };

  const addSubcategory = (list: CatItem[], setList: (v: CatItem[]) => void, index: number, sub: string) => {
    if (!sub.trim()) return;
    const newList = [...list];
    const existing = newList[index].subcategories || [];
    if (existing.includes(sub.trim())) return;
    newList[index] = { ...newList[index], subcategories: [...existing, sub.trim()] };
    setList(newList);
  };

  const removeSubcategory = (list: CatItem[], setList: (v: CatItem[]) => void, catIndex: number, subIndex: number) => {
    const newList = [...list];
    const subs = [...(newList[catIndex].subcategories || [])];
    subs.splice(subIndex, 1);
    newList[catIndex] = { ...newList[catIndex], subcategories: subs };
    setList(newList);
  };

  const addNewCategory = (list: CatItem[], setList: (v: CatItem[]) => void) => {
    const slug = `custom_${Date.now()}`;
    setList([...list, {
      slug,
      label: "New Category",
      icon: "MoreHorizontal",
      color: "#6B7280",
      hidden: false,
      sort_order: list.length,
      subcategories: [],
    }]);
  };

  const deleteCategory = (list: CatItem[], setList: (v: CatItem[]) => void, index: number) => {
    const newList = list.filter((_, i) => i !== index).map((c, i) => ({ ...c, sort_order: i }));
    setList(newList);
  };

  const handleSaveCategories = async (scope: "expense" | "income", cats: CatItem[]) => {
    if (!user) return;
    setCatSaving(true);
    try {
      await batchSaveCategories({
        userId: user.userId,
        scope,
        categories: cats.map((c) => ({
          slug: c.slug,
          label: c.label,
          icon: c.icon,
          color: c.color,
          sort_order: c.sort_order,
          hidden: c.hidden,
          subcategories: c.subcategories.length > 0 ? c.subcategories : undefined,
        })),
      });
      setCatSaved(true);
      setTimeout(() => setCatSaved(false), 2000);
    } finally { setCatSaving(false); }
  };

  const handleResetCategories = async (scope: "expense" | "income") => {
    if (!user) return;
    await resetCategories({ userId: user.userId, scope });
  };

  // Load profile data into state when it arrives
  useEffect(() => {
    if (profile) {
      setName(profile.name || "");
      setEmail(profile.email || "");
      setPan(profile.pan_number || "");
      setAadhaar(profile.aadhaar_last4 || "");
      setUserType(profile.user_type || "both");
      setAnnualCTC(profile.annual_ctc?.toString() || "");
      setMonthlySalary(profile.monthly_salary?.toString() || "");
      setRegime(profile.regime_preference || "new");
      setGstRegistered(profile.gst_registered || false);
      setGstin(profile.gstin || "");
      setFyStart(profile.financial_year_start || "april");
    }
  }, [profile]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      await updateProfile({
        userId: user.userId,
        name: name || undefined,
        pan_number: pan || undefined,
        aadhaar_last4: aadhaar || undefined,
        user_type: userType as "employee" | "consultant" | "both",
        annual_ctc: annualCTC ? Number(annualCTC) : undefined,
        monthly_salary: monthlySalary ? Number(monthlySalary) : undefined,
        regime_preference: regime as "old" | "new",
        gst_registered: gstRegistered,
        gstin: gstin || undefined,
        financial_year_start: fyStart || undefined,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error("Failed to save:", err);
    } finally {
      setSaving(false);
    }
  };

  // Profile completion calculation
  const profileFields = [
    { filled: !!name, label: "Full Name" },
    { filled: !!pan, label: "PAN Number" },
    { filled: !!aadhaar, label: "Aadhaar" },
    { filled: !!annualCTC || userType === "consultant", label: "Annual CTC" },
    { filled: !!regime, label: "Tax Regime" },
    { filled: gstRegistered ? !!gstin : true, label: "GSTIN" },
  ];
  const completedFields = profileFields.filter((f) => f.filled).length;
  const profilePct = Math.round((completedFields / profileFields.length) * 100);

  return (
    <AppLayout>
      <div className="animate-page-enter">
        <div className="mb-6">
          <h1 className="font-display text-2xl font-bold text-text-primary">Settings</h1>
          <p className="text-text-secondary text-sm mt-1">Manage your profile & preferences</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column: settings forms */}
        <div className="lg:col-span-2 space-y-6">

        {/* Profile */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <User className="h-5 w-5 text-accent-light" />
              <CardTitle>Profile</CardTitle>
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
                <p className="text-text-tertiary text-xs">Email cannot be changed</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>PAN Number</Label>
                <Input value={pan} onChange={(e) => setPan(e.target.value.toUpperCase())} placeholder="ABCDE1234F" maxLength={10} />
              </div>
              <div className="space-y-2">
                <Label>Aadhaar (Last 4 digits)</Label>
                <Input value={aadhaar} onChange={(e) => setAadhaar(e.target.value)} placeholder="Last 4 digits" maxLength={4} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>I am a</Label>
              <Select
                value={userType}
                onChange={(e) => setUserType(e.target.value)}
                options={[
                  { value: "employee", label: "Salaried Employee" },
                  { value: "consultant", label: "Consultant / Freelancer" },
                  { value: "both", label: "Both" },
                ]}
              />
            </div>
            {(userType === "employee" || userType === "both") && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Annual CTC</Label>
                  <Input type="number" value={annualCTC} onChange={(e) => setAnnualCTC(e.target.value)} placeholder="0" />
                </div>
                <div className="space-y-2">
                  <Label>Monthly In-Hand Salary</Label>
                  <Input type="number" value={monthlySalary} onChange={(e) => setMonthlySalary(e.target.value)} placeholder="0" />
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Tax Settings */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <Calculator className="h-5 w-5 text-accent-light" />
              <CardTitle>Tax Preferences</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Tax Regime Preference</Label>
              <Select
                value={regime}
                onChange={(e) => setRegime(e.target.value)}
                options={[
                  { value: "old", label: "Old Regime (with deductions)" },
                  { value: "new", label: "New Regime (lower rates)" },
                ]}
              />
              <p className="text-text-tertiary text-xs">
                {regime === "new"
                  ? "New regime: Lower slab rates, fewer deductions (₹75K SD only)"
                  : "Old regime: Higher slab rates, all deductions available (80C, 80D, HRA, etc.)"}
              </p>
            </div>
            <div className="space-y-2">
              <Label>Financial Year Start</Label>
              <Select
                value={fyStart}
                onChange={(e) => setFyStart(e.target.value)}
                options={[{ value: "april", label: "April (Standard)" }]}
              />
            </div>
          </CardContent>
        </Card>

        {/* Category Manager */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Tags className="h-5 w-5 text-accent-light" />
                <CardTitle>Categories & Subcategories</CardTitle>
              </div>
              <Badge variant="secondary">Customize dropdowns</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="expense">
              <TabsList className="mb-4">
                <TabsTrigger value="expense">Expense Categories ({expenseCats.filter(c => !c.hidden).length} active)</TabsTrigger>
                <TabsTrigger value="income">Income Types ({incomeCats.filter(c => !c.hidden).length} active)</TabsTrigger>
              </TabsList>

              {/* EXPENSE CATEGORIES */}
              <TabsContent value="expense">
                <div className="space-y-1.5">
                  {expenseCats.map((cat, index) => (
                    <div key={cat.slug} className={`rounded-lg border p-3 transition-all ${cat.hidden ? "border-gray-100 bg-gray-50/50 opacity-50" : "border-gray-200 bg-white"}`}>
                      {/* Row 1: Icon + Label + Actions */}
                      <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center w-8 h-8 rounded-lg shrink-0" style={{ backgroundColor: cat.color + "20" }}>
                          <CategoryIcon slug={cat.slug} className="h-4 w-4" color={cat.color} />
                        </div>
                        <Input
                          value={cat.label}
                          onChange={(e) => updateLabel(expenseCats, setExpenseCats, index, e.target.value)}
                          className="h-8 text-sm font-medium flex-1 max-w-[200px]"
                        />
                        <div className="flex items-center gap-1 ml-auto">
                          <button onClick={() => toggleHidden(expenseCats, setExpenseCats, index)} className="p-1.5 rounded-md hover:bg-gray-100 transition-colors" title={cat.hidden ? "Show in dropdowns" : "Hide from dropdowns"}>
                            {cat.hidden ? <EyeOff className="h-4 w-4 text-gray-400" /> : <Eye className="h-4 w-4 text-accent-light" />}
                          </button>
                          <button onClick={() => moveCategory(expenseCats, setExpenseCats, index, "up")} disabled={index === 0} className="p-1.5 rounded-md hover:bg-gray-100 disabled:opacity-20 transition-colors" title="Move up">
                            <ChevronUp className="h-4 w-4" />
                          </button>
                          <button onClick={() => moveCategory(expenseCats, setExpenseCats, index, "down")} disabled={index === expenseCats.length - 1} className="p-1.5 rounded-md hover:bg-gray-100 disabled:opacity-20 transition-colors" title="Move down">
                            <ChevronDown className="h-4 w-4" />
                          </button>
                          <button onClick={() => deleteCategory(expenseCats, setExpenseCats, index)} className="p-1.5 rounded-md hover:bg-rose-50 text-gray-400 hover:text-rose transition-colors" title="Delete category">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                      {/* Row 2: Subcategories */}
                      <div className="mt-2 ml-11 space-y-2">
                        {(cat.subcategories || []).length > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            {cat.subcategories.map((sub, si) => (
                              <span key={si} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-accent/8 text-accent text-xs font-medium border border-accent/15">
                                {sub}
                                <button onClick={() => removeSubcategory(expenseCats, setExpenseCats, index, si)} className="hover:text-rose ml-0.5"><X className="h-3 w-3" /></button>
                              </span>
                            ))}
                          </div>
                        )}
                        <div className="flex items-center gap-2">
                          <input
                            value={newSubcategory[cat.slug] || ""}
                            onChange={(e) => setNewSubcategory({ ...newSubcategory, [cat.slug]: e.target.value })}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && (newSubcategory[cat.slug] || "").trim()) {
                                e.preventDefault();
                                addSubcategory(expenseCats, setExpenseCats, index, newSubcategory[cat.slug] || "");
                                setNewSubcategory({ ...newSubcategory, [cat.slug]: "" });
                              }
                            }}
                            placeholder="Enter subcategory name..."
                            className="flex-1 max-w-[220px] h-7 px-2.5 text-xs rounded-lg border border-gray-200 bg-gray-50 placeholder:text-gray-400 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/20 focus:bg-white"
                          />
                          <button
                            onClick={() => {
                              if ((newSubcategory[cat.slug] || "").trim()) {
                                addSubcategory(expenseCats, setExpenseCats, index, newSubcategory[cat.slug] || "");
                                setNewSubcategory({ ...newSubcategory, [cat.slug]: "" });
                              }
                            }}
                            className="h-7 px-2.5 rounded-lg bg-accent/10 text-accent hover:bg-accent/20 text-xs font-medium transition-colors flex items-center gap-1"
                          >
                            <Plus className="h-3 w-3" /> Add
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
                  <div className="flex items-center gap-3">
                    <Button size="sm" variant="outline" onClick={() => addNewCategory(expenseCats, setExpenseCats)}>
                      <Plus className="h-4 w-4 mr-1" /> Add Category
                    </Button>
                    <button onClick={() => handleResetCategories("expense")} className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors">
                      <RotateCcw className="h-3.5 w-3.5" /> Reset defaults
                    </button>
                  </div>
                  <Button size="sm" onClick={() => handleSaveCategories("expense", expenseCats)} disabled={catSaving}>
                    {catSaving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
                    {catSaved ? "Saved!" : "Save All"}
                  </Button>
                </div>
              </TabsContent>

              {/* INCOME TYPES */}
              <TabsContent value="income">
                <div className="space-y-1.5">
                  {incomeCats.map((cat, index) => (
                    <div key={cat.slug} className={`rounded-lg border p-3 transition-all ${cat.hidden ? "border-gray-100 bg-gray-50/50 opacity-50" : "border-gray-200 bg-white"}`}>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center w-8 h-8 rounded-lg shrink-0" style={{ backgroundColor: (cat.color || "#10B981") + "20" }}>
                          <CategoryIcon slug={cat.slug} className="h-4 w-4" color={cat.color || "#10B981"} />
                        </div>
                        <Input
                          value={cat.label}
                          onChange={(e) => updateLabel(incomeCats, setIncomeCats, index, e.target.value)}
                          className="h-8 text-sm font-medium flex-1 max-w-[200px]"
                        />
                        <div className="flex items-center gap-1 ml-auto">
                          <button onClick={() => toggleHidden(incomeCats, setIncomeCats, index)} className="p-1.5 rounded-md hover:bg-gray-100 transition-colors">
                            {cat.hidden ? <EyeOff className="h-4 w-4 text-gray-400" /> : <Eye className="h-4 w-4 text-emerald" />}
                          </button>
                          <button onClick={() => moveCategory(incomeCats, setIncomeCats, index, "up")} disabled={index === 0} className="p-1.5 rounded-md hover:bg-gray-100 disabled:opacity-20"><ChevronUp className="h-4 w-4" /></button>
                          <button onClick={() => moveCategory(incomeCats, setIncomeCats, index, "down")} disabled={index === incomeCats.length - 1} className="p-1.5 rounded-md hover:bg-gray-100 disabled:opacity-20"><ChevronDown className="h-4 w-4" /></button>
                          <button onClick={() => deleteCategory(incomeCats, setIncomeCats, index)} className="p-1.5 rounded-md hover:bg-rose-50 text-gray-400 hover:text-rose transition-colors"><Trash2 className="h-4 w-4" /></button>
                        </div>
                      </div>
                      <div className="mt-2 ml-11 space-y-2">
                        {(cat.subcategories || []).length > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            {cat.subcategories.map((sub, si) => (
                              <span key={si} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald/8 text-emerald text-xs font-medium border border-emerald/15">
                                {sub}
                                <button onClick={() => removeSubcategory(incomeCats, setIncomeCats, index, si)} className="hover:text-rose ml-0.5"><X className="h-3 w-3" /></button>
                              </span>
                            ))}
                          </div>
                        )}
                        <div className="flex items-center gap-2">
                          <input
                            value={newSubcategory[cat.slug] || ""}
                            onChange={(e) => setNewSubcategory({ ...newSubcategory, [cat.slug]: e.target.value })}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && (newSubcategory[cat.slug] || "").trim()) {
                                e.preventDefault();
                                addSubcategory(incomeCats, setIncomeCats, index, newSubcategory[cat.slug] || "");
                                setNewSubcategory({ ...newSubcategory, [cat.slug]: "" });
                              }
                            }}
                            placeholder="Enter subcategory name..."
                            className="flex-1 max-w-[220px] h-7 px-2.5 text-xs rounded-lg border border-gray-200 bg-gray-50 placeholder:text-gray-400 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/20 focus:bg-white"
                          />
                          <button
                            onClick={() => {
                              if ((newSubcategory[cat.slug] || "").trim()) {
                                addSubcategory(incomeCats, setIncomeCats, index, newSubcategory[cat.slug] || "");
                                setNewSubcategory({ ...newSubcategory, [cat.slug]: "" });
                              }
                            }}
                            className="h-7 px-2.5 rounded-lg bg-emerald/10 text-emerald hover:bg-emerald/20 text-xs font-medium transition-colors flex items-center gap-1"
                          >
                            <Plus className="h-3 w-3" /> Add
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
                  <div className="flex items-center gap-3">
                    <Button size="sm" variant="outline" onClick={() => addNewCategory(incomeCats, setIncomeCats)}>
                      <Plus className="h-4 w-4 mr-1" /> Add Type
                    </Button>
                    <button onClick={() => handleResetCategories("income")} className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors">
                      <RotateCcw className="h-3.5 w-3.5" /> Reset defaults
                    </button>
                  </div>
                  <Button size="sm" onClick={() => handleSaveCategories("income", incomeCats)} disabled={catSaving}>
                    {catSaving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
                    {catSaved ? "Saved!" : "Save All"}
                  </Button>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Bank Accounts Manager */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Landmark className="h-5 w-5 text-accent-light" />
                <CardTitle>Bank Accounts</CardTitle>
              </div>
              <Badge variant="secondary">Master Data</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="internal">
              <TabsList className="mb-4">
                <TabsTrigger value="internal">My Accounts ({bankAccounts?.filter(b => b.account_type === "internal").length ?? 0})</TabsTrigger>
                <TabsTrigger value="external">Beneficiaries ({bankAccounts?.filter(b => b.account_type === "external").length ?? 0})</TabsTrigger>
              </TabsList>

              {["internal", "external"].map((accType) => (
                <TabsContent key={accType} value={accType}>
                  <div className="space-y-2">
                    {(bankAccounts ?? [])
                      .filter((b) => b.account_type === accType)
                      .sort((a, b) => a.sort_order - b.sort_order)
                      .map((bank) => (
                        <div
                          key={bank._id}
                          className={`rounded-xl border p-4 transition-all ${
                            bank.is_active ? "border-gray-200 bg-white" : "border-gray-100 bg-gray-50/50 opacity-50"
                          }`}
                        >
                          <div className="flex items-center gap-4">
                            <BankLogo bankId={bank.logo_id} size="lg" customColor={bank.logo_color || undefined} />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-sm text-text-primary">{bank.bank_name}</span>
                                <Badge variant="secondary" className="text-[10px]">{bank.display_name}</Badge>
                              </div>
                              <div className="flex items-center gap-3 mt-1">
                                {bank.account_last4 && (
                                  <span className="text-xs text-text-tertiary">**** {bank.account_last4}</span>
                                )}
                                {bank.ifsc_code && (
                                  <span className="text-xs text-text-tertiary">{bank.ifsc_code}</span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Switch
                                checked={bank.is_active}
                                onCheckedChange={(v) => handleToggleBankActive(bank._id, v)}
                              />
                              <button
                                onClick={() => handleDeleteBank(bank._id)}
                                className="p-1.5 rounded-md hover:bg-rose-50 text-gray-400 hover:text-rose transition-colors"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}

                    {(bankAccounts ?? []).filter((b) => b.account_type === accType).length === 0 && (
                      <div className="text-center py-8 text-sm text-text-tertiary">
                        No {accType === "internal" ? "bank accounts" : "beneficiaries"} added yet
                      </div>
                    )}
                  </div>

                  {/* Add Bank Form */}
                  {showAddBank ? (
                    <div className="mt-4 rounded-xl border border-accent/20 bg-accent/[0.03] p-4 space-y-4 animate-page-enter">
                      <h4 className="text-sm font-semibold text-text-primary">
                        Add {accType === "internal" ? "Bank Account" : "Beneficiary"}
                      </h4>

                      {/* Logo Picker */}
                      <div className="space-y-2">
                        <Label className="text-xs">Select Bank</Label>
                        <div className="flex flex-wrap gap-2">
                          {BANK_PRESET_IDS.map((id) => (
                            <button
                              key={id}
                              onClick={() => {
                                setNewBank({ ...newBank, logo_id: id, bank_name: BANK_PRESETS[id].name });
                              }}
                              className={`flex items-center gap-2 rounded-xl px-3 py-2 border text-xs transition-all ${
                                newBank.logo_id === id
                                  ? "border-accent bg-accent/5 text-accent shadow-sm"
                                  : "border-gray-200 bg-white text-text-secondary hover:border-gray-300"
                              }`}
                            >
                              <BankLogo bankId={id} size="xs" />
                              <span>{BANK_PRESETS[id].name}</span>
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label className="text-xs">Bank Name</Label>
                          <Input
                            value={newBank.bank_name}
                            onChange={(e) => setNewBank({ ...newBank, bank_name: e.target.value })}
                            placeholder="e.g. ICICI Bank"
                            className="h-9 text-sm"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs">Display Name</Label>
                          <Input
                            value={newBank.display_name}
                            onChange={(e) => setNewBank({ ...newBank, display_name: e.target.value })}
                            placeholder="e.g. Primary Savings"
                            className="h-9 text-sm"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs">Account No (last 4)</Label>
                          <Input
                            value={newBank.account_last4}
                            onChange={(e) => setNewBank({ ...newBank, account_last4: e.target.value })}
                            placeholder="1234"
                            maxLength={4}
                            className="h-9 text-sm"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs">IFSC Code</Label>
                          <Input
                            value={newBank.ifsc_code}
                            onChange={(e) => setNewBank({ ...newBank, ifsc_code: e.target.value.toUpperCase() })}
                            placeholder="ICIC0001234"
                            className="h-9 text-sm"
                          />
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs">Account Type</Label>
                        <Select
                          value={newBank.account_type}
                          onChange={(e) => setNewBank({ ...newBank, account_type: e.target.value as "internal" | "external" })}
                          options={[
                            { value: "internal", label: "My Account (Internal)" },
                            { value: "external", label: "Beneficiary (External)" },
                          ]}
                          className="h-9"
                        />
                      </div>

                      <div className="flex items-center gap-2 pt-1">
                        <Button
                          size="sm"
                          onClick={handleAddBank}
                          disabled={bankSaving || !newBank.bank_name || !newBank.display_name || !newBank.logo_id}
                        >
                          {bankSaving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
                          Save
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setShowAddBank(false)}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-4 pt-4 border-t border-gray-100">
                      <Button size="sm" variant="outline" onClick={() => {
                        setNewBank({ ...newBank, account_type: accType as "internal" | "external" });
                        setShowAddBank(true);
                      }}>
                        <Plus className="h-4 w-4 mr-1" />
                        Add {accType === "internal" ? "Bank Account" : "Beneficiary"}
                      </Button>
                    </div>
                  )}
                </TabsContent>
              ))}
            </Tabs>
          </CardContent>
        </Card>

        {/* GST Settings */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <Receipt className="h-5 w-5 text-accent-light" />
              <CardTitle>GST Settings</CardTitle>
              <Badge variant={gstRegistered ? "success" : "secondary"}>
                {gstRegistered ? "Registered" : "Not Registered"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-text-primary">GST Registered</p>
                <p className="text-xs text-text-tertiary">Enable if registered under GST</p>
              </div>
              <Switch checked={gstRegistered} onCheckedChange={setGstRegistered} />
            </div>
            {gstRegistered && (
              <div className="space-y-4 pt-2">
                <div className="space-y-2">
                  <Label>GSTIN</Label>
                  <Input value={gstin} onChange={(e) => setGstin(e.target.value.toUpperCase())} placeholder="15-digit GSTIN" maxLength={15} />
                </div>
                <div className="space-y-2">
                  <Label>Default GST Rate</Label>
                  <Select
                    options={[
                      { value: "5", label: "5%" },
                      { value: "12", label: "12%" },
                      { value: "18", label: "18% (Services)" },
                      { value: "28", label: "28%" },
                    ]}
                    defaultValue="18"
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Notifications */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <Bell className="h-5 w-5 text-accent-light" />
              <CardTitle>Notifications</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {[
              { label: "Advance Tax Reminders", desc: "7 days before due date", default: true },
              { label: "GST Filing Reminders", desc: "3 days before due date", default: true },
              { label: "Insurance Premium Due", desc: "15 days before renewal", default: true },
              { label: "EMI Due Date", desc: "3 days before EMI date", default: true },
              { label: "Weekly Investment Review", desc: "Every Monday morning", default: false },
              { label: "Monthly Financial Summary", desc: "1st of every month", default: true },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between py-2 border-b border-border-light">
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
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-text-primary">Export Income Data</p>
                <p className="text-xs text-text-tertiary">Download all income entries as CSV</p>
              </div>
              <Button variant="outline" size="sm">
                <Download className="h-3.5 w-3.5 mr-1.5" />
                Export
              </Button>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-text-primary">Export Expense Data</p>
                <p className="text-xs text-text-tertiary">Download all expense entries as CSV</p>
              </div>
              <Button variant="outline" size="sm">
                <Download className="h-3.5 w-3.5 mr-1.5" />
                Export
              </Button>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-text-primary">Export Tax Report</p>
                <p className="text-xs text-text-tertiary">Download tax computation sheet</p>
              </div>
              <Button variant="outline" size="sm">
                <Download className="h-3.5 w-3.5 mr-1.5" />
                Export
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Save Button */}
        <div className="flex justify-end pb-8">
          <Button onClick={handleSave} className="px-8" disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : saved ? (
              "Saved!"
            ) : (
              "Save Changes"
            )}
          </Button>
        </div>
        </div>{/* end left column */}

        {/* Right column: guidance section */}
        <div className="space-y-6">
          {/* Profile Completion */}
          <Card className="card-enter card-enter-1">
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
                <div
                  className="bg-accent h-2.5 rounded-full transition-all duration-500"
                  style={{ width: `${profilePct}%` }}
                />
              </div>
              <div className="space-y-1.5 pt-1">
                {profileFields.map((f) => (
                  <div key={f.label} className="flex items-center gap-2 text-xs">
                    <div className={`h-1.5 w-1.5 rounded-full ${f.filled ? "bg-emerald-400" : "bg-gray-300"}`} />
                    <span className={f.filled ? "text-text-secondary" : "text-text-tertiary"}>
                      {f.label}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Quick Tips */}
          <Card className="card-enter card-enter-2">
            <CardHeader>
              <div className="flex items-center gap-3">
                <Lightbulb className="h-5 w-5 text-amber-400" />
                <CardTitle className="text-base">Quick Tips</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="rounded-lg bg-amber-50 border border-amber-100 px-3 py-2.5">
                <p className="text-xs text-amber-800 font-medium">Keep your PAN and Aadhaar updated for accurate tax calculations.</p>
              </div>
              <div className="rounded-lg bg-blue-50 border border-blue-100 px-3 py-2.5">
                <p className="text-xs text-blue-800 font-medium">Choose your tax regime wisely - New regime has lower rates but fewer deductions.</p>
              </div>
              <div className="rounded-lg bg-emerald-50 border border-emerald-100 px-3 py-2.5">
                <p className="text-xs text-emerald-800 font-medium">Enable GST if registered to track input credit automatically.</p>
              </div>
            </CardContent>
          </Card>

          {/* Important Deadlines */}
          <Card className="card-enter card-enter-3">
            <CardHeader>
              <div className="flex items-center gap-3">
                <Calendar className="h-5 w-5 text-rose" />
                <CardTitle className="text-base">Key Deadlines</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[
                  { label: "ITR Filing Deadline", date: "July 31, 2026", urgent: true },
                  { label: "Advance Tax Q1", date: "June 15, 2026", urgent: true },
                  { label: "Advance Tax Q2", date: "Sep 15, 2026", urgent: false },
                  { label: "Advance Tax Q3", date: "Dec 15, 2026", urgent: false },
                  { label: "Advance Tax Q4", date: "Mar 15, 2027", urgent: false },
                  { label: "GST Annual Return", date: "Dec 31, 2026", urgent: false },
                ].map((item) => (
                  <div key={item.label} className="flex items-center justify-between py-1.5 border-b border-border-light last:border-0">
                    <span className="text-xs text-text-primary">{item.label}</span>
                    <Badge variant={item.urgent ? "warning" : "secondary"} className="text-[10px]">
                      {item.date}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>{/* end right column */}
        </div>{/* end grid */}
      </div>
    </AppLayout>
  );
}
