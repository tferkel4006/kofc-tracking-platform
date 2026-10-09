import { expect } from 'vitest';
import { BusinessRuleError, type BusinessRuleCode, type DataService, type Shift } from '@kofc/shared';
import { MemoryDataService } from '../apps/web/services/drivers/memory';
import { SqliteDataService } from '../apps/mobile/services/drivers/sqlite';
import { openDatabases } from './shims/expo-sqlite';

/** "Today" for every test: Sunday 2026-09-20, noon local time. */
export const NOW = new Date(2026, 8, 20, 12, 0, 0);
const now = () => new Date(NOW);

export interface DriverUnderTest {
  name: 'memory' | 'sqlite';
  make(): Promise<DataService>;
  /** Row count straight from the backing store, bypassing the service, to prove rejected calls wrote nothing. */
  count(db: DataService, table: string): number;
  /** Raw Credentials rows straight from the backing store. */
  credentials(db: DataService): { Username: string; Password: string }[];
}

export const drivers: DriverUnderTest[] = [
  {
    name: 'memory',
    make: async () => {
      const db = new MemoryDataService({ now });
      await db.init();
      return db;
    },
    count: (db, table) => (db as MemoryDataService).debugStore.rows(table).length,
    credentials: (db) =>
      (db as MemoryDataService).debugStore.rows('Credentials') as unknown as { Username: string; Password: string }[],
  },
  {
    name: 'sqlite',
    make: async () => {
      openDatabases.length = 0; // so `openDatabases.at(-1)` is always this service's database
      const db = new SqliteDataService({ now });
      await db.init();
      return db;
    },
    // The most recently opened database belongs to the service the test just created.
    count: (_db, table) =>
      Number((openDatabases.at(-1)!.prepare(`SELECT COUNT(*) AS n FROM [${table}]`).get() as { n: number }).n),
    credentials: () =>
      openDatabases.at(-1)!.prepare('SELECT [Username], [Password] FROM [Credentials]').all() as unknown as {
        Username: string;
        Password: string;
      }[],
  },
];

/** Asserts the promise rejects with a BusinessRuleError carrying `code`; returns the error. */
export async function expectRule(promise: Promise<unknown>, code: BusinessRuleCode): Promise<BusinessRuleError> {
  const err = await promise.then(
    () => null,
    (e: unknown) => e,
  );
  expect(err, `expected BusinessRuleError ${code}`).toBeInstanceOf(BusinessRuleError);
  expect((err as BusinessRuleError).code).toBe(code);
  return err as BusinessRuleError;
}

export async function shiftByName(db: DataService, name: string): Promise<Shift> {
  const shift = (await db.events.listShiftsBetween('2000-01-01', '2100-12-31')).find((s) => s.ShiftName === name);
  if (!shift) throw new Error(`dev seed has no shift named ${name}`);
  return shift;
}

// Dev seed member ids: 1 super admin, 2 admin, 3 member, 4 newly enrolled (no password yet).
export const MEMBER = { superAdmin: 1, admin: 2, member: 3, newMember: 4 } as const;

/** Council 15295's operational activities from Seed.sql, ids 1-11 in name order. */
export const COUNCIL_ACTIVITIES = [
  'Bedding drive',
  'Coats for kids',
  'Food drive',
  'Greeting',
  'Meal delivery',
  'Planning',
  'Poop/Garbage patrol',
  'Socials',
  'Transporting',
  'Ultrasound',
  'Ushering',
] as const;

// ---- Sprint 6Q: the Treasurer's ledger coding ----------------------------------------------------------------

type RawRow = Record<string, string | number | null>;

/** Rows of `table` straight from the service's backing store. */
function rawRows(db: DataService, table: string, where: string, ...params: (string | number)[]): RawRow[] {
  if (db instanceof MemoryDataService) {
    const [column, value] = [where, params[0]];
    return db.debugStore.rows(table).filter((r) => r[column] === value) as unknown as RawRow[];
  }
  return openDatabases.at(-1)!.prepare(`SELECT * FROM [${table}] WHERE [${where}] = ?`).all(...params) as unknown as RawRow[];
}

