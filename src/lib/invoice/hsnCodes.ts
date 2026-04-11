// @ts-nocheck
// ── HSN / SAC Code Lookup (Phase 8) ──

export const HSN_CODES = [
  // ── SAC – Services ──
  { code: '998311', description: 'IT Consulting Services', type: 'SAC' },
  { code: '998312', description: 'IT Design and Development Services', type: 'SAC' },
  { code: '998313', description: 'IT Infrastructure and Network Management', type: 'SAC' },
  { code: '998314', description: 'IT Software Services', type: 'SAC' },
  { code: '998315', description: 'IT Infrastructure Provisioning Services', type: 'SAC' },
  { code: '998316', description: 'Website Hosting Services', type: 'SAC' },
  { code: '998321', description: 'Telecommunications Services', type: 'SAC' },
  { code: '998411', description: 'Financial Advisory Services', type: 'SAC' },
  { code: '998412', description: 'Accounting and Auditing Services', type: 'SAC' },
  { code: '998413', description: 'Tax Preparation and Consulting', type: 'SAC' },
  { code: '998414', description: 'Insolvency and Receivership Services', type: 'SAC' },
  { code: '998421', description: 'Legal Advisory and Representation', type: 'SAC' },
  { code: '998422', description: 'Legal Documentation Services', type: 'SAC' },
  { code: '998431', description: 'Management Consulting Services', type: 'SAC' },
  { code: '998432', description: 'Business Consulting Services', type: 'SAC' },
  { code: '998433', description: 'HR and Recruitment Services', type: 'SAC' },
  { code: '998434', description: 'Marketing and Market Research', type: 'SAC' },
  { code: '998435', description: 'Advertising Services', type: 'SAC' },
  { code: '998439', description: 'Other Professional Services', type: 'SAC' },
  { code: '998511', description: 'Postal and Courier Services', type: 'SAC' },
  { code: '998512', description: 'Local Delivery Services', type: 'SAC' },
  { code: '996511', description: 'Road Transport of Goods', type: 'SAC' },
  { code: '996512', description: 'Road Transport of Passengers', type: 'SAC' },
  { code: '996521', description: 'Rail Transport of Goods', type: 'SAC' },
  { code: '997211', description: 'Real Estate Rental Services', type: 'SAC' },
  { code: '997212', description: 'Commercial Property Rental', type: 'SAC' },
  { code: '998361', description: 'Graphic Design Services', type: 'SAC' },
  { code: '998362', description: 'Interior Design Services', type: 'SAC' },
  { code: '998363', description: 'Architecture Services', type: 'SAC' },
  { code: '998511', description: 'Education and Training Services', type: 'SAC' },
  { code: '999212', description: 'Catering Services', type: 'SAC' },

  // ── HSN – Goods ──
  { code: '8471', description: 'Computers and Laptops', type: 'HSN' },
  { code: '8473', description: 'Computer Parts and Accessories', type: 'HSN' },
  { code: '8517', description: 'Mobile Phones and Telecom Equipment', type: 'HSN' },
  { code: '8528', description: 'Monitors and Projectors', type: 'HSN' },
  { code: '8443', description: 'Printers and Printing Machines', type: 'HSN' },
  { code: '8504', description: 'Transformers and Power Supplies', type: 'HSN' },
  { code: '6109', description: 'T-Shirts and Vests (Cotton)', type: 'HSN' },
  { code: '6203', description: 'Men\'s Suits, Trousers, Shirts', type: 'HSN' },
  { code: '6204', description: 'Women\'s Suits, Dresses, Skirts', type: 'HSN' },
  { code: '6104', description: 'Knitted Women\'s Garments', type: 'HSN' },
  { code: '1006', description: 'Rice', type: 'HSN' },
  { code: '1001', description: 'Wheat and Meslin', type: 'HSN' },
  { code: '0402', description: 'Milk and Cream (Concentrated)', type: 'HSN' },
  { code: '2106', description: 'Food Preparations (NES)', type: 'HSN' },
  { code: '8429', description: 'Bulldozers, Excavators, Loaders', type: 'HSN' },
  { code: '8431', description: 'Machinery Parts', type: 'HSN' },
  { code: '3004', description: 'Medicaments (Packaged)', type: 'HSN' },
  { code: '4820', description: 'Stationery (Registers, Notebooks)', type: 'HSN' },
  { code: '9403', description: 'Furniture and Parts', type: 'HSN' },
  { code: '3926', description: 'Plastic Articles', type: 'HSN' },
];

/**
 * Search HSN/SAC codes by code number or description (case-insensitive).
 * Returns at most 10 matching results.
 */
export function searchHsnCodes(query) {
  if (!query || typeof query !== 'string') return [];
  const q = query.trim().toLowerCase();
  if (q.length === 0) return [];

  const results = HSN_CODES.filter(
    (item) =>
      item.code.toLowerCase().includes(q) ||
      item.description.toLowerCase().includes(q)
  );

  return results.slice(0, 10);
}
