// The Microsoft Co-Pilot gateway (Sprint 6L Extension 2). SERVER ONLY, like services/server/credentials-vault.ts.
//
// Connects the Marketing Factory to the council's own Microsoft Copilot Studio agent through the Bot Framework Direct
// Line 3.0 API, which the agent's web channel exposes:
//   1. POST {endpoint}/conversations with the council's Direct Line secret starts a conversation and returns a token
//      scoped to that one conversation; the secret is used for nothing else.
//   2. POST {endpoint}/conversations/{id}/activities sends the request as a message, with that token.
//   3. GET  {endpoint}/conversations/{id}/activities?watermark=… is polled until the agent replies, or the time runs out.
// The secret is read from the credentials vault (COPILOT_STUDIO_DIRECT_LINE_SECRET) at the moment of use and never
// logged or returned. The endpoint is Microsoft's global Direct Line host, or COPILOT_DIRECT_LINE_ENDPOINT when it names
// another Direct Line host (resolveDirectLineEndpoint refuses anything else).
import { copilotReplyText, resolveDirectLineEndpoint, type DirectLineActivity } from '@kofc/shared';
import { credentialsVault } from '../server/credentials-vault';

if (typeof window !== 'undefined') {
  throw new Error('services/marketing/copilot-gateway.ts was loaded in a browser. Server secrets must never reach the client bundle.');
}

export const COPILOT_SECRET_KEY = 'COPILOT_STUDIO_DIRECT_LINE_SECRET' as const;

/** Why a request did not produce an answer; `status` is the HTTP status the route answers with. */
export class CopilotGatewayError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'CopilotGatewayError';
  }
}

export interface CopilotGatewayOptions {
  fetchImpl?: typeof fetch;
  env?: Record<string, string | undefined>;
  /** How long to wait for the agent's reply. */
  timeoutMs?: number;
  /** The pause between polls. */
  pollMs?: number;
  sleep?: (ms: number) => Promise<void>;
}

/** Whether the council has saved a Direct Line secret (it may still fail to open; see askCopilotStudio). */
export const copilotConnected = (councilId: number): boolean => credentialsVault().has(councilId, COPILOT_SECRET_KEY);

/**
 * Sends `prompt` to the council's Copilot Studio agent and returns its answer. `userId` names the member in the
 * conversation (an opaque id, not their name or email). Throws CopilotGatewayError: 503 when the council has no
 * usable secret, 502 when Microsoft refuses or fails, 504 when the agent does not answer in time.
 */
export async function askCopilotStudio(councilId: number, userId: string, prompt: string, options: CopilotGatewayOptions = {}): Promise<string> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const env = options.env ?? process.env;
  const timeoutMs = options.timeoutMs ?? 30_000;
  const pollMs = options.pollMs ?? 1_000;
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));

  const secret = credentialsVault().reveal(councilId, COPILOT_SECRET_KEY);
  if (!secret) throw new CopilotGatewayError('The Microsoft Co-Pilot is not connected for this council. An Admin saves its key on the Credentials Vault page.', 503);
  let endpoint: string;
  try {
    endpoint = resolveDirectLineEndpoint(env.COPILOT_DIRECT_LINE_ENDPOINT);
  } catch {
    throw new CopilotGatewayError('The server names a Direct Line endpoint that is not a Microsoft address.', 503);
  }

  const call = async <T>(path: string, bearer: string, init: { method: 'GET' | 'POST'; body?: unknown }): Promise<T> => {
    let res: Response;
    try {
      res = await fetchImpl(`${endpoint}${path}`, {
        method: init.method,
        headers: { Authorization: `Bearer ${bearer}`, ...(init.body !== undefined ? { 'Content-Type': 'application/json' } : {}) },
        body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
        cache: 'no-store',
      });
    } catch {
      throw new CopilotGatewayError('Microsoft Copilot Studio could not be reached. Try again later.', 502);
    }
    if (res.status === 401 || res.status === 403) {
      throw new CopilotGatewayError('Microsoft refused the saved Co-Pilot key. An Admin replaces it on the Credentials Vault page.', 502);
    }
    if (!res.ok) throw new CopilotGatewayError(`Microsoft Copilot Studio answered HTTP ${res.status}. Try again later.`, 502);
    return (await res.json().catch(() => ({}))) as T;
  };

  // 1. A conversation and its own token; the council's secret stops here.
  const started = await call<{ conversationId?: string; token?: string }>('/conversations', secret, { method: 'POST' });
  if (!started.conversationId) throw new CopilotGatewayError('Microsoft Copilot Studio did not start a conversation.', 502);
  const token = started.token ?? secret;
  const conversation = `/conversations/${encodeURIComponent(started.conversationId)}`;

  // 2. The request.
  const sent = await call<{ id?: string }>(`${conversation}/activities`, token, {
    method: 'POST',
    body: { type: 'message', from: { id: userId }, locale: 'en-US', text: prompt },
  });
  if (!sent.id) throw new CopilotGatewayError('Microsoft Copilot Studio did not accept the request.', 502);

  // 3. Poll for the reply.
  const seen: DirectLineActivity[] = [];
  let watermark: string | undefined;
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await sleep(pollMs);
    const page = await call<{ activities?: DirectLineActivity[]; watermark?: string }>(
      `${conversation}/activities${watermark ? `?watermark=${encodeURIComponent(watermark)}` : ''}`,
      token,
      { method: 'GET' },
    );
    seen.push(...(page.activities ?? []));
    watermark = page.watermark ?? watermark;
    const reply = copilotReplyText(seen, userId, sent.id);
    if (reply) return reply;
  }
  throw new CopilotGatewayError('The Microsoft Co-Pilot did not answer in time. Try a shorter request.', 504);
}
