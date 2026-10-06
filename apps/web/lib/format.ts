import { BusinessRuleError, isDriveFileId } from '@kofc/shared';

const dollars = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

/** $1,234.50, or an en dash for a value that was never entered. */
export const formatMoney = (value: number | null | undefined): string => (value == null ? '–' : dollars.format(value));

/** Text from a form field to a number; blank means "not entered". Anything non-numeric is refused with the field named. */
export function parseNumberField(text: string, label: string): number | null {
  const trimmed = text.trim().replace(/[$,]/g, '');
  if (trimmed === '') return null;
  const value = Number(trimmed);
  if (!Number.isFinite(value)) {
    throw new BusinessRuleError('INVALID_INPUT', `${label} must be a number; received "${text}".`, { label });
  }
  return value;
}

/** A 10-digit US number as (503) 555-0199 (a leading 1 is dropped); anything else is shown as typed, blank as an en dash. */
export function formatPhone(value: string | null | undefined): string {
  if (!value?.trim()) return '–';
  const digits = value.replace(/\D/g, '');
  const local = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits;
  return local.length === 10 ? `(${local.slice(0, 3)}) ${local.slice(3, 6)}-${local.slice(6)}` : value.trim();
}

/** Street lines, then "City, ST", skipping blanks: "100 Church St, Suite 2, Portland, OR". */
export function formatAddress(parts: {
  StreetAddress1?: string | null;
  StreetAddress2?: string | null;
  City?: string | null;
  State?: string | null;
}): string {
  const lines = [parts.StreetAddress1, parts.StreetAddress2, [parts.City, parts.State].filter((p) => p?.trim()).join(', ')];
  return lines.filter((l) => l?.trim()).join(', ') || '–';
}

/** "Last, First" for sorted lists and grids. */
export const formatPersonName = (first: string, last: string): string => [last, first].filter((p) => p.trim()).join(', ');

/** An optional form field to the driver: blank becomes null, which clears the stored value. */
export const blankToNull = (text: string): string | null => (text.trim() === '' ? null : text);

/** A stored number back into a form field. */
export const toField = (value: number | null | undefined): string => (value == null ? '' : String(value));

/** Minutes are stored as a blob URL with the original file name after the #, so the name survives in MinutesURL. */
export function minutesFileName(url: string | undefined | null): string | null {
  if (!url) return null;
  if (isDriveFileId(url)) return 'Minutes (Google Drive)';
  const hash = url.indexOf('#');
  return hash >= 0 ? decodeURIComponent(url.slice(hash + 1)) : url;
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** '2026-09-12' -> 'Sep 12, 2026', for logs that span years. Blank shows an en dash. */
export function formatFullDate(date: string | null | undefined): string {
  const m = date ? /^(\d{4})-(\d{2})-(\d{2})/.exec(date) : null;
  return m ? `${MONTH_NAMES[Number(m[2]) - 1]} ${Number(m[3])}, ${m[1]}` : '–';
}

/** Decimal hours for totals: 5.75 -> '5.75', 4 -> '4'. */
export const formatDecimalHours = (hours: number): string => hours.toLocaleString('en-US', { maximumFractionDigits: 2 });
