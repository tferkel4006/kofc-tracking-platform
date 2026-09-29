// =========================================================================
// COUNCIL-LEVEL MAINTENANCE RULES
// Field validation, uniqueness and delete guards for the rows the admin portal maintains: councils,
// parishes, pastors, activities and distribution lists. Shared by every driver so a bad value is refused
// with the same message everywhere. Who may write is decided in rules.ts (assertMayMaintainCouncils,
// assertMayMaintainCouncilRecords); column names here are the only ones a driver may interpolate into SQL.
//
// Deletes never cascade: a row that other rows point at is kept (RECORD_IN_USE) so logged hours,
// donations and messages keep their history. A distribution list's member entries are the one exception;
// they belong to the list and go with it.
// =========================================================================
import type {
  DistributionListChanges,
  NewActivity,
  NewCouncil,
  NewDistributionList,
  NewParish,
  NewPastor,
  RecordChanges,
} from './contract';
import { assertInteger, assertText, BusinessRuleError, optionalText } from './rules';

export type MaintainedTable =
  | 'Council'
  | 'Parish'
  | 'Pastor'
  | 'Activities'
  | 'DistributionLists'
  | 'DonationType'
  | 'CouncilDonationMethod'
  | 'CouncilBudgetCategory';

/** What a maintained row is called in messages. */
export const RECORD_LABELS: Record<MaintainedTable, string> = {
  Council: 'Council',
  Parish: 'Parish',
  Pastor: 'Pastor',
  Activities: 'Activity',
  DistributionLists: 'Distribution list',
  DonationType: 'Donation type',
  CouncilDonationMethod: 'Donation method',
  CouncilBudgetCategory: 'Budget category',
};

export interface RecordReference {
  table: string;
  column: string;
  /** How a referencing row reads in a message: [one, many]. */
  noun: readonly [string, string];
}

/**
 * Every column that points at a maintained table's id, whether or not Schema.sql declares the foreign key
 * (EventCouncils, AffiliatedCouncils and DistributionLists do not). A delete is refused while any row matches.
 */
export const RECORD_REFERENCES: Record<MaintainedTable, readonly RecordReference[]> = {
  Council: [
    { table: 'Member', column: 'CouncilID', noun: ['member', 'members'] },
    { table: 'Parish', column: 'CouncilID', noun: ['parish', 'parishes'] },
    { table: 'EventCouncils', column: 'CouncilID', noun: ['event link', 'event links'] },
    { table: 'Meeting', column: 'CouncilID', noun: ['meeting', 'meetings'] },
    { table: 'Activities', column: 'CouncilID', noun: ['activity', 'activities'] },
    { table: 'DistributionLists', column: 'CouncilID', noun: ['distribution list', 'distribution lists'] },
    { table: 'ChatThreads', column: 'CouncilID', noun: ['message thread', 'message threads'] },
    { table: 'Donation', column: 'CouncilID', noun: ['donation', 'donations'] },
    { table: 'DonationType', column: 'CouncilID', noun: ['donation type', 'donation types'] },
    { table: 'CouncilDonationMethod', column: 'CouncilID', noun: ['donation method', 'donation methods'] },
    { table: 'ExpenseReport', column: 'CouncilID', noun: ['expense report', 'expense reports'] },
    { table: 'ExpenseDisbursement', column: 'CouncilID', noun: ['expense check', 'expense checks'] },
    { table: 'NotificationLog', column: 'CouncilID', noun: ['sent alert', 'sent alerts'] },
    { table: 'SupremeReportingSync', column: 'CouncilID', noun: ['Supreme report sync', 'Supreme report syncs'] },
    { table: 'CouncilElectionBallot', column: 'CouncilID', noun: ['election ballot seat', 'election ballot seats'] },
    { table: 'OfficerNominations', column: 'CouncilID', noun: ['officer nomination', 'officer nominations'] },
    { table: 'CouncilLeadershipHistory', column: 'CouncilID', noun: ['leadership history entry', 'leadership history entries'] },
    { table: 'CouncilCharityLink', column: 'CouncilID', noun: ['connected charity', 'connected charities'] },
    { table: 'CharityDonationProposal', column: 'CouncilID', noun: ['charity proposal', 'charity proposals'] },
    { table: 'CharitableDisbursementLedger', column: 'CouncilID', noun: ['charity check', 'charity checks'] },
    { table: 'CouncilBudgetForecast', column: 'CouncilID', noun: ['budget line', 'budget lines'] },
    { table: 'CouncilBudgetCategory', column: 'CouncilID', noun: ['budget category', 'budget categories'] },
    { table: 'CouncilMeetingType', column: 'CouncilID', noun: ['meeting type', 'meeting types'] },
    { table: 'CouncilAgendaTemplate', column: 'CouncilID', noun: ['agenda template', 'agenda templates'] },
    { table: 'AffiliatedCouncils', column: 'PrimaryCouncilID', noun: ['affiliation', 'affiliations'] },
    { table: 'AffiliatedCouncils', column: 'AffiliatedCouncilID', noun: ['affiliation', 'affiliations'] },
  ],
  Parish: [{ table: 'Pastor', column: 'ParishID', noun: ['pastor', 'pastors'] }],
  Pastor: [],
  Activities: [{ table: 'ActivityTime', column: 'ActivityID', noun: ['time entry', 'time entries'] }],
  DistributionLists: [], // DistributionListMembers rows are deleted with their list
  DonationType: [{ table: 'Donation', column: 'DonationTypeID', noun: ['donation', 'donations'] }],
  CouncilDonationMethod: [], // donations point at DonationMethod, so disabling a method keeps their history
  CouncilBudgetCategory: [{ table: 'CouncilBudgetForecast', column: 'BudgetCategoryID', noun: ['budget line', 'budget lines'] }],
};

