// Sprint 6L Extension 2: the GYST Co-Pilot - the council's Microsoft Copilot Studio agent reached over Direct Line 3.0,
// its secret kept in the credentials vault. Microsoft is replaced here by a recorded fake fetch.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  buildCollateralPrompt,
  cleanCopilotPrompt,
  COPILOT_PROMPT_LABEL,
  COPILOT_PROMPT_MAX_LENGTH,
  copilotReplyText,
  CREDENTIAL_KEYS,
  DEFAULT_DIRECT_LINE_ENDPOINT,
  resolveDirectLineEndpoint,
} from '@kofc/shared';
import { askCopilotStudio, copilotConnected, CopilotGatewayError } from '../apps/web/services/marketing/copilot-gateway';
import { credentialsVault } from '../apps/web/services/server/credentials-vault';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = (path: string) => readFileSync(join(root, path), 'utf8');
const SECRET = 'dl-secret-abc123';

interface Call {
  url: string;
  method: string;
  auth: string | null;
  body: unknown;
}

/** A fake Direct Line service: starts conversation c1, takes one message, replies on the second poll. */
function fakeDirectLine(opts: { status?: number; replyOnPoll?: number; reply?: string } = {}) {
  const calls: Call[] = [];
  let polls = 0;
  const impl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const headers = new Headers(init?.headers);
    calls.push({ url, method: init?.method ?? 'GET', auth: headers.get('Authorization'), body: init?.body ? JSON.parse(String(init.body)) : undefined });
    const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
    if (opts.status) return json({}, opts.status);
    if (url.endsWith('/conversations')) return json({ conversationId: 'c1', token: 'conv-token' }, 201);
    if (url.endsWith('/conversations/c1/activities') && init?.method === 'POST') return json({ id: 'c1|0001' });
    polls += 1;
    const activities =
      polls >= (opts.replyOnPoll ?? 2)
        ? [
            { type: 'message', id: 'c1|0001', from: { id: 'kofc-member-9' }, text: 'ours' },
            { type: 'typing', id: 'c1|0002', from: { id: 'bot' } },
            { type: 'message', id: 'c1|0003', from: { id: 'bot' }, replyToId: 'c1|0001', text: opts.reply ?? 'Join us for the Lenten Fish Fry!' },
          ]
        : [];
    return json({ activities, watermark: String(polls) });
  }) as typeof fetch;
  return { impl, calls };
}

const fast = { sleep: async () => {}, pollMs: 0, timeoutMs: 1000, env: {} };

describe('co-pilot prompt rules', () => {
  it('keeps the vault key and the prompt box label', () => {
    expect(CREDENTIAL_KEYS).toContain('COPILOT_STUDIO_DIRECT_LINE_SECRET');
    expect(COPILOT_PROMPT_LABEL).toBe('Ask GYST Co-Pilot to Design Advanced Collateral');
  });

  it('trims the request and refuses an empty or oversized one', () => {
    expect(cleanCopilotPrompt('  a flyer  ')).toBe('a flyer');
    for (const bad of ['', '   ', 42, 'x'.repeat(COPILOT_PROMPT_MAX_LENGTH + 1)]) expect(() => cleanCopilotPrompt(bad)).toThrow(/1-2000/);
  });

  it('adds the event facts and the voice rules to the request', () => {
    const prompt = buildCollateralPrompt({
      request: 'A bulletin notice',
      councilName: "St. Mary's Council 15295",
      event: { EventName: 'Lenten Fish Fry', EventDescription: 'Fish in the hall.', StartDate: '2027-03-12', EndDate: '2027-03-12', Location: 'Parish Hall' },
    });
    expect(prompt.startsWith('A bulletin notice\n')).toBe(true);
    expect(prompt).toContain('Event: Lenten Fish Fry');
    expect(prompt).toContain('Date: 2027-03-12');
    expect(prompt).toContain('Location: Parish Hall');
    expect(prompt).toMatch(/do not invent numbers, quotes, testimonials or endorsements/);
  });

  it('sends a secret only to a Microsoft Direct Line host over HTTPS', () => {
    expect(resolveDirectLineEndpoint(undefined)).toBe(DEFAULT_DIRECT_LINE_ENDPOINT);
    expect(resolveDirectLineEndpoint('https://europe.directline.botframework.com/v3/directline/')).toBe('https://europe.directline.botframework.com/v3/directline');
    for (const bad of ['http://directline.botframework.com/v3/directline', 'https://evil.example/v3/directline', 'https://directline.botframework.com.evil.example', 'https://u:p@directline.botframework.com', 'not a url']) {
      expect(() => resolveDirectLineEndpoint(bad)).toThrow();
    }
  });

  it("reads the agent's reply to our message, or the bot messages after it", () => {
    const ours = { type: 'message', id: 'm1', from: { id: 'me' }, text: 'hi' };
    expect(copilotReplyText([ours], 'me', 'm1')).toBeNull();
    expect(copilotReplyText([{ type: 'message', id: 'g', from: { id: 'bot' }, text: 'Hello!' }, ours, { type: 'message', from: { id: 'bot' }, replyToId: 'm1', text: 'A' }], 'me', 'm1')).toBe('A');
    expect(copilotReplyText([ours, { type: 'message', from: { id: 'bot' }, text: 'B' }], 'me', 'm1')).toBe('B');
  });
});

