// Password hashing for the web app: standard SHA-256 through the Web Crypto API
// (crypto.subtle), which browsers and Node both provide natively. node:crypto is
// not available in the browser, and the memory driver runs client-side.
// Stored form: 64 lowercase hex characters, the same as the mobile driver.

export async function sha256Hex(text: string): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}
