// =========================================================================
// THE ONLY DATA-ACCESS ENTRY POINT FOR THE WEB APP.
// Pages and components import `db` from here and nothing else that touches
// data. Which driver backs it is decided in one place, below.
//
//   NEXT_PUBLIC_DATA_DRIVER=memory  (default)  in-memory mock, seeded from Seed.sql
//   NEXT_PUBLIC_DATA_DRIVER=remote             production Azure SQL, via drivers/remote.ts
//
// The memory driver is client-side state: import `db` only from client
// components ("use client"); each browser tab gets its own copy.
// =========================================================================
import type { DataService } from '@kofc/shared';
import { MemoryDataService } from './drivers/memory';
import { createRemoteDataService } from './drivers/remote';

function createDataService(): DataService {
  const driver = process.env.NEXT_PUBLIC_DATA_DRIVER ?? 'memory';
  switch (driver) {
    case 'memory':
      return new MemoryDataService();
    case 'remote':
      return createRemoteDataService();
    default:
      throw new Error(`Unknown NEXT_PUBLIC_DATA_DRIVER "${driver}" (expected "memory" or "remote")`);
  }
}

export const db: DataService = createDataService();

export type { DataService } from '@kofc/shared';
