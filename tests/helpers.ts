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
