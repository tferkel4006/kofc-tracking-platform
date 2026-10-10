// /api/expenses/receipt-ocr - reads a receipt for the expense form (Sprint 6S).
//
//   GET                                       { connected } - whether the council has saved its Azure endpoint and key
//   POST { base64, contentType }              ReceiptOcrResult - the merchant, date, total and item lines Azure read
//
// The file goes to the council's Azure AI Document Intelligence resource through services/ocr/receipt-parser, which
// reads the endpoint and key from the Credentials Vault. Every member files expense reports, so any portal session may
// call it (401 without one); the session's own council is the one whose resource is used. Nothing is stored: the
// member checks the pre-filled receipt and saves it through expenses.submitReport as usual.
import { NextResponse } from 'next/server';
import { describeError } from '@kofc/shared';
import { cleanReceiptFile, parseReceiptWithAzure, receiptOcrConnected, ReceiptOcrError } from '@/services/ocr/receipt-parser';
import { requirePortalSession } from '@/services/server/session';

const anyMember = () => true;

export async function GET(req: Request) {
  const session = await requirePortalSession(req, anyMember, { connected: false });
  if ('denied' in session) return session.denied;
  return NextResponse.json({ connected: receiptOcrConnected(session.claims.councilId) });
}

export async function POST(req: Request) {
  const session = await requirePortalSession(req, anyMember);
  if ('denied' in session) return session.denied;
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  try {
    const file = cleanReceiptFile({ base64: body?.base64, contentType: body?.contentType });
    return NextResponse.json(await parseReceiptWithAzure(session.claims.councilId, file));
  } catch (err) {
    if (err instanceof ReceiptOcrError) return NextResponse.json({ message: err.message }, { status: err.status });
    console.error('[receipt-ocr] request failed:', describeError(err));
    return NextResponse.json({ message: 'Receipt reading failed. Type the receipt in instead.' }, { status: 502 });
  }
}
