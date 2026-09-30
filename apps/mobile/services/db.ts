// =========================================================================
// THE ONLY DATA-ACCESS ENTRY POINT FOR THE MOBILE APP.
// Screens and components import `db` from here and nothing else that touches
// data. Which driver backs it is decided in one place, below.
//
//   EXPO_PUBLIC_DATA_DRIVER=sqlite  (default)  local expo-sqlite database
//   EXPO_PUBLIC_DATA_DRIVER=remote             production Azure SQL, via drivers/remote.ts
// =========================================================================
import type { DataService } from '@kofc/shared';
import { createRemoteDataService } from './drivers/remote';
import { SqliteDataService } from './drivers/sqlite';

function createDataService(): DataService {
  const driver = process.env.EXPO_PUBLIC_DATA_DRIVER ?? 'sqlite';
  switch (driver) {
    case 'sqlite':
      // A new database is loaded with Seed.sql's presentation data (Sprint 5Z-1) so no screen or chart starts blank.
      return new SqliteDataService({ presentationData: true });
    case 'remote':
      return createRemoteDataService();
    default:
      throw new Error(`Unknown EXPO_PUBLIC_DATA_DRIVER "${driver}" (expected "sqlite" or "remote")`);
  }
}

export const db: DataService = createDataService();

export type { DataService } from '@kofc/shared';
