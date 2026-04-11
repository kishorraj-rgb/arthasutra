// @ts-nocheck
/**
 * Invoice template definitions.
 * Each template defines visual styles applied to InvoicePreview.
 */

const templates = {
  classic: {
    id: 'classic',
    name: 'Classic',
    description: 'Clean black & white',
    // Colors
    accentColor: '#000000',
    accentBg: '#f9fafb',       // gray-50
    headerBg: 'transparent',
    headerText: '#000000',
    // Table
    tableBorder: '#e5e7eb',     // gray-200
    tableHeaderBg: '#f9fafb',
    tableHeaderText: '#374151',  // gray-700
    tableStripeBg: 'transparent',
    // Typography
    sellerNameSize: 'text-xl',
    invoiceTitleSize: 'text-2xl',
    // Layout
    borderRadius: 'rounded',
    sectionBorder: 'border-gray-200',
    totalsBorder: 'border-black',
    // Balance Due box
    balanceBg: 'bg-gray-50',
    balanceBorder: 'border-gray-200',
  },

  modern: {
    id: 'modern',
    name: 'Modern',
    description: 'Blue accent header',
    accentColor: '#2563eb',     // blue-600
    accentBg: '#eff6ff',        // blue-50
    headerBg: '#2563eb',
    headerText: '#ffffff',
    tableBorder: '#dbeafe',     // blue-100
    tableHeaderBg: '#eff6ff',
    tableHeaderText: '#1e40af', // blue-800
    tableStripeBg: 'transparent',
    sellerNameSize: 'text-xl',
    invoiceTitleSize: 'text-2xl',
    borderRadius: 'rounded-lg',
    sectionBorder: 'border-blue-100',
    totalsBorder: 'border-blue-600',
    balanceBg: 'bg-blue-50',
    balanceBorder: 'border-blue-200',
  },

  compact: {
    id: 'compact',
    name: 'Compact',
    description: 'Dense, space-efficient',
    accentColor: '#000000',
    accentBg: '#f3f4f6',
    headerBg: 'transparent',
    headerText: '#000000',
    tableBorder: '#d1d5db',     // gray-300
    tableHeaderBg: '#f3f4f6',
    tableHeaderText: '#111827',
    tableStripeBg: 'transparent',
    sellerNameSize: 'text-base',
    invoiceTitleSize: 'text-xl',
    borderRadius: 'rounded-sm',
    sectionBorder: 'border-gray-300',
    totalsBorder: 'border-black',
    balanceBg: 'bg-gray-100',
    balanceBorder: 'border-gray-300',
    compact: true,
  },

  bold: {
    id: 'bold',
    name: 'Bold',
    description: 'Large headings, strong dividers',
    accentColor: '#000000',
    accentBg: '#fafafa',
    headerBg: 'transparent',
    headerText: '#000000',
    tableBorder: '#000000',
    tableHeaderBg: '#000000',
    tableHeaderText: '#ffffff',
    tableStripeBg: 'transparent',
    sellerNameSize: 'text-2xl',
    invoiceTitleSize: 'text-3xl',
    borderRadius: 'rounded',
    sectionBorder: 'border-black',
    totalsBorder: 'border-black',
    balanceBg: 'bg-black',
    balanceBorder: 'border-black',
    balanceText: 'text-white',
  },

  stripe: {
    id: 'stripe',
    name: 'Stripe',
    description: 'Alternating rows, green accent',
    accentColor: '#059669',     // emerald-600
    accentBg: '#ecfdf5',        // emerald-50
    headerBg: 'transparent',
    headerText: '#000000',
    tableBorder: '#d1fae5',     // emerald-200
    tableHeaderBg: '#059669',
    tableHeaderText: '#ffffff',
    tableStripeBg: '#f0fdf4',   // emerald-50
    sellerNameSize: 'text-xl',
    invoiceTitleSize: 'text-2xl',
    borderRadius: 'rounded',
    sectionBorder: 'border-emerald-200',
    totalsBorder: 'border-emerald-600',
    balanceBg: 'bg-emerald-50',
    balanceBorder: 'border-emerald-200',
  },

  minimal: {
    id: 'minimal',
    name: 'Minimal',
    description: 'No borders, open layout',
    accentColor: '#6b7280',     // gray-500
    accentBg: 'transparent',
    headerBg: 'transparent',
    headerText: '#000000',
    tableBorder: 'transparent',
    tableHeaderBg: 'transparent',
    tableHeaderText: '#9ca3af',  // gray-400
    tableStripeBg: 'transparent',
    sellerNameSize: 'text-xl',
    invoiceTitleSize: 'text-2xl',
    borderRadius: 'rounded-none',
    sectionBorder: 'border-gray-100',
    totalsBorder: 'border-gray-300',
    noBorders: true,
    balanceBg: 'bg-transparent',
    balanceBorder: 'border-gray-200',
  },
};

export const templateList = Object.values(templates);

export function getTemplate(id) {
  return templates[id] || templates.classic;
}

export const defaultTemplateId = 'classic';