describe('askCopilotStudio', () => {
  it('refuses with 503 while the council has no key', async () => {
    credentialsVault().remove(901, 'COPILOT_STUDIO_DIRECT_LINE_SECRET');
    expect(copilotConnected(901)).toBe(false);
    const { impl, calls } = fakeDirectLine();
    await expect(askCopilotStudio(901, 'kofc-member-9', 'hi', { ...fast, fetchImpl: impl })).rejects.toMatchObject({ status: 503 });
    expect(calls).toEqual([]);
  });

  it('starts a conversation with the secret, then talks with the conversation token only', async () => {
    credentialsVault().put(902, 'COPILOT_STUDIO_DIRECT_LINE_SECRET', SECRET);
    expect(copilotConnected(902)).toBe(true);
    const { impl, calls } = fakeDirectLine();
    expect(await askCopilotStudio(902, 'kofc-member-9', 'Write a flyer', { ...fast, fetchImpl: impl })).toBe('Join us for the Lenten Fish Fry!');
    expect(calls[0]).toMatchObject({ url: `${DEFAULT_DIRECT_LINE_ENDPOINT}/conversations`, method: 'POST', auth: `Bearer ${SECRET}` });
    expect(calls[1]).toMatchObject({ url: `${DEFAULT_DIRECT_LINE_ENDPOINT}/conversations/c1/activities`, method: 'POST', auth: 'Bearer conv-token' });
    expect(calls[1].body).toEqual({ type: 'message', from: { id: 'kofc-member-9' }, locale: 'en-US', text: 'Write a flyer' });
    expect(calls.slice(1).every((c) => c.auth === 'Bearer conv-token')).toBe(true);
    expect(calls[3].url).toContain('?watermark=1');
  });

  it('maps a refused key to 502 and a silent agent to 504', async () => {
    credentialsVault().put(903, 'COPILOT_STUDIO_DIRECT_LINE_SECRET', SECRET);
    const refused = fakeDirectLine({ status: 403 });
    await expect(askCopilotStudio(903, 'u', 'hi', { ...fast, fetchImpl: refused.impl })).rejects.toMatchObject({ status: 502, message: /refused the saved Co-Pilot key/ });
    const silent = fakeDirectLine({ replyOnPoll: Number.POSITIVE_INFINITY });
    const err = await askCopilotStudio(903, 'u', 'hi', { ...fast, timeoutMs: 5, fetchImpl: silent.impl }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(CopilotGatewayError);
    expect((err as CopilotGatewayError).status).toBe(504);
  });

  it('refuses a server endpoint override outside Microsoft before sending the secret', async () => {
    credentialsVault().put(904, 'COPILOT_STUDIO_DIRECT_LINE_SECRET', SECRET);
    const { impl, calls } = fakeDirectLine();
    await expect(askCopilotStudio(904, 'u', 'hi', { ...fast, env: { COPILOT_DIRECT_LINE_ENDPOINT: 'https://evil.example' }, fetchImpl: impl })).rejects.toMatchObject({ status: 503 });
    expect(calls).toEqual([]);
  });
});

describe('portal wiring', () => {
  it('puts the labelled prompt box on the Marketing Factory and the key on the Credentials Vault page', () => {
    expect(read('apps/web/app/resources/marketing/page.tsx')).toContain('<CopilotPrompt');
    const box = read('apps/web/components/CopilotPrompt.tsx');
    expect(box).toContain('label={COPILOT_PROMPT_LABEL}');
    expect(box).toContain("'/api/marketing/copilot'");
    expect(read('apps/web/app/credentials-vault/page.tsx')).toContain("credentialKey: 'COPILOT_STUDIO_DIRECT_LINE_SECRET'");
    const route = read('apps/web/app/api/marketing/copilot/route.ts');
    expect(route).toContain('canOpenMarketingFactory(claims)');
    expect(route).toContain('session.claims.councilId');
  });

  it('keeps the gateway out of the browser bundle', () => {
    const gateway = read('apps/web/services/marketing/copilot-gateway.ts');
    expect(gateway).toContain("typeof window !== 'undefined'");
    expect(read('apps/web/components/CopilotPrompt.tsx')).not.toContain('copilot-gateway');
  });
});
