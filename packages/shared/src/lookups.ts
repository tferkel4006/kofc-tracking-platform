// =========================================================================
// SYSTEM LOOKUP METADATA
// Describes the eight global lookup tables a Super Admin maintains. The web
// portal renders one generic grid from this, and every driver uses it to
// validate writes, so a field's rules live in exactly one place.
// Column names here are the only ones a driver may interpolate into SQL.
// =========================================================================
import type { LookupTableName, LookupValues } from './contract';
import { assertText, BusinessRuleError } from './rules';

export interface LookupFieldMeta {
  /** Column name in the table. */
  key: string;
  label: string;
  /** 'code' is one uppercase letter, 'flag' is 0 or 1. */
  kind: 'text' | 'code' | 'flag';
  required: boolean;
  maxLength: number;
}

export interface LookupTableMeta {
  label: string;
  fields: LookupFieldMeta[];
  /** The column that names a row to humans; unique within the table, ignoring case. */
  keyField: string;
  /** Every column elsewhere in the schema that points at this table's id. */
  references: { table: string; column: string }[];
  /** keyField values the application looks up by name, so they may not be renamed or deleted. */
  protectedValues: string[];
}

/** Tab order in the System Lookup grid. */
export const LOOKUP_TABLE_ORDER: LookupTableName[] = [
  'MemberStatus',
  'Role',
  'Degree',
  'MemberType',
  'Category',
  'NoShowReason',
  'MeetingType',
  'LessonsLearnedCategory',
];

const text = (key: string, label: string, maxLength: number, required = true): LookupFieldMeta => ({
  key,
  label,
  kind: 'text',
  required,
  maxLength,
});

export const LOOKUP_META: Record<LookupTableName, LookupTableMeta> = {
  MemberStatus: {
    label: 'Member Status',
    fields: [text('Status', 'Status', 30)],
    keyField: 'Status',
    references: [{ table: 'Member', column: 'StatusID' }],
    protectedValues: ['Active'], // "active members" is resolved by this name
  },
  Role: {
    label: 'Role',
    fields: [text('Role', 'Role', 50), { key: 'Officer', label: 'Officer', kind: 'flag', required: true, maxLength: 1 }],
    keyField: 'Role',
    references: [{ table: 'MemberRoles', column: 'RoleID' }],
    protectedValues: [],
  },
  Degree: {
    label: 'Degree',
    fields: [text('Degree', 'Degree', 10)],
    keyField: 'Degree',
    references: [{ table: 'Member', column: 'DegreeID' }],
    protectedValues: [],
  },
  MemberType: {
    label: 'Member Type',
    fields: [text('Type', 'Type', 15)],
    keyField: 'Type',
    references: [{ table: 'Member', column: 'MemberTypeID' }],
    protectedValues: ['Super Admin', 'Admin', 'Member'], // access control is resolved by these names
  },
  Category: {
    label: 'Category',
    fields: [text('Category', 'Category', 100), text('CategoryDescription', 'Description', 255)],
    keyField: 'Category',
    references: [
      { table: 'Event', column: 'CategoryID' },
      { table: 'Activities', column: 'CategoryID' },
    ],
    protectedValues: [],
  },
  NoShowReason: {
    label: 'No-Show Reason',
    fields: [
      { key: 'NoShowReasonCode', label: 'Code', kind: 'code', required: true, maxLength: 1 },
      text('NoShowReasonDescription', 'Description', 100),
    ],
    keyField: 'NoShowReasonCode',
    references: [{ table: 'EventSignup', column: 'NoShowReasonID' }],
    protectedValues: [],
  },
  MeetingType: {
    label: 'Meeting Type',
    fields: [text('Type', 'Type', 50), text('Description', 'Description', 255, false)],
    keyField: 'Type',
    references: [{ table: 'Meeting', column: 'MeetingType' }],
    protectedValues: [],
  },
  LessonsLearnedCategory: {
    label: 'Lessons Learned Category',
    fields: [text('LessonsLearnedCategory', 'Category', 30)],
    keyField: 'LessonsLearnedCategory',
    references: [{ table: 'LessonsLearned', column: 'LeassonsLearnedCategoryID' }], // sic: the schema's spelling
    protectedValues: [],
  },
};

