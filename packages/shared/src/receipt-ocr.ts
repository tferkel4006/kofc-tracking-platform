// Sprint 6S: receipt reading through Microsoft Azure AI Document Intelligence (the prebuilt-receipt model).
//
// The browser-safe half of the OCR hook. The server proxy (apps/web/services/ocr/receipt-parser.ts) reads the council's
// endpoint and key from the Credentials Vault, sends the receipt to Azure and hands the analyzeResult to
// parseAzureReceipt, which keeps only the fields the expense form pre-fills: merchant, date, total and the item lines.
// Nothing here is trusted as a figure of record: the member checks the pre-filled receipt before saving, and the
// driver validates it like a typed one (cleanExpenseReceipts, assertExpenseSplitTicket).
import { BusinessRuleError } from './rules';

/** The Document Intelligence REST version and model the proxy calls. */
export const DOCUMENT_INTELLIGENCE_API_VERSION = '2024-11-30';
export const DOCUMENT_INTELLIGENCE_RECEIPT_MODEL = 'prebuilt-receipt';

/** Azure's own hosts for an AI services / Document Intelligence resource; anything else is refused (no open proxy). */
const DOCUMENT_INTELLIGENCE_HOST = /^[a-z0-9][a-z0-9-]{0,62}\.(cognitiveservices\.azure\.com|api\.cognitive\.microsoft\.com)$/i;

/** The largest receipt file the proxy forwards, in bytes; a receipt photo or PDF is well under it. */
export const RECEIPT_OCR_MAX_BYTES = 4 * 1024 * 1024;

/** The file types the prebuilt-receipt model reads that a member is likely to attach. */
export const RECEIPT_OCR_CONTENT_TYPES = ['image/jpeg', 'image/png', 'image/tiff', 'image/bmp', 'image/heif', 'application/pdf'] as const;

/**
 * The resource endpoint saved in the vault as `https://<name>.cognitiveservices.azure.com/`, reduced to its origin.
 * Rejects INVALID_INPUT for anything that is not https on an Azure Cognitive Services host.
 */
export function resolveDocumentIntelligenceEndpoint(raw: string | null | undefined): string {
  let url: URL;
  try {
    url = new URL(String(raw ?? '').trim());
  } catch {
    throw new BusinessRuleError('INVALID_INPUT', 'The Document Intelligence endpoint is not a valid URL.', { field: 'AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT' });
  }
  if (url.protocol !== 'https:' || !DOCUMENT_INTELLIGENCE_HOST.test(url.hostname) || url.username || url.password || url.port) {
    throw new BusinessRuleError('INVALID_INPUT', 'The Document Intelligence endpoint must be an https://<resource>.cognitiveservices.azure.com address.', {
      field: 'AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT',
    });
  }
  return url.origin;
}

/** The analyze URL for one receipt. */
export const documentIntelligenceAnalyzeUrl = (endpoint: string): string =>
  `${endpoint}/documentintelligence/documentModels/${DOCUMENT_INTELLIGENCE_RECEIPT_MODEL}:analyze?api-version=${DOCUMENT_INTELLIGENCE_API_VERSION}`;

/** One item line the model read. */
export interface ReceiptOcrItem {
  description: string;
  amount: number | null;
}

/** What the expense form pre-fills from a read receipt. Every field may be missing; confidence is the model's 0-1 score. */
export interface ReceiptOcrResult {
  merchantName: string | null;
  transactionDate: string | null; // YYYY-MM-DD
  total: number | null;
  items: ReceiptOcrItem[];
  confidence: number | null;
}

/** The parts of a Document Intelligence field the parser reads. */
interface AzureField {
  type?: string;
  valueString?: string;
  valueDate?: string;
  valueNumber?: number;
  valueCurrency?: { amount?: number };
  valueObject?: Record<string, AzureField | undefined>;
  valueArray?: AzureField[];
  content?: string;
  confidence?: number;
}

const toCents = (n: unknown): number | null => (typeof n === 'number' && Number.isFinite(n) ? Math.round(n * 100) / 100 : null);

const fieldText = (f: AzureField | undefined): string | null => {
  const text = (f?.valueString ?? f?.content ?? '').replace(/\s+/g, ' ').trim();
  return text ? text : null;
};

const fieldMoney = (f: AzureField | undefined): number | null => toCents(f?.valueCurrency?.amount ?? f?.valueNumber);

const fieldDate = (f: AzureField | undefined): string | null => (f?.valueDate && /^\d{4}-\d{2}-\d{2}$/.test(f.valueDate) ? f.valueDate : null);

/**
 * The fields of the first receipt in an analyzeResult (`{ documents: [{ fields, confidence }] }`). An unexpected shape
 * reads as an empty result rather than an error, so the member simply types the receipt.
 */
export function parseAzureReceipt(analyzeResult: unknown): ReceiptOcrResult {
  const doc = (analyzeResult as { documents?: { fields?: Record<string, AzureField | undefined>; confidence?: number }[] } | null)?.documents?.[0];
  const fields = doc?.fields ?? {};
  const items = (fields.Items?.valueArray ?? []).flatMap((entry) => {
    const o = entry.valueObject ?? {};
    const description = fieldText(o.Description) ?? fieldText(entry);
    const amount = fieldMoney(o.TotalPrice) ?? fieldMoney(o.Price);
    return description || amount !== null ? [{ description: description ?? 'Item', amount }] : [];
  });
  return {
    merchantName: fieldText(fields.MerchantName),
    transactionDate: fieldDate(fields.TransactionDate),
    total: fieldMoney(fields.Total),
    items,
    confidence: typeof doc?.confidence === 'number' ? doc.confidence : null,
  };
}