/** Columns each maintained table's create/update writes, besides its id. */
export const COUNCIL_COLUMNS = ['CouncilNumber', 'CouncilName', 'State', 'Phone', 'Email'] as const satisfies readonly (keyof NewCouncil)[];
export const PARISH_COLUMNS = [
  'Name',
  'StreetAddress1',
  'StreetAddress2',
  'City',
  'State',
  'Phone',
  'CouncilID',
] as const satisfies readonly (keyof NewParish)[];
export const PASTOR_COLUMNS = ['FirstName', 'LastName', 'Phone', 'Email', 'ParishID'] as const satisfies readonly (keyof NewPastor)[];
export const ACTIVITY_COLUMNS = ['ActivityName', 'ActivityDescription', 'CategoryID', 'CouncilID'] as const satisfies readonly (keyof NewActivity)[];

const invalid = (message: string, details: Record<string, unknown> = {}) =>
  new BusinessRuleError('INVALID_INPUT', message, details);

function assertKnownFields(input: object, columns: readonly string[], table: MaintainedTable): void {
  for (const key of Object.keys(input)) {
    if (!columns.includes(key)) {
      throw invalid(`${RECORD_LABELS[table]} has no field "${key}"; its fields are ${columns.join(', ')}.`, { table, field: key });
    }
  }
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Lengths follow Schema.sql. Optional text comes back undefined when blank; drivers store it as NULL.

export function cleanCouncil(input: NewCouncil): NewCouncil {
  assertKnownFields(input, COUNCIL_COLUMNS, 'Council');
  const email = optionalText(input.Email, 'Email', 100);
  if (email !== null && !EMAIL.test(email)) throw invalid(`Email "${email}" is not a valid address.`, { email });
  return {
    CouncilNumber: assertInteger(input.CouncilNumber, 'Council number', 1),
    CouncilName: assertText(input.CouncilName ?? '', 'Council name', 100),
    State: assertText(input.State ?? '', 'State', 50),
    Phone: optionalText(input.Phone, 'Phone', 50) ?? undefined,
    Email: email ?? undefined,
  };
}

export function cleanParish(input: NewParish): NewParish {
  assertKnownFields(input, PARISH_COLUMNS, 'Parish');
  return {
    Name: assertText(input.Name ?? '', 'Parish name', 100),
    StreetAddress1: assertText(input.StreetAddress1 ?? '', 'Street address', 255),
    StreetAddress2: optionalText(input.StreetAddress2, 'Street address line 2', 255) ?? undefined,
    City: assertText(input.City ?? '', 'City', 50),
    State: assertText(input.State ?? '', 'State', 50),
    Phone: optionalText(input.Phone, 'Phone', 50) ?? undefined,
    CouncilID: assertInteger(input.CouncilID, 'Council', 1),
  };
}

export function cleanPastor(input: NewPastor): NewPastor {
  assertKnownFields(input, PASTOR_COLUMNS, 'Pastor');
  const email = optionalText(input.Email, 'Email', 50);
  if (email !== null && !EMAIL.test(email)) throw invalid(`Email "${email}" is not a valid address.`, { email });
  return {
    FirstName: assertText(input.FirstName ?? '', 'First name', 50),
    LastName: assertText(input.LastName ?? '', 'Last name', 50),
    Phone: optionalText(input.Phone, 'Phone', 50) ?? undefined,
    Email: email ?? undefined,
    ParishID: assertInteger(input.ParishID, 'Parish', 1),
  };
}

export function cleanActivity(input: NewActivity): NewActivity {
  assertKnownFields(input, ACTIVITY_COLUMNS, 'Activities');
  return {
    ActivityName: assertText(input.ActivityName ?? '', 'Activity name', 100),
    ActivityDescription: assertText(input.ActivityDescription ?? '', 'Activity description', 255),
    CategoryID: assertInteger(input.CategoryID, 'Category', 1),
    CouncilID: assertInteger(input.CouncilID, 'Council', 1),
  };
}

/** A council donation type (Sprint 5L council lookups). */
export function cleanDonationType(input: { DonationType?: unknown }): { DonationType: string } {
  assertKnownFields(input, ['DonationType'], 'DonationType');
  return { DonationType: assertText(input.DonationType ?? '', 'Donation type', 100) };
}

/** A donation method a council enables, with the optional QR image URL that routes payments to its account. */
export function cleanCouncilDonationMethod(input: { DonationMethodID?: unknown; DonationMethodURL?: unknown }): {
  DonationMethodID: number;
  DonationMethodURL: string | null;
} {
  assertKnownFields(input, ['DonationMethodID', 'DonationMethodURL'], 'CouncilDonationMethod');
  return {
    DonationMethodID: assertInteger(input.DonationMethodID, 'Donation method', 1),
    DonationMethodURL: optionalText(input.DonationMethodURL, 'Donation method URL', 255),
  };
}

export const cleanListName = (name: unknown): string => assertText(name ?? '', 'List name', 100);

/** Whole-number member ids, duplicates removed, ascending. Existence and council are checked by the driver. */
export function cleanMemberIds(ids: unknown): number[] {
  if (!Array.isArray(ids)) throw invalid(`List members must be a list of member ids; received ${JSON.stringify(ids)}.`);
  return [...new Set(ids.map((id) => assertInteger(id, 'Member id', 1)))].sort((a, b) => a - b);
}

export function cleanNewDistributionList(input: NewDistributionList): NewDistributionList {
  assertKnownFields(input, ['ListName', 'CouncilID', 'memberIds'], 'DistributionLists');
  return {
    ListName: cleanListName(input.ListName),
    CouncilID: assertInteger(input.CouncilID, 'Council', 1),
    memberIds: cleanMemberIds(input.memberIds ?? []),
  };
}

export function cleanDistributionListChanges(changes: DistributionListChanges): DistributionListChanges {
  assertKnownFields(changes, ['ListName', 'memberIds'], 'DistributionLists');
  return {
    ...(changes.ListName === undefined ? {} : { ListName: cleanListName(changes.ListName) }),
    ...(changes.memberIds === undefined ? {} : { memberIds: cleanMemberIds(changes.memberIds) }),
  };
}

/**
 * update: applies `changes` over the stored row's `columns` so the result can be validated as a whole row.
 * Unknown fields are left in so the clean function names them.
 */
export function mergeRecordChanges<T extends object>(
  existing: Record<string, unknown>,
  changes: RecordChanges<T>,
  columns: readonly (keyof T & string)[],
): T {
  const current = Object.fromEntries(columns.map((c) => [c, existing[c] ?? undefined]));
  return { ...current, ...changes } as T;
}

const norm = (v: unknown) => String(v ?? '').trim().toLowerCase();

/** Rejects `value` when another row (not `ignoreId`) already has it in `field`, ignoring case. `scope` finishes "already used ...". */
export function assertRecordValueUnique(
  table: MaintainedTable,
  rows: readonly Record<string, unknown>[],
  field: string,
  value: string | number,
  scope: string,
  ignoreId?: number,
): void {
  const clash = rows.find((r) => r.id !== ignoreId && norm(r[field]) === norm(value));
  if (clash) {
    throw invalid(`${RECORD_LABELS[table]} "${value}" is already used ${scope} (id ${String(clash.id)}).`, {
      table,
      field,
      existingId: clash.id,
    });
  }
}

export function recordNotFound(table: MaintainedTable, id: number): BusinessRuleError {
  return new BusinessRuleError('RECORD_NOT_FOUND', `${RECORD_LABELS[table]} ${id} does not exist.`, { table, id });
}

/** Rejects a delete while other rows still point at the row. `usage` holds a count per RECORD_REFERENCES entry. */
export function assertRecordUnused(
  table: MaintainedTable,
  id: number,
  name: string,
  usage: readonly (RecordReference & { count: number })[],
): void {
  const used = usage.filter((u) => u.count > 0);
  if (used.length === 0) return;
  throw new BusinessRuleError(
    'RECORD_IN_USE',
    `${RECORD_LABELS[table]} "${name}" cannot be deleted while it is still in use: ${used
      .map((u) => `${u.count} ${u.noun[u.count === 1 ? 0 : 1]}`)
      .join(', ')}. Records that point at it are kept for history, so remove or reassign them first.`,
    { table, id, usage: used.map(({ table: t, column, count }) => ({ table: t, column, count })) },
  );
}
