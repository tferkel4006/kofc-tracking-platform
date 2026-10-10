// How the expense form asks the portal's server to read a receipt (Sprint 6S): it posts the attached file to
// app/api/expenses/receipt-ocr, which sends it to the council's Azure AI Document Intelligence resource.
import type { ReceiptOcrResult } from '@kofc/shared';

export const RECEIPT_OCR_ROUTE = '/api/expenses/receipt-ocr';

/** Whether the council has connected receipt reading; false when the server cannot say. */
export async function receiptOcrAvailable(): Promise<boolean> {
  const res = await fetch(RECEIPT_OCR_ROUTE, { credentials: 'same-origin' }).catch(() => null);
  const body = (await res?.json().catch(() => null)) as { connected?: boolean } | null;
  return body?.connected === true;
}

const toBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).replace(/^data:[^,]*,/, ''));
    reader.onerror = () => reject(new Error('The receipt file could not be read.'));
    reader.readAsDataURL(file);
  });

/** What Azure read on the receipt, or an Error carrying the server's explanation. */
export async function readReceipt(file: File): Promise<ReceiptOcrResult> {
  const res = await fetch(RECEIPT_OCR_ROUTE, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ base64: await toBase64(file), contentType: file.type }),
  }).catch(() => null);
  if (!res) throw new Error('The portal server did not answer. Check the connection and try again.');
  const body = (await res.json().catch(() => null)) as (ReceiptOcrResult & { message?: string }) | null;
  if (!res.ok || !body) throw new Error(body?.message ?? `The receipt could not be read (HTTP ${res.status}).`);
  return body;
}
