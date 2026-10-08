// How the Semiannual Trustee Audit Desk asks the portal's server for the Form 1295 report PDF (Sprint 6N): it posts the desk
// it read through the data service to app/api/finance/form-1295, which compiles the PDF with ReportLab on the server.
import type { Form1295Payload } from '@kofc/shared';

export const FORM_1295_ROUTE = '/api/finance/form-1295';

/** The compiled PDF, or an Error carrying the server's explanation. */
export async function compileForm1295(payload: Form1295Payload): Promise<Blob> {
  const res = await fetch(FORM_1295_ROUTE, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }).catch(() => null);
  if (!res) throw new Error('The portal server did not answer. Check the connection and try again.');
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { message?: string } | null;
    throw new Error(body?.message ?? `The report could not be compiled (HTTP ${res.status}).`);
  }
  return res.blob();
}
