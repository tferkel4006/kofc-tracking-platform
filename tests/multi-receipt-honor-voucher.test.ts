// Sprint 6S (schema 58): multi-receipt split-ticket expense sheets (ExpenseReceipts, ExpenseLineItem.is_personal_exclusion
// and receipt_id), the Honor Voucher (ExpenseReport.flag_missing_receipt and missing_receipt_reason) and the Azure
// Document Intelligence receipt reader, whose endpoint and key live in the Credentials Vault. Azure is replaced here by
// a recorded fake fetch.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  assertExpenseSplitTicket,
  cleanExpenseLineItems,
  cleanExpenseReceipts,
  cleanExpenseReportInput,
  CREDENTIAL_KEYS,
  documentIntelligenceAnalyzeUrl,
  expenseDraftPersonalTotal,
  expenseDraftTotal,
  expenseLineDraftFrom,
  expenseLinesFromDrafts,
  expenseReceiptsFromDrafts,
  blankExpenseLine,
  HONOR_VOUCHER_BADGE,
  isHonorVoucherSheet,
  parseAzureReceipt,
  planExpenseAssetConversion,
  resolveDocumentIntelligenceEndpoint,
  type DataService,
  type ExpenseLineItemInput,
  type ExpenseReceiptInput,
} from '@kofc/shared';
import { TABLES } from '../apps/web/services/generated/schema.generated';
import { cleanReceiptFile, parseReceiptWithAzure, receiptOcrConnected, ReceiptOcrError } from '../apps/web/services/ocr/receipt-parser';
import { credentialsVault } from '../apps/web/services/server/credentials-vault';
import { drivers, expectRule, MEMBER, NOW, treasurerCode } from './helpers';

const read = (path: string) => readFileSync(join(__dirname, '..', path), 'utf8');
const OWN = 1;

const line = (over: Partial<ExpenseLineItemInput> = {}): ExpenseLineItemInput => ({
  DateOfExpense: '2026-09-12',
  Amount: 40,
  VendorName: 'Costco',
  ReceiptPhotoURL: null,
  ExpenseDescription: 'Pancake mix',
  ...over,
});
const costco: ExpenseReceiptInput = { merchant_name: 'Costco', gross_total: 55.25, receipt_file_url: 'receipts/costco-0912.jpg' };
/** A $55.25 Costco ticket: $40 of pancake mix for the council and $15.25 of the member's own groceries. */
const splitTicket = (): ExpenseLineItemInput[] => [
  line({ receipt_index: 0 }),
  line({ Amount: 15.25, ExpenseDescription: 'My own groceries', is_personal_exclusion: true, receipt_index: 0 }),
];

describe('schema 58', () => {
  it('adds ExpenseReceipts, the split-ticket line columns and the Honor Voucher, and bumps the phone database', () => {
    const schema = read('Schema.sql');
    expect(TABLES.ExpenseReceipts.columns.map((c) => c.name)).toEqual(['id', 'expense_id', 'merchant_name', 'gross_total', 'receipt_file_url']);
    expect(schema).toContain('[gross_total] DECIMAL(18,2) NOT NULL');
    expect(schema).toMatch(/ALTER TABLE \[ExpenseReceipts\]\s+ADD FOREIGN KEY\(\[expense_id\]\)\s+REFERENCES \[ExpenseReport\]\(\[id\]\)/);
    expect(TABLES.ExpenseLineItem.columns.find((c) => c.name === 'is_personal_exclusion')).toMatchObject({ kind: 'bit', notNull: true });
    expect(TABLES.ExpenseLineItem.columns.find((c) => c.name === 'receipt_id')).toMatchObject({ notNull: false });
    expect(TABLES.ExpenseReport.columns.find((c) => c.name === 'flag_missing_receipt')).toMatchObject({ kind: 'bit', notNull: true });
    expect(TABLES.ExpenseReport.columns.find((c) => c.name === 'missing_receipt_reason')).toMatchObject({ kind: 'text', notNull: false });
    expect(read('apps/mobile/services/drivers/sqlite.ts')).toMatch(/const SCHEMA_VERSION = (5[8-9]|[6-9]\d);/);
  });
});

