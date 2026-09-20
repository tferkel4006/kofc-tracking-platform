// Test stand-in for expo-crypto, backed by node:crypto.
import { createHash, randomBytes } from 'node:crypto';

export enum CryptoDigestAlgorithm {
  SHA256 = 'SHA-256',
}
export enum CryptoEncoding {
  HEX = 'hex',
  BASE64 = 'base64',
}

export async function digestStringAsync(
  algorithm: CryptoDigestAlgorithm,
  data: string,
  options: { encoding?: CryptoEncoding } = {},
): Promise<string> {
  if (algorithm !== CryptoDigestAlgorithm.SHA256) throw new Error(`shim supports SHA-256 only, got ${algorithm}`);
  return createHash('sha256')
    .update(data, 'utf8')
    .digest(options.encoding === CryptoEncoding.BASE64 ? 'base64' : 'hex');
}

export async function getRandomBytesAsync(byteCount: number): Promise<Uint8Array> {
  return new Uint8Array(randomBytes(byteCount));
}
