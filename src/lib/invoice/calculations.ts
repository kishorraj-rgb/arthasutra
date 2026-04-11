// @ts-nocheck
import { extractStateCodeFromGstin } from './states';

export function calculateItemAmount(item, gstInclusive = false) {
  const total = (item.qty || 0) * (item.rate || 0);
  if (gstInclusive && item.gstRate > 0) {
    // Back-calculate base amount from GST-inclusive rate
    return total / (1 + item.gstRate / 100);
  }
  return total;
}

export function getBaseRate(item, gstInclusive = false) {
  if (gstInclusive && item.gstRate > 0) {
    return (item.rate || 0) / (1 + item.gstRate / 100);
  }
  return item.rate || 0;
}

export function calculateSubtotal(items, gstInclusive = false) {
  return items.reduce((sum, item) => sum + calculateItemAmount(item, gstInclusive), 0);
}

export function isInterState(sellerGstin, placeOfSupplyCode) {
  if (!sellerGstin || !placeOfSupplyCode) return true;
  const sellerState = extractStateCodeFromGstin(sellerGstin);
  return sellerState !== placeOfSupplyCode;
}

export function calculateTaxBreakdown(items, sellerGstin, placeOfSupplyCode, gstInclusive = false) {
  const interState = isInterState(sellerGstin, placeOfSupplyCode);
  let totalIgst = 0;
  let totalCgst = 0;
  let totalSgst = 0;

  const itemDetails = items.map((item) => {
    const taxable = calculateItemAmount(item, gstInclusive);
    const gstRate = item.gstRate || 0;
    const gstAmount = (taxable * gstRate) / 100;

    if (interState) {
      totalIgst += gstAmount;
      return { ...item, taxable, igst: gstAmount, cgst: 0, sgst: 0 };
    } else {
      const half = gstAmount / 2;
      totalCgst += half;
      totalSgst += half;
      return { ...item, taxable, igst: 0, cgst: half, sgst: half };
    }
  });

  return { itemDetails, totalIgst, totalCgst, totalSgst, interState };
}

export function calculateInvoiceTotals(data) {
  const isGstRegistered = Boolean(data.seller.gstin);
  const gstInclusive = data.gstInclusive || false;
  const subtotal = calculateSubtotal(data.items, gstInclusive);

  let taxBreakdown = null;
  let totalTax = 0;

  if (isGstRegistered) {
    taxBreakdown = calculateTaxBreakdown(
      data.items,
      data.seller.gstin,
      data.placeOfSupplyCode,
      gstInclusive
    );
    totalTax =
      taxBreakdown.totalIgst + taxBreakdown.totalCgst + taxBreakdown.totalSgst;
  }

  const grossTotal = subtotal + totalTax;

  let tdsAmount = 0;
  if (data.tdsEnabled && data.tdsRate > 0) {
    tdsAmount = (subtotal * data.tdsRate) / 100;
  }

  const netBeforeRound = grossTotal - tdsAmount;

  let roundOffAmount = 0;
  let netTotal = netBeforeRound;
  if (data.roundOff) {
    netTotal = Math.round(netBeforeRound);
    roundOffAmount = netTotal - netBeforeRound;
  }

  return {
    subtotal,
    taxBreakdown,
    totalTax,
    grossTotal,
    tdsAmount,
    roundOffAmount,
    netTotal,
    isGstRegistered,
  };
}