describe('split-ticket and Honor Voucher rules (pure)', () => {
  it('cleans receipts and asks for a file on submission unless the sheet is an Honor Voucher', () => {
    expect(cleanExpenseReceipts(undefined, 'Submitted', 0)).toEqual([]);
    expect(cleanExpenseReceipts([{ ...costco, merchant_name: '  Costco ' }], 'Submitted', 0)).toEqual([costco]);
    expect(() => cleanExpenseReceipts([{ ...costco, gross_total: 0 }], 'Draft', 0)).toThrow(/more than 0/);
    expect(() => cleanExpenseReceipts([{ ...costco, merchant_name: '' }], 'Draft', 0)).toThrow(/merchant/);
    const noFile = { ...costco, receipt_file_url: null };
    expect(cleanExpenseReceipts([noFile], 'Draft', 0)).toEqual([noFile]);
    expect(() => cleanExpenseReceipts([noFile], 'Submitted', 0)).toThrow(/Receipt 1 has no receipt file/);
    expect(cleanExpenseReceipts([noFile], 'Submitted', 1)).toEqual([noFile]);
  });

  it('requires a reason with the Honor Voucher and stores none without it', () => {
    expect(cleanExpenseReportInput({ Status: 'Draft' })).toMatchObject({ flag_missing_receipt: 0, missing_receipt_reason: null });
    expect(cleanExpenseReportInput({ Status: 'Draft', missing_receipt_reason: 'ignored' }).missing_receipt_reason).toBeNull();
    expect(cleanExpenseReportInput({ Status: 'Draft', flag_missing_receipt: true, missing_receipt_reason: ' Cash at the market ' })).toMatchObject({
      flag_missing_receipt: 1,
      missing_receipt_reason: 'Cash at the market',
    });
    expect(() => cleanExpenseReportInput({ Status: 'Draft', flag_missing_receipt: true, missing_receipt_reason: '  ' })).toThrow(/needs the reason/);
    expect(() => cleanExpenseReportInput({ Status: 'Draft', flag_missing_receipt: 'yes' as never })).toThrow(/true or false/);
  });

  it('checks each receipt against its itemised lines, council and personal together', () => {
    const items = cleanExpenseLineItems(splitTicket(), 'Submitted', NOW, 1);
    expect(items.map((i) => [i.is_personal_exclusion, i.receipt_index])).toEqual([
      [0, 0],
      [1, 0],
    ]);
    expect(() => assertExpenseSplitTicket([costco], items, 'Submitted')).not.toThrow();
    expect(() => assertExpenseSplitTicket([{ ...costco, gross_total: 60 }], items, 'Submitted')).toThrow(/totals 60.00, but its line items add up to 55.25/);
    expect(() => assertExpenseSplitTicket([costco, { ...costco, merchant_name: 'Safeway' }], items, 'Submitted')).toThrow(/Receipt 2 \(Safeway\)/);
    expect(() => assertExpenseSplitTicket([{ ...costco, gross_total: 60 }], items, 'Draft')).not.toThrow();
    const allPersonal = cleanExpenseLineItems([line({ is_personal_exclusion: 1 })], 'Submitted', NOW);
    expect(() => assertExpenseSplitTicket([], allPersonal, 'Submitted')).toThrow(/nothing to reimburse/);
    expect(() => cleanExpenseLineItems([line({ receipt_index: 1 })], 'Draft', NOW, 1)).toThrow(/names receipt 1, which is not on this sheet/);
  });

  it('shows the Honor Voucher badge when the sheet is flagged or carries no receipt at all', () => {
    expect(HONOR_VOUCHER_BADGE).toBe('⚠️ HONOR VOUCHER - NO RECEIPT ATTACHED');
    expect(isHonorVoucherSheet({ flag_missing_receipt: 1 }, [costco], [])).toBe(true);
    expect(isHonorVoucherSheet({}, [], [{ ReceiptPhotoURL: null }])).toBe(true);
    expect(isHonorVoucherSheet({}, [{ receipt_file_url: null }], [])).toBe(true);
    expect(isHonorVoucherSheet({}, [costco], [])).toBe(false);
    expect(isHonorVoucherSheet({ flag_missing_receipt: 0 }, [], [{ ReceiptPhotoURL: 'receipts/a.jpg' }])).toBe(false);
  });

  it('keeps personal lines out of the form total and an asset cost basis', () => {
    const rows = [
      { ...blankExpenseLine('2026-09-12'), Amount: '40', VendorName: 'Costco', ExpenseDescription: 'Mix', ReceiptIndex: '0' },
      { ...blankExpenseLine('2026-09-12'), Amount: '15.25', VendorName: 'Costco', ExpenseDescription: 'Mine', IsPersonal: true, ReceiptIndex: '0' },
    ];
    expect(expenseDraftTotal(rows)).toBe(40);
    expect(expenseDraftPersonalTotal(rows)).toBe(15.25);
    expect(expenseLinesFromDrafts(rows).map((l) => [l.is_personal_exclusion, l.receipt_index])).toEqual([
      [undefined, 0],
      [1, 0],
    ]);
    expect(expenseLineDraftFrom({ ...line(), is_personal_exclusion: 1, receipt_id: 9 }, [{ id: 8 }, { id: 9 }])).toMatchObject({ IsPersonal: true, ReceiptIndex: '1' });
    expect(expenseReceiptsFromDrafts([{ merchant_name: 'Costco', gross_total: '$55.25', receipt_file_url: '' }])).toEqual([
      { merchant_name: 'Costco', gross_total: 55.25, receipt_file_url: null },
    ]);
    expect(() => expenseReceiptsFromDrafts([{ merchant_name: 'Costco', gross_total: '', receipt_file_url: '' }])).toThrow(/Receipt 1 needs its gross total/);
    const asset = planExpenseAssetConversion({
      from: 'Submitted',
      to: 'Approved',
      report: { id: 5, CouncilID: OWN, is_long_term_asset: 1 },
      lineItems: [
        { ...line({ Amount: 300, ExpenseDescription: 'Grill' }) },
        { ...line({ Amount: 20, ExpenseDescription: 'Snacks' }), is_personal_exclusion: 1 },
      ],
      alreadyConverted: false,
    });
    expect(asset).toMatchObject({ cost_basis: 300, asset_name: 'Grill' });
  });
});

