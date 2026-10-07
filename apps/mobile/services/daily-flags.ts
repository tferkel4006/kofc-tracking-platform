// Phase 4.5: tiny per-device "last done on" dates for the Faith Center (the day the Daily Bible Quote last opened by
// itself, the day the feast banner was closed). Kept in expo-secure-store, which the app already ships; on the web
// build, or when the store cannot be read, the dates live in memory for this run of the app only.
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

export type DailyFlag = 'faith.verseShown' | 'faith.bannerClosed';

const memory = new Map<DailyFlag, string>();
const storeKey = (flag: DailyFlag) => `kofc.${flag}`;

/** The YYYY-MM-DD the flag was last set, or null. */
export async function readDailyFlag(flag: DailyFlag): Promise<string | null> {
  if (Platform.OS !== 'web') {
    try {
      const stored = await SecureStore.getItemAsync(storeKey(flag));
      if (stored) return stored;
    } catch {
      // an unreadable store falls back to this run's memory
    }
  }
  return memory.get(flag) ?? null;
}

/** Records `date` (YYYY-MM-DD) for the flag. */
export async function writeDailyFlag(flag: DailyFlag, date: string): Promise<void> {
  memory.set(flag, date);
  if (Platform.OS === 'web') return;
  try {
    await SecureStore.setItemAsync(storeKey(flag), date);
  } catch {
    // memory already holds it for this run
  }
}