const invalid = (message: string, details: Record<string, unknown> = {}) =>
  new BusinessRuleError('INVALID_INPUT', message, details);

/** Returns exactly the table's fields, trimmed and checked; rejects unknown fields and bad values. */
export function cleanLookupValues(table: LookupTableName, values: LookupValues): LookupValues {
  const meta = LOOKUP_META[table];
  for (const key of Object.keys(values)) {
    if (!meta.fields.some((f) => f.key === key)) {
      throw invalid(
        `${meta.label} has no field "${key}"; its fields are ${meta.fields.map((f) => f.key).join(', ')}.`,
        { table, field: key },
      );
    }
  }
  const out: LookupValues = {};
  for (const field of meta.fields) {
    const raw = values[field.key];
    const label = `${meta.label} ${field.label}`;
    if (field.kind === 'flag') {
      const flag = raw === undefined ? 0 : raw;
      if (flag !== 0 && flag !== 1) throw invalid(`${label} must be 0 or 1; received ${String(raw)}.`, { table });
      out[field.key] = flag;
    } else if (field.kind === 'code') {
      const code = assertText(raw, label, field.maxLength).toUpperCase();
      if (!/^[A-Z]$/.test(code)) throw invalid(`${label} must be a single letter A-Z; received "${code}".`, { table });
      out[field.key] = code;
    } else {
      out[field.key] = assertText(raw ?? '', label, field.maxLength, field.required);
    }
  }
  return out;
}

const norm = (v: unknown) => String(v ?? '').trim().toLowerCase();

/** Rejects a row whose keyField already exists (ignoring case) on another row. */
export function assertLookupKeyUnique(
  table: LookupTableName,
  rows: readonly Record<string, unknown>[],
  cleaned: LookupValues,
  ignoreId?: number,
): void {
  const { keyField, label } = LOOKUP_META[table];
  const clash = rows.find((r) => r.id !== ignoreId && norm(r[keyField]) === norm(cleaned[keyField]));
  if (clash) {
    throw invalid(`${label} "${cleaned[keyField]}" already exists (id ${String(clash.id)}); values must be unique.`, {
      table,
      existingId: clash.id,
    });
  }
}

/** A protected row can be edited but its keyField may not change. Pass `cleaned = null` to test a delete. */
export function assertLookupNotProtected(
  table: LookupTableName,
  current: Record<string, unknown>,
  cleaned: LookupValues | null,
): void {
  const { keyField, label, protectedValues } = LOOKUP_META[table];
  const isProtected = protectedValues.some((v) => norm(v) === norm(current[keyField]));
  if (isProtected && (cleaned === null || norm(cleaned[keyField]) !== norm(current[keyField]))) {
    throw new BusinessRuleError(
      'LOOKUP_PROTECTED',
      `${label} "${String(current[keyField])}" is built into the application and cannot be ${cleaned === null ? 'deleted' : 'renamed'}.`,
      { table, id: current.id },
    );
  }
}

/** Rejects a delete while other rows still point at the lookup row. `usage` holds a count per reference. */
export function assertLookupUnused(
  table: LookupTableName,
  current: Record<string, unknown>,
  usage: readonly { table: string; column: string; count: number }[],
): void {
  const used = usage.filter((u) => u.count > 0);
  if (used.length === 0) return;
  const { keyField, label } = LOOKUP_META[table];
  throw new BusinessRuleError(
    'LOOKUP_IN_USE',
    `${label} "${String(current[keyField])}" is still in use and cannot be deleted: ${used
      .map((u) => `${u.count} row${u.count === 1 ? '' : 's'} in ${u.table}.${u.column}`)
      .join(', ')}.`,
    { table, id: current.id, usage: used },
  );
}
