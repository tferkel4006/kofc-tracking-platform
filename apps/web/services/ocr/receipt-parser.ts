// The receipt reader (Sprint 6S). SERVER ONLY, like services/server/credentials-vault.ts.
//
// An asynchronous proxy to Microsoft Azure AI Document Intelligence's prebuilt-receipt model:
//   1. POST {endpoint}/documentintelligence/documentModels/prebuilt-receipt:analyze?api-version=… with the receipt as
//      base64Source and the council's key in Ocp-Apim-Subscription-Key. Azure answers 202 and an Operation-Location.
//   2. GET that Operation-Location (same key) until its status is 'succeeded' or 'failed', or the time runs out.
//   3. parseAzureReceipt (@kofc/shared) keeps the merchant, date, total and item lines the expense form pre-fills.
// The endpoint and key are read from the Credentials Vault (AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT and _KEY) at the moment
// of use and never logged or returned. The endpoint must be an Azure Cognitive Services host, and the Operation-Location
// must be on that same host, so the proxy cannot be pointed anywhere else.
import {
  documentIntelligenceAnalyzeUrl,
  parseAzureReceipt,
  RECEIPT_OCR_CONTENT_TYPES,
  RECEIPT_OCR_MAX_BYTES,
  resolveDocumentIntelligenceEndpoint,
  type ReceiptOcrResult,
} from '@kofc/shared';
import { credentialsVault } from '../server/credentials-vault';

if (typeof window !== 'undefined') {
  throw new Error('services/ocr/receipt-parser.ts was loaded in a browser. Server secrets must never reach the client bundle.');
}

export const OCR_ENDPOINT_KEY = 'AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT' as const;
export const OCR_SECRET_KEY = 'AZURE_DOCUMENT_INTELLIGENCE_KEY' as const;

/** Why a receipt was not read; `status` is the HTTP status the route answers with. */
export class ReceiptOcrError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'ReceiptOcrError';
  }
}

export interface ReceiptOcrOptions {
  fetchImpl?: typeof fetch;
  /** How long to wait for Azure to finish reading. */
  timeoutMs?: number;
  /** The pause between polls when Azure sends no Retry-After. */
  pollMs?: number;
  sleep?: (ms: number) => Promise<void>;
}

/** One receipt file as the route receives it. */
export interface ReceiptFile {
  base64: string;
  contentType: string;
}

/** Whether the council has saved both Document Intelligence credentials. */
export const receiptOcrConnected = (councilId: number): boolean =>
  credentialsVault().has(councilId, OCR_ENDPOINT_KEY) && credentialsVault().has(councilId, OCR_SECRET_KEY);

/** The receipt checked before anything is sent: a known type, real base64 and no bigger than RECEIPT_OCR_MAX_BYTES. */
export function cleanReceiptFile(input: { base64?: unknown; contentType?: unknown }): ReceiptFile {
  const contentType = typeof input.contentType === 'string' ? input.contentType.toLowerCase().trim() : '';
  if (!(RECEIPT_OCR_CONTENT_TYPES as readonly string[]).includes(contentType)) {
    throw new ReceiptOcrError('Only a photo (JPEG, PNG, TIFF, BMP, HEIF) or a PDF of the receipt can be read.', 400);
  }
  const base64 = typeof input.base64 === 'string' ? input.base64.replace(/^data:[^,]*,/, '').replace(/\s+/g, '') : '';
  if (!base64 || !/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) throw new ReceiptOcrError('The receipt file did not arrive.', 400);
  if (Math.floor((base64.length * 3) / 4) > RECEIPT_OCR_MAX_BYTES) {
    throw new ReceiptOcrError(`The receipt file is larger than ${RECEIPT_OCR_MAX_BYTES / (1024 * 1024)} MB.`, 413);
  }
  return { base64, contentType };
}

/**
 * Reads one receipt with the council's Document Intelligence resource. Throws ReceiptOcrError: 503 when the council has
 * no usable endpoint or key, 502 when Azure refuses or fails, 504 when it does not finish in time.
 */
export async function parseReceiptWithAzure(councilId: number, file: ReceiptFile, options: ReceiptOcrOptions = {}): Promise<ReceiptOcrResult> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? 30_000;
  const pollMs = options.pollMs ?? 1_000;
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));

  const vault = credentialsVault();
  const key = vault.reveal(councilId, OCR_SECRET_KEY);
  const rawEndpoint = vault.reveal(councilId, OCR_ENDPOINT_KEY);
  if (!key || !rawEndpoint) {
    throw new ReceiptOcrError('Receipt reading is not connected for this council. An Admin saves the Azure endpoint and key on the Credentials Vault page.', 503);
  }
  let endpoint: string;
  try {
    endpoint = resolveDocumentIntelligenceEndpoint(rawEndpoint);
  } catch {
    throw new ReceiptOcrError('The saved Azure endpoint is not a Document Intelligence address. An Admin replaces it on the Credentials Vault page.', 503);
  }

  const call = async (url: string, init: { method: 'GET' | 'POST'; body?: unknown }): Promise<Response> => {
    let res: Response;
    try {
      res = await fetchImpl(url, {
        method: init.method,
        headers: { 'Ocp-Apim-Subscription-Key': key, ...(init.body !== undefined ? { 'Content-Type': 'application/json' } : {}) },
        body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
        cache: 'no-store',
      });
    } catch {
      throw new ReceiptOcrError('Azure Document Intelligence could not be reached. Try again later.', 502);
    }
    if (res.status === 401 || res.status === 403) {
      throw new ReceiptOcrError('Azure refused the saved Document Intelligence key. An Admin replaces it on the Credentials Vault page.', 502);
    }
    return res;
  };

  const started = await call(documentIntelligenceAnalyzeUrl(endpoint), { method: 'POST', body: { base64Source: file.base64 } });
  const operation = started.headers.get('operation-location');
  if (started.status !== 202 || !operation) throw new ReceiptOcrError(`Azure did not accept the receipt (HTTP ${started.status}).`, 502);
  let operationUrl: URL;
  try {
    operationUrl = new URL(operation);
  } catch {
    throw new ReceiptOcrError('Azure answered with an unreadable operation address.', 502);
  }
  if (operationUrl.origin !== endpoint) throw new ReceiptOcrError('Azure answered with an operation address on another host.', 502);

  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const res = await call(operationUrl.toString(), { method: 'GET' });
    if (!res.ok) throw new ReceiptOcrError(`Azure could not report on the receipt (HTTP ${res.status}).`, 502);
    const body = (await res.json().catch(() => null)) as { status?: string; analyzeResult?: unknown } | null;
    if (body?.status === 'succeeded') return parseAzureReceipt(body.analyzeResult);
    if (body?.status === 'failed' || body?.status === 'canceled') throw new ReceiptOcrError('Azure could not read this receipt. Type it in instead.', 502);
    if (Date.now() >= deadline) throw new ReceiptOcrError('Azure took too long to read the receipt. Try again, or type it in.', 504);
    const retryAfter = Number(res.headers.get('retry-after'));
    await sleep(Number.isFinite(retryAfter) && retryAfter > 0 ? Math.min(retryAfter * 1000, 5_000) : pollMs);
  }
}