async function signThrough(db: DataService, reportId: number): Promise<void> {
  await db.expenses.financialSecretaryAuditOrder(MEMBER.admin, reportId);
  await treasurerCode(db, reportId);
  await db.expenses.grandKnightAuthorizeOrder(MEMBER.superAdmin, reportId);
}

describe.each(drivers)('multi-receipt sheets ($name driver)', (d) => {
  it('stores receipts, links their lines and pays only the council lines', async () => {
    const db = await d.make();
    const saved = await db.expenses.submitReport(
      MEMBER.member,
      { Status: 'Submitted', receipts: [costco, { merchant_name: 'Safeway', gross_total: 12, receipt_file_url: 'receipts/safeway.jpg' }] },
      [...splitTicket(), line({ VendorName: 'Safeway', Amount: 12, ExpenseDescription: 'Orange juice', receipt_index: 1 })],
    );
    expect(saved.receipts.map((r) => [r.merchant_name, r.gross_total])).toEqual([
      ['Costco', 55.25],
      ['Safeway', 12],
    ]);
    expect(saved.total).toBe(52);
    expect(saved.personalTotal).toBe(15.25);
    expect(saved.honorVoucher).toBe(false);
    const byReceipt = saved.lineItems.map((li) => saved.receipts.findIndex((r) => r.id === li.receipt_id));
    expect(byReceipt.sort()).toEqual([0, 0, 1]);
    expect(saved.lineItems.filter((li) => li.is_personal_exclusion).map((li) => li.Amount)).toEqual([15.25]);

    await signThrough(db, saved.report.id);
    const { disbursement } = await db.expenses.recordDisbursement(MEMBER.admin, OWN, [saved.report.id], {
      CheckNumber: 'S6-1',
      PayoutDate: '2026-09-20',
    });
    expect(disbursement.TotalAmount).toBe(52);
  });

  it('replaces a draft’s receipts on resave and refuses a ticket that does not add up, writing nothing', async () => {
    const db = await d.make();
    const draft = await db.expenses.submitReport(MEMBER.member, { Status: 'Draft', receipts: [costco] }, splitTicket());
    const before = d.count(db, 'ExpenseReceipts');
    await expectRule(
      db.expenses.submitReport(MEMBER.member, { id: draft.report.id, Status: 'Submitted', receipts: [{ ...costco, gross_total: 99 }] }, splitTicket()),
      'INVALID_INPUT',
    );
    expect(d.count(db, 'ExpenseReceipts')).toBe(before);
    const resaved = await db.expenses.submitReport(MEMBER.member, { id: draft.report.id, Status: 'Draft', receipts: [] }, [line()]);
    expect(resaved.receipts).toEqual([]);
    expect(resaved.lineItems.map((li) => li.receipt_id ?? null)).toEqual([null]);
    expect(d.count(db, 'ExpenseReceipts')).toBe(before - 1);
  });

  it('takes an Honor Voucher without a receipt file and shows its badge', async () => {
    const db = await d.make();
    await expectRule(
      db.expenses.submitReport(MEMBER.member, { Status: 'Submitted', receipts: [{ ...costco, gross_total: 40, receipt_file_url: null }] }, [line({ receipt_index: 0 })]),
      'INVALID_INPUT',
    );
    const voucher = await db.expenses.submitReport(
      MEMBER.member,
      { Status: 'Submitted', flag_missing_receipt: true, missing_receipt_reason: 'Cash purchase; no receipt given.' },
      [line({ VendorName: 'Farmers market' })],
    );
    expect(voucher.report).toMatchObject({ flag_missing_receipt: 1, missing_receipt_reason: 'Cash purchase; no receipt given.' });
    expect(voucher.honorVoucher).toBe(true);
    const [queued] = (await db.expenses.listCouncilQueue(MEMBER.admin, OWN)).filter((q) => q.report.id === voucher.report.id);
    expect(queued.honorVoucher).toBe(true);
  });
});

