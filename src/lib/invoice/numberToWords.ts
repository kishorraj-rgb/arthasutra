// @ts-nocheck
const ones = [
  '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
  'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
  'Seventeen', 'Eighteen', 'Nineteen',
];

const tens = [
  '', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety',
];

function twoDigitWords(n) {
  if (n < 20) return ones[n];
  const t = Math.floor(n / 10);
  const o = n % 10;
  return tens[t] + (o ? ' ' + ones[o] : '');
}

function threeDigitWords(n) {
  if (n === 0) return '';
  const h = Math.floor(n / 100);
  const rem = n % 100;
  let result = '';
  if (h > 0) result += ones[h] + ' Hundred';
  if (rem > 0) result += (h > 0 ? ' ' : '') + twoDigitWords(rem);
  return result;
}

export function numberToWords(num) {
  if (num === 0) return 'Zero';

  const isNegative = num < 0;
  num = Math.abs(num);

  const intPart = Math.floor(num);
  const decPart = Math.round((num - intPart) * 100);

  let result = '';
  let n = intPart;

  if (n === 0) {
    result = 'Zero';
  } else {
    const crore = Math.floor(n / 10000000);
    n %= 10000000;
    const lakh = Math.floor(n / 100000);
    n %= 100000;
    const thousand = Math.floor(n / 1000);
    n %= 1000;
    const hundred = n;

    const parts = [];
    if (crore > 0) parts.push(threeDigitWords(crore) + ' Crore');
    if (lakh > 0) parts.push(twoDigitWords(lakh) + ' Lakh');
    if (thousand > 0) parts.push(twoDigitWords(thousand) + ' Thousand');
    if (hundred > 0) parts.push(threeDigitWords(hundred));
    result = parts.join(' ');
  }

  if (decPart > 0) {
    result += ' and ' + twoDigitWords(decPart) + ' Paise';
  }

  return (isNegative ? 'Minus ' : '') + result;
}

export function amountInWords(amount, currency = 'INR') {
  const words = numberToWords(amount);
  if (currency === 'INR') {
    return 'Indian Rupee ' + words + ' Only';
  }
  return words;
}
