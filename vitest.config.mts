import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const at = (path: string) => fileURLToPath(new URL(path, import.meta.url));

// The native Expo modules cannot run in Node, so tests swap in small stand-ins with the
// same API. expo-sqlite is backed by Node's built-in SQLite, which lets the real
// SqliteDataService (schema, seed, SQL and guards) run unmodified.
export default defineConfig({
  resolve: {
    alias: {
      '@kofc/shared': at('./packages/shared/src/index.ts'),
      'expo-sqlite': at('./tests/shims/expo-sqlite.ts'),
      'expo-crypto': at('./tests/shims/expo-crypto.ts'),
      'expo-secure-store': at('./tests/shims/expo-secure-store.ts'),
    },
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