// ---- the offline print edition of the Administrator User Guide ------------------------------------------------------

describe('Administrator User Guide print edition', () => {
  const guide = read('docs/ADMIN_USER_GUIDE.md');

  it('ships the ReportLab compiler with its wording check and closing disclaimer', () => {
    const script = read('scripts/admin_guide_pdf.py');
    expect(script).toContain('from reportlab');
    expect(script).toContain("DEFAULT_INPUT = ROOT / 'docs' / 'ADMIN_USER_GUIDE.md'");
    expect(script).toContain("DEFAULT_OUTPUT = ROOT / 'docs' / 'ADMIN_USER_GUIDE.pdf'");
    expect(script).toContain("REQUIRED_SCREEN_NAMES = ('Council Artifacts', 'Donations History', 'Credentials Vault')");
    expect(script).toMatch(/DISCLAIMER = \(\s+'Informational notice\./);
    expect(script).toContain('disclaimer_footnote(st)');
    expect(read('scripts/requirements.txt')).toContain('reportlab');
  });

  it('uses the renamed screens and none of the retired names or jargon the compiler refuses', () => {
    for (const name of ['Council Artifacts', 'Donations History', 'Credentials Vault']) expect(guide).toContain(name);
    const prose = guide
      .split('\n')
      .filter((l) => !l.trim().startsWith('<!--'))
      .join('\n');
    for (const banned of [/\bBulletins?\b/i, /\bGYST\b/i, /\bDonations Ledger\b/i, /\bstakeholders?\b/i, /\bsynerg/i, /\bleverag/i, /\bfintech\b/i, /\bSaaS\b/i, /\bKPIs?\b/i]) {
      expect(prose, String(banned)).not.toMatch(banned);
    }
  });

  it('documents split tickets, the Honor Voucher and receipt reading', () => {
    expect(guide).toContain('### 6.14 Concept: receipts, split tickets and Honor Vouchers');
    expect(guide).toContain(HONOR_VOUCHER_BADGE);
    expect(guide).toContain('### 10.8 Connect the council email, Google Drive, Microsoft Co-Pilot and receipt reading');
  });
});

// ---- the Azure Document Intelligence receipt reader -------------------------------------------------------------------

const ENDPOINT = 'https://kofc-receipts.cognitiveservices.azure.com';
const KEY = 'azure-key-123';
const ANALYZE_RESULT = {
  documents: [
    {
      confidence: 0.97,
      fields: {
        MerchantName: { type: 'string', valueString: 'Costco Wholesale' },
        TransactionDate: { type: 'date', valueDate: '2026-09-12' },
        Total: { type: 'currency', valueCurrency: { amount: 55.25 } },
        Items: {
          type: 'array',
          valueArray: [
            { type: 'object', valueObject: { Description: { valueString: 'Pancake mix' }, TotalPrice: { valueCurrency: { amount: 40 } } } },
            { type: 'object', valueObject: { Description: { valueString: 'Coffee' }, TotalPrice: { valueNumber: 15.25 } } },
          ],
        },
      },
    },
  ],
};

interface Call {
  url: string;
  method: string;
  key: string | null;
  body: unknown;
}

function fakeAzure(opts: { operation?: string; succeedOnPoll?: number; status?: number } = {}) {
  const calls: Call[] = [];
  let polls = 0;
  const impl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, method: init?.method ?? 'GET', key: new Headers(init?.headers).get('Ocp-Apim-Subscription-Key'), body: init?.body ? JSON.parse(String(init.body)) : undefined });
    if (opts.status) return new Response('{}', { status: opts.status });
    if (init?.method === 'POST') {
      return new Response(null, { status: 202, headers: { 'Operation-Location': opts.operation ?? `${ENDPOINT}/documentintelligence/documentModels/prebuilt-receipt/analyzeResults/op1` } });
    }
    polls += 1;
    const done = polls >= (opts.succeedOnPoll ?? 2);
    return new Response(JSON.stringify(done ? { status: 'succeeded', analyzeResult: ANALYZE_RESULT } : { status: 'running' }), { status: 200 });
  }) as typeof fetch;
  return { impl, calls };
}

