// =========================================================================
// SYSTEM LOOKUP METADATA
// Describes the eight global lookup tables a Super Admin maintains. The web
// portal renders one generic grid from this, and every driver uses it to
// validate writes, so a field's rules live in exactly one place.
// Column names here are the only ones a driver may interpolate into SQL.
// =========================================================================
import type { CouncilLookupTableName, LookupTableName, LookupValues } from './contract';
import { OFFICE_ROLE_NAMES } from './elections';
import { cleanBudgetCategory } from './budget';
import { FIXED_CATEGORY_NAMES } from './mission-categories';
import { cleanActivity, cleanCouncilDonationMethod, cleanDonationType, RECORD_LABELS } from './maintenance';
import { assertInteger, assertText, BusinessRuleError } from './rules';

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
    references: [
      { table: 'MemberRoles', column: 'RoleID' },
      { table: 'CouncilElectionBallot', column: 'RoleID' },
      { table: 'OfficerNominations', column: 'OfficeRoleID' },
      { table: 'CouncilLeadershipHistory', column: 'RoleID' },
    ],
    protectedValues: [...OFFICE_ROLE_NAMES], // elections, appointments and finance access are resolved by these names
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
      { table: 'Meeting', column: 'CategoryID' },
      { table: 'CharitableRequest', column: 'CategoryID' },
    ],
    protectedValues: FIXED_CATEGORY_NAMES, // Sprint 6L Extension 4: the six fixed categories carry Supreme couplings
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

// =========================================================================
// COUNCIL-SPECIFIC LOOKUPS (Sprint 5L)
// Activities, DonationType, CouncilDonationMethod and CouncilBudgetCategory (Sprint 5Y-3) rows belong to one council each. Who may read and write
// them is decided in rules.ts (assertMayManageCouncilLookups); deletes and their RECORD_IN_USE guard use the
// maintenance tables (RECORD_REFERENCES). Column names here are the only ones a driver may interpolate into SQL.
// =========================================================================

export interface CouncilLookupTableMeta {
  /** Columns a record sets, besides id and CouncilID. */
  columns: readonly string[];
  /** The column no two of a council's rows may share (ignoring case); rows are listed in its order. */
  keyField: string;
  /** Columns pointing at another table's id, which the driver checks exist. */
  foreignKeys: readonly { column: string; table: 'Category' | 'DonationMethod'; label: string }[];
  /** Validates one record's fields (without id and CouncilID). */
  clean(record: Record<string, unknown>, councilId: number): Record<string, string | number | null>;
}

export const COUNCIL_LOOKUP_META: Record<CouncilLookupTableName, CouncilLookupTableMeta> = {
  Activities: {
    columns: ['ActivityName', 'ActivityDescription', 'CategoryID'],
    keyField: 'ActivityName',
    foreignKeys: [{ column: 'CategoryID', table: 'Category', label: 'activity category' }],
    clean: (record, councilId) => {
      const { CouncilID: _council, ...fields } = cleanActivity({ ...record, CouncilID: councilId } as never);
      return fields;
    },
  },
  DonationType: {
    columns: ['DonationType'],
    keyField: 'DonationType',
    foreignKeys: [],
    clean: (record) => cleanDonationType(record),
  },
  CouncilDonationMethod: {
    columns: ['DonationMethodID', 'DonationMethodURL'],
    keyField: 'DonationMethodID',
    foreignKeys: [{ column: 'DonationMethodID', table: 'DonationMethod', label: 'donation method' }],
    clean: (record) => cleanCouncilDonationMethod(record),
  },
  CouncilBudgetCategory: {
    columns: ['CategoryName'],
    keyField: 'CategoryName',
    foreignKeys: [],
    clean: (record) => cleanBudgetCategory(record),
  },
};

/** What lookups.saveCouncilSpecific writes, once every record has been validated. */
export interface CouncilLookupSavePlan {
  inserts: Record<string, string | number | null>[];
  updates: { id: number; values: Record<string, string | number | null> }[];
}

const keyOf = (v: unknown) => (typeof v === 'number' ? String(v) : norm(v));

/**
 * Validates a saveCouncilSpecific batch against the council's current rows of `table` (`councilRows`): each
 * record's fields, that an id is one of the council's rows and appears once, that no record names another
 * council, and that the council's key values stay unique once the whole batch is applied (so two rows may swap
 * names in one save). Foreign keys are left to the driver.
 */
export function planCouncilLookupSave(
  table: CouncilLookupTableName,
  councilId: number,
  councilRows: readonly Record<string, unknown>[],
  records: unknown,
): CouncilLookupSavePlan {
  const meta = COUNCIL_LOOKUP_META[table];
  const label = RECORD_LABELS[table];
  if (!Array.isArray(records)) throw invalid(`${label} records must be an array.`, { table });
  const plan: CouncilLookupSavePlan = { inserts: [], updates: [] };
  const seen = new Set<number>();
  for (const record of records as unknown[]) {
    if (typeof record !== 'object' || record === null || Array.isArray(record)) {
      throw invalid(`Each ${label.toLowerCase()} record must be an object.`, { table });
    }
    const { id, CouncilID, ...fields } = record as Record<string, unknown>;
    if (CouncilID !== undefined && CouncilID !== councilId) {
      throw invalid(`${label} records saved for council ${councilId} cannot name council ${String(CouncilID)}.`, { table, councilId });
    }
    const values = meta.clean(fields, councilId);
    if (id === undefined || id === null) {
      plan.inserts.push(values);
      continue;
    }
    const rowId = assertInteger(id, `${label} id`, 1);
    if (seen.has(rowId)) throw invalid(`${label} ${rowId} is listed more than once.`, { table, id: rowId });
    seen.add(rowId);
    if (!councilRows.some((r) => r.id === rowId)) {
      throw new BusinessRuleError('RECORD_NOT_FOUND', `${label} ${rowId} does not exist in council ${councilId}.`, { table, id: rowId, councilId });
    }
    plan.updates.push({ id: rowId, values });
  }

  const updated = new Map(plan.updates.map((u) => [u.id, u.values]));
  const after = [
    ...councilRows.map((r) => ({ id: r.id, key: (updated.get(r.id as number) ?? r)[meta.keyField] })),
    ...plan.inserts.map((v) => ({ id: null, key: v[meta.keyField] })),
  ];
  const byKey = new Map<string, unknown>();
  for (const { id, key } of after) {
    const k = keyOf(key);
    if (byKey.has(k)) {
      const clash = byKey.get(k);
      throw invalid(
        `${label} "${String(key)}" would be used twice in council ${councilId}${clash === null ? '' : ` (id ${String(clash)})`}; values must be unique.`,
        { table, councilId, field: meta.keyField, existingId: clash ?? id },
      );
    }
    byKey.set(k, id);
  }
  return plan;
}

/** A council's lookup rows in listing order: the key field (numerically for ids, else ignoring case), then id. */
export function sortCouncilLookupRows<R extends { id: number }>(table: CouncilLookupTableName, rows: readonly R[]): R[] {
  const key = COUNCIL_LOOKUP_META[table].keyField;
  const value = (r: R) => (r as unknown as Record<string, unknown>)[key];
  return [...rows].sort((a, b) => {
    const [x, y] = [value(a), value(b)];
    const byKey = typeof x === 'number' && typeof y === 'number' ? x - y : norm(x).localeCompare(norm(y));
    return byKey || a.id - b.id;
  });
}
