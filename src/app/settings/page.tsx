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
import { User, Calculator, Receipt, Bell, Download, Loader2 } from "lucide-react";

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

  return (
    <AppLayout>
      <div className="space-y-6 animate-enter max-w-3xl">
        <div>
          <h1 className="font-display text-2xl font-bold text-text-primary">Settings</h1>
          <p className="text-text-secondary text-sm mt-1">Manage your profile & preferences</p>
        </div>

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
      </div>
    </AppLayout>
  );
}