const fast = { sleep: async () => {}, pollMs: 0, timeoutMs: 1000 };
const FILE = { base64: Buffer.from('fake-jpeg').toString('base64'), contentType: 'image/jpeg' };

describe('Azure Document Intelligence receipt reader', () => {
  it('keeps its endpoint and key in the Credentials Vault and accepts only Azure hosts', () => {
    expect(CREDENTIAL_KEYS).toEqual(expect.arrayContaining(['AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT', 'AZURE_DOCUMENT_INTELLIGENCE_KEY']));
    expect(resolveDocumentIntelligenceEndpoint(`${ENDPOINT}/`)).toBe(ENDPOINT);
    expect(resolveDocumentIntelligenceEndpoint('https://eastus.api.cognitive.microsoft.com')).toBe('https://eastus.api.cognitive.microsoft.com');
    for (const bad of ['http://kofc.cognitiveservices.azure.com', 'https://evil.example.com', 'https://kofc.cognitiveservices.azure.com.evil.io', 'not a url', '']) {
      expect(() => resolveDocumentIntelligenceEndpoint(bad), bad).toThrow(/Document Intelligence endpoint/);
    }
    expect(documentIntelligenceAnalyzeUrl(ENDPOINT)).toBe(`${ENDPOINT}/documentintelligence/documentModels/prebuilt-receipt:analyze?api-version=2024-11-30`);
    const page = read('apps/web/app/credentials-vault/page.tsx');
    expect(page).toContain("credentialKey: 'AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT'");
    expect(page).toContain("credentialKey: 'AZURE_DOCUMENT_INTELLIGENCE_KEY'");
  });

  it('maps the prebuilt-receipt fields and reads an odd answer as empty', () => {
    expect(parseAzureReceipt(ANALYZE_RESULT)).toEqual({
      merchantName: 'Costco Wholesale',
      transactionDate: '2026-09-12',
      total: 55.25,
      items: [
        { description: 'Pancake mix', amount: 40 },
        { description: 'Coffee', amount: 15.25 },
      ],
      confidence: 0.97,
    });
    expect(parseAzureReceipt(null)).toEqual({ merchantName: null, transactionDate: null, total: null, items: [], confidence: null });
  });

  it('checks the file before anything is sent', () => {
    expect(cleanReceiptFile({ base64: `data:image/jpeg;base64,${FILE.base64}`, contentType: 'IMAGE/JPEG' })).toEqual(FILE);
    expect(() => cleanReceiptFile({ base64: FILE.base64, contentType: 'text/html' })).toThrow(ReceiptOcrError);
    expect(() => cleanReceiptFile({ base64: '<script>', contentType: 'image/png' })).toThrow(/did not arrive/);
    expect(() => cleanReceiptFile({ base64: 'A'.repeat(6 * 1024 * 1024), contentType: 'image/png' })).toThrow(/larger than 4 MB/);
  });

  it('refuses with 503 until the council saves both credentials', async () => {
    credentialsVault().put(951, 'AZURE_DOCUMENT_INTELLIGENCE_KEY', KEY);
    expect(receiptOcrConnected(951)).toBe(false);
    const { impl, calls } = fakeAzure();
    await expect(parseReceiptWithAzure(951, FILE, { ...fast, fetchImpl: impl })).rejects.toMatchObject({ status: 503 });
    expect(calls).toEqual([]);
  });

  it('posts the receipt with the vault key, polls the operation and returns the fields', async () => {
    credentialsVault().put(952, 'AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT', ENDPOINT);
    credentialsVault().put(952, 'AZURE_DOCUMENT_INTELLIGENCE_KEY', KEY);
    expect(receiptOcrConnected(952)).toBe(true);
    const { impl, calls } = fakeAzure({ succeedOnPoll: 2 });
    const result = await parseReceiptWithAzure(952, FILE, { ...fast, fetchImpl: impl });
    expect(result).toMatchObject({ merchantName: 'Costco Wholesale', total: 55.25 });
    expect(calls.map((c) => c.method)).toEqual(['POST', 'GET', 'GET']);
    expect(calls[0]).toMatchObject({ url: documentIntelligenceAnalyzeUrl(ENDPOINT), key: KEY, body: { base64Source: FILE.base64 } });
    expect(calls.every((c) => c.key === KEY)).toBe(true);
  });

  it('never follows an operation address on another host, and maps refusals and time-outs', async () => {
    credentialsVault().put(953, 'AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT', ENDPOINT);
    credentialsVault().put(953, 'AZURE_DOCUMENT_INTELLIGENCE_KEY', KEY);
    const elsewhere = fakeAzure({ operation: 'https://evil.example.com/steal' });
    await expect(parseReceiptWithAzure(953, FILE, { ...fast, fetchImpl: elsewhere.impl })).rejects.toMatchObject({ status: 502 });
    expect(elsewhere.calls).toHaveLength(1);
    await expect(parseReceiptWithAzure(953, FILE, { ...fast, fetchImpl: fakeAzure({ status: 401 }).impl })).rejects.toThrow(/refused the saved Document Intelligence key/);
    await expect(parseReceiptWithAzure(953, FILE, { ...fast, timeoutMs: 0, fetchImpl: fakeAzure({ succeedOnPoll: 99 }).impl })).rejects.toMatchObject({ status: 504 });
  });
});
