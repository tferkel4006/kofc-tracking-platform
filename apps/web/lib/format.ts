import { BusinessRuleError } from '@kofc/shared';

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

/** A stored number back into a form field. */
export const toField = (value: number | null | undefined): string => (value == null ? '' : String(value));

/** Minutes are stored as a blob URL with the original file name after the #, so the name survives in MinutesURL. */
export function minutesFileName(url: string | undefined | null): string | null {
  if (!url) return null;
  const hash = url.indexOf('#');
  return hash >= 0 ? decodeURIComponent(url.slice(hash + 1)) : url;
}
