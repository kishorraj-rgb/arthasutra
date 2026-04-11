// @ts-nocheck
/**
 * Document type definitions.
 * Each type has its own numbering prefix, title, and optional extra fields.
 */
export const DOCUMENT_TYPES = [
  {
    id: 'invoice',
    label: 'Invoice',
    title: 'INVOICE',
    titleGst: 'TAX INVOICE',
    prefix: 'INV',
    showAmount: true,
    showDueDate: true,
    showGst: true,
  },
  {
    id: 'credit_note',
    label: 'Credit Note',
    title: 'CREDIT NOTE',
    titleGst: 'CREDIT NOTE',
    prefix: 'CN',
    showAmount: true,
    showDueDate: false,
    showGst: true,
    extraFields: ['reason', 'originalInvoiceNumber'],
  },
  {
    id: 'debit_note',
    label: 'Debit Note',
    title: 'DEBIT NOTE',
    titleGst: 'DEBIT NOTE',
    prefix: 'DN',
    showAmount: true,
    showDueDate: false,
    showGst: true,
    extraFields: ['reason', 'originalInvoiceNumber'],
  },
  {
    id: 'proforma',
    label: 'Proforma Invoice',
    title: 'PROFORMA INVOICE',
    titleGst: 'PROFORMA INVOICE',
    prefix: 'PI',
    showAmount: true,
    showDueDate: true,
    showGst: true,
    canConvert: true,
  },
  {
    id: 'quotation',
    label: 'Quotation',
    title: 'QUOTATION',
    titleGst: 'QUOTATION',
    prefix: 'QT',
    showAmount: true,
    showDueDate: false,
    showGst: true,
    canConvert: true,
    extraFields: ['validityDate'],
  },
  {
    id: 'purchase_order',
    label: 'Purchase Order',
    title: 'PURCHASE ORDER',
    titleGst: 'PURCHASE ORDER',
    prefix: 'PO',
    showAmount: true,
    showDueDate: false,
    showGst: true,
    extraFields: ['deliveryDate'],
  },
  {
    id: 'delivery_challan',
    label: 'Delivery Challan',
    title: 'DELIVERY CHALLAN',
    titleGst: 'DELIVERY CHALLAN',
    prefix: 'DC',
    showAmount: false,
    showDueDate: false,
    showGst: false,
    extraFields: ['vehicleNumber', 'transporterName', 'lrNumber'],
  },
];

export function getDocumentType(id) {
  return DOCUMENT_TYPES.find((d) => d.id === id) || DOCUMENT_TYPES[0];
}

export function getDocumentTitle(id, isGstRegistered) {
  const dt = getDocumentType(id);
  return isGstRegistered ? dt.titleGst : dt.title;
}

export const DOCUMENT_TYPE_OPTIONS = DOCUMENT_TYPES.map((d) => ({
  value: d.id,
  label: d.label,
}));
