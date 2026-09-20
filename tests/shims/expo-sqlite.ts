// Test stand-in for expo-sqlite, backed by node:sqlite. Each openDatabaseAsync() call
// returns a fresh in-memory database, so every service instance starts empty.
import { DatabaseSync } from 'node:sqlite';

type Param = string | number | null;

/** Every database opened so far, so tests can inspect raw rows. */
export const openDatabases: DatabaseSync[] = [];

const plain = <T>(row: unknown): T => ({ ...(row as object) }) as T;

export class SQLiteDatabase {
  constructor(readonly raw: DatabaseSync) {}

  async execAsync(sql: string): Promise<void> {
    this.raw.exec(sql);
  }
  async getFirstAsync<T>(sql: string, params: Param[] = []): Promise<T | null> {
    const row = this.raw.prepare(sql).get(...params);
    return row === undefined ? null : plain<T>(row);
  }
  async getAllAsync<T>(sql: string, params: Param[] = []): Promise<T[]> {
    return this.raw.prepare(sql).all(...params).map((r) => plain<T>(r));
  }
  async runAsync(sql: string, params: Param[] = []): Promise<{ changes: number; lastInsertRowId: number }> {
    const res = this.raw.prepare(sql).run(...params);
    return { changes: Number(res.changes), lastInsertRowId: Number(res.lastInsertRowid) };
  }
  async withTransactionAsync(task: () => Promise<void>): Promise<void> {
    this.raw.exec('BEGIN');
    try {
      await task();
      this.raw.exec('COMMIT');
    } catch (err) {
      this.raw.exec('ROLLBACK');
      throw err;
    }
  }
  async closeAsync(): Promise<void> {
    this.raw.close();
  }
}

export async function openDatabaseAsync(_name: string): Promise<SQLiteDatabase> {
  const raw = new DatabaseSync(':memory:');
  openDatabases.push(raw);
  return new SQLiteDatabase(raw);
}

export async function deleteDatabaseAsync(_name: string): Promise<void> {}
