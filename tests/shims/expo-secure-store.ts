// Test stand-in for expo-secure-store: an in-memory map.
export const WHEN_UNLOCKED_THIS_DEVICE_ONLY = 6;
const items = new Map<string, string>();

export async function getItemAsync(key: string): Promise<string | null> {
  return items.get(key) ?? null;
}
export async function setItemAsync(key: string, value: string, _options?: unknown): Promise<void> {
  items.set(key, value);
}
export async function deleteItemAsync(key: string): Promise<void> {
  items.delete(key);
}
export const _reset = () => items.clear();