/** Inserts a row straight into the service's backing store; resolves to its id. */
function rawInsert(db: DataService, table: string, row: RawRow): number {
  if (db instanceof MemoryDataService) return db.debugStore.insert(table, row).id as number;
  const cols = Object.keys(row);
  const res = openDatabases
    .at(-1)!
    .prepare(`INSERT INTO [${table}] (${cols.map((c) => `[${c}]`).join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`)
    .run(...Object.values(row));
  return Number(res.lastInsertRowid);
}

const ledgerCoders = new WeakMap<DataService, number>();

/**
 * A Super Admin who signs only the Treasurer's line in tests, so the seeded Financial Secretary and Grand Knight keep
 * their own lines (one person may not sign two). Created on first use per service.
 */
export async function ledgerCoder(db: DataService): Promise<number> {
  const known = ledgerCoders.get(db);
  if (known !== undefined) return known;
  const types = await db.lookups.list('MemberType');
  const statuses = await db.lookups.list('MemberStatus');
  const member = await db.members.create(MEMBER.superAdmin, {
    CouncilID: 1,
    MemberNumber: 7788001,
    MemberFirstName: 'Ledger',
    MemberLastName: 'Coder',
    Phone: '503-555-0188',
    StreetAddress1: '3 Charity Way',
    City: 'Salem',
    State: 'OR',
    ZipCode: '97301',
    Email: 'ledger.coder@example.org',
    DateOfBirth: '1969-04-04',
    StatusID: statuses.find((s) => s.Status === 'Active')!.id,
    DegreeID: 3,
    MemberTypeID: types.find((t) => t.Type === 'Super Admin')!.id,
  });
  ledgerCoders.set(db, member.id);
  return member.id;
}

/** An Approved budget line of the council for the tests' fraternal year, made on first use. */
export function testBudgetLine(db: DataService, councilId: number): number {
  const line = rawRows(db, 'CouncilBudgetForecast', 'CouncilID', councilId).find(
    (l) => l.LineItemName === 'Treasurer Coding Line' && l.FraternalYear === '2026-2027',
  );
  if (line) return line.id as number;
  return rawInsert(db, 'CouncilBudgetForecast', {
    CouncilID: councilId,
    FraternalYear: '2026-2027',
    CategoryType: 'Operational',
    ReferenceSourceID: null,
    LineItemName: 'Treasurer Coding Line',
    PrePopulatedAmount: 0,
    ProposedBudgetAmount: 1000,
    ApprovedBudgetAmount: 1000,
    BudgetStatus: 'Approved',
    quantity: 1,
    unit_cost: 0,
    budget_version: 1,
    universal_category: null,
  });
}

/** An Expense account of the council's chart (Event Operational Costs in the seed), made when it has none. */
export function testExpenseAccount(db: DataService, councilId: number): number {
  const accounts = rawRows(db, 'GLAccount', 'CouncilID', councilId);
  const expense = accounts.find((a) => a.AccountName === 'Event Operational Costs') ?? accounts.find((a) => a.AccountType === 'Expense');
  if (expense) return expense.id as number;
  return rawInsert(db, 'GLAccount', { CouncilID: councilId, AccountName: 'Test Expenses', AccountType: 'Expense', ParentAccountID: null, IsVirtualGoal: 0, TargetGoalAmount: 0 });
}

/**
 * Sprint 6Q: codes a sheet that carries the written order on the Treasurer Ledger Audit Desk, as ledgerCoder, with a
 * test budget line and expense account unless others are given. A sheet that is not at that stage is left alone, so the
 * call can sit in front of any counter-signature.
 */
export async function treasurerCode(db: DataService, reportId: number, coding: { budgetLineId?: number; generalLedgerAccountId?: number } = {}): Promise<void> {
  const [row] = rawRows(db, 'ExpenseReport', 'id', reportId);
  if (!row || row.Status !== 'Submitted' || row.FinancialSecretaryMemberID == null || row.TreasurerMemberID != null) return;
  const councilId = row.CouncilID as number;
  await db.expenses.treasurerLedgerAudit(await ledgerCoder(db), reportId, {
    budgetLineId: coding.budgetLineId ?? testBudgetLine(db, councilId),
    generalLedgerAccountId: coding.generalLedgerAccountId ?? testExpenseAccount(db, councilId),
  });
}
