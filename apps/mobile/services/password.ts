// Password hashing for the mobile app: standard SHA-256 through expo-crypto,
// which uses the platform's native digest. Nothing outside /services may import this.
// Stored form: 64 lowercase hex characters, the same as the web driver.
import * as Crypto from 'expo-crypto';

export const sha256Hex = (text: string): Promise<string> =>
  Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, text, { encoding: Crypto.CryptoEncoding.HEX });
