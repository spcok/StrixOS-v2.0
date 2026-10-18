import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export function getLocalDateString(d: Date = new Date()): string {
  const validDate = Number.isNaN(d.getTime()) ? new Date() : d;
  const year = validDate.getFullYear();
  const month = String(validDate.getMonth() + 1).padStart(2, '0');
  const day = String(validDate.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatDisplayDate(dateStr?: string | null): string {
  if (!dateStr) return '--';
  const clean = dateStr.split('T')[0];
  if (!clean) return dateStr;
  const [y, m, d] = clean.split('-').map(Number);
  if (!y || !m || !d) return dateStr;
  const dateObj = new Date(y, m - 1, d);
  if (Number.isNaN(dateObj.getTime())) return dateStr;
  return dateObj.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function formatShortDate(dateStr?: string | null): string {
  if (!dateStr) return '--';
  const clean = dateStr.split('T')[0];
  if (!clean) return dateStr;
  const [y, m, d] = clean.split('-').map(Number);
  if (!y || !m || !d) return dateStr;
  const dateObj = new Date(y, m - 1, d);
  if (Number.isNaN(dateObj.getTime())) return dateStr;
  return dateObj.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
  });
}

export function formatDisplayTime(dateStr?: string | null): string {
  if (!dateStr) return '--:--';
  if (dateStr.length === 5 && dateStr.includes(':')) return dateStr;
  const dateObj = new Date(dateStr);
  if (Number.isNaN(dateObj.getTime())) return dateStr;
  return dateObj.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function extractDateInput(isoOrDate?: string | null): string {
  if (!isoOrDate) return '';
  if (isoOrDate.length === 10 && isoOrDate.includes('-')) return isoOrDate;
  const d = new Date(isoOrDate);
  return Number.isNaN(d.getTime()) ? '' : getLocalDateString(d);
}

export function extractTimeInput(isoOrTime?: string | null): string {
  if (!isoOrTime) return '';
  if (isoOrTime.length === 5 && isoOrTime.includes(':')) return isoOrTime;
  const d = new Date(isoOrTime);
  if (Number.isNaN(d.getTime())) return '';
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function combineDateAndTimeToISO(
  dateStr?: string | null,
  timeStr?: string | null
): string | null {
  if (!timeStr?.trim()) return null;
  if (timeStr.includes('T') && !Number.isNaN(new Date(timeStr).getTime())) {
    return new Date(timeStr).toISOString();
  }
  const baseDate = dateStr?.trim() ? dateStr.trim().split('T')[0] : getLocalDateString();
  const cleanTime = timeStr.length === 5 ? `${timeStr}:00` : timeStr;
  const combined = new Date(`${baseDate}T${cleanTime}`);
  return Number.isNaN(combined.getTime()) ? null : combined.toISOString();
}

export function formatGBP(amount?: number | string | null): string {
  const num = Number(amount || 0);
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
  }).format(Number.isNaN(num) ? 0 : num);
}

const GRAMS_PER_OZ = 28.349523125;

/** Converts grams into g, kg, oz, or lb/oz (with 1/8th oz falconry precision) */
export function formatWeightDisplay(
  grams: number | null | undefined,
  unit: string | null | undefined
): string | null {
  if (grams === null || grams === undefined) return null;

  const numGrams = Number(grams);
  if (Number.isNaN(numGrams)) return null;

  const safeUnit = String(unit || 'g').toLowerCase().trim();

  if (safeUnit === 'kg' || safeUnit === 'kilogram' || safeUnit === 'kilograms') {
    return `${(numGrams / 1000).toFixed(3)}kg`;
  }

  if (safeUnit === 'lb' || safeUnit === 'lbs' || safeUnit === 'pound' || safeUnit === 'pounds') {
    const totalOunces = numGrams / GRAMS_PER_OZ;
    let totalOzInt = Math.floor(totalOunces);
    let eighths = Math.round((totalOunces - totalOzInt) * 8);
    if (eighths >= 8) {
      totalOzInt += 1;
      eighths = 0;
    }
    const lb = Math.floor(totalOzInt / 16);
    const oz = totalOzInt % 16;
    let str = '';
    if (lb > 0) str += `${lb}lb `;
    if (oz > 0 || eighths > 0) str += `${oz}`;
    if (eighths > 0 && eighths !== 8) str += ` ${eighths}/8`;
    if (oz > 0 || eighths > 0) str += 'oz';
    return str.trim() || '0lb';
  }

  if (safeUnit === 'oz' || safeUnit === 'ounce' || safeUnit === 'ounces') {
    const totalOunces = numGrams / GRAMS_PER_OZ;
    let totalOzInt = Math.floor(totalOunces);
    let eighths = Math.round((totalOunces - totalOzInt) * 8);
    if (eighths >= 8) {
      totalOzInt += 1;
      eighths = 0;
    }
    let str = `${totalOzInt}`;
    if (eighths > 0 && eighths !== 8) str += ` ${eighths}/8`;
    return `${str}oz`;
  }

  return `${Math.round(numGrams)}g`;
}

/** Formats feed quantity and unit cleanly (e.g. '2x ', '45g ') */
export function formatQuantityDisplay(
  qty: number | string | null | undefined,
  unit: string | null | undefined
): string {
  if (qty === null || qty === undefined || String(qty).trim() === '') return '';
  const safeUnit = String(unit || '').toLowerCase().trim();
  if (
    safeUnit.includes('item') ||
    safeUnit.includes('whole') ||
    safeUnit === 'x' ||
    safeUnit === ''
  ) {
    return `${qty}x `;
  }
  if (safeUnit === 'grams' || safeUnit === 'g') {
    return `${qty}g `;
  }
  return `${qty}${unit} `;
}