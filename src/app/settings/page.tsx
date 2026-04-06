"use client";

import { useState } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { User, Calculator, Receipt, Bell, Download } from "lucide-react";

export default function SettingsPage() {
  const [userType, setUserType] = useState("both");
  const [regime, setRegime] = useState("new");
  const [gstRegistered, setGstRegistered] = useState(true);
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <AppLayout>
      <div className="space-y-6 animate-enter max-w-3xl">
        <div>
          <h1 className="font-display text-2xl font-bold text-white">Settings</h1>
          <p className="text-white/50 text-sm mt-1">Manage your profile & preferences</p>
        </div>

        {/* Profile */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <User className="h-5 w-5 text-gold" />
              <CardTitle>Profile</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Full Name</Label>
                <Input defaultValue="Rajesh Kumar" />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input defaultValue="rajesh@example.com" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>PAN Number</Label>
                <Input defaultValue="ABCPK1234A" placeholder="ABCDE1234F" />
              </div>
              <div className="space-y-2">
                <Label>Aadhaar (Last 4 digits)</Label>
                <Input defaultValue="5678" placeholder="Last 4 digits" maxLength={4} />
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
                  <Input type="number" defaultValue={4200000} />
                </div>
                <div className="space-y-2">
                  <Label>Monthly In-Hand Salary</Label>
                  <Input type="number" defaultValue={285000} />
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Tax Settings */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <Calculator className="h-5 w-5 text-gold" />
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
              <p className="text-white/30 text-xs">
                {regime === "new"
                  ? "New regime: Lower slab rates, fewer deductions (₹75K SD only)"
                  : "Old regime: Higher slab rates, all deductions available (80C, 80D, HRA, etc.)"}
              </p>
            </div>
            <div className="space-y-2">
              <Label>Financial Year Start</Label>
              <Select
                options={[{ value: "april", label: "April (Standard)" }]}
                defaultValue="april"
              />
            </div>
          </CardContent>
        </Card>

        {/* GST Settings */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <Receipt className="h-5 w-5 text-gold" />
              <CardTitle>GST Settings</CardTitle>
              <Badge variant={gstRegistered ? "success" : "secondary"}>
                {gstRegistered ? "Registered" : "Not Registered"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-white">GST Registered</p>
                <p className="text-xs text-white/40">Enable if registered under GST</p>
              </div>
              <Switch checked={gstRegistered} onCheckedChange={setGstRegistered} />
            </div>
            {gstRegistered && (
              <div className="space-y-4 pt-2">
                <div className="space-y-2">
                  <Label>GSTIN</Label>
                  <Input defaultValue="29ABCPK1234A1Z5" placeholder="15-digit GSTIN" />
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
              <Bell className="h-5 w-5 text-gold" />
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
              <div key={item.label} className="flex items-center justify-between py-2 border-b border-white/5">
                <div>
                  <p className="text-sm text-white">{item.label}</p>
                  <p className="text-xs text-white/30">{item.desc}</p>
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
              <Download className="h-5 w-5 text-gold" />
              <CardTitle>Data & Export</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-white">Export Income Data</p>
                <p className="text-xs text-white/30">Download all income entries as CSV</p>
              </div>
              <Button variant="outline" size="sm">
                <Download className="h-3.5 w-3.5 mr-1.5" />
                Export
              </Button>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-white">Export Expense Data</p>
                <p className="text-xs text-white/30">Download all expense entries as CSV</p>
              </div>
              <Button variant="outline" size="sm">
                <Download className="h-3.5 w-3.5 mr-1.5" />
                Export
              </Button>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-white">Export Tax Report</p>
                <p className="text-xs text-white/30">Download tax computation sheet</p>
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
          <Button onClick={handleSave} className="px-8">
            {saved ? "Saved!" : "Save Changes"}
          </Button>
        </div>
      </div>
    </AppLayout>
  );
}
