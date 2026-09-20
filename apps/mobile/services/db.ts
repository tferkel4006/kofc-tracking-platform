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
      return new SqliteDataService();
    case 'remote':
      return createRemoteDataService();
    default:
      throw new Error(`Unknown EXPO_PUBLIC_DATA_DRIVER "${driver}" (expected "sqlite" or "remote")`);
  }
}

export const db: DataService = createDataService();

export type { DataService } from '@kofc/shared';
