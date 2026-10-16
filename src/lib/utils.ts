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