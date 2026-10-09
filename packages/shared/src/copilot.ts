// Sprint 6L Extension 2: the GYST Co-Pilot - the Marketing Factory's link to a council's own Microsoft Copilot Studio
// agent. This file holds the browser-safe half: the prompt rules, the collateral prompt the portal sends, the allowed
// Direct Line hosts and the reading of the agent's answer. The connection itself is server only
// (apps/web/services/marketing/copilot-gateway.ts), and the agent's Direct Line secret lives in the credentials vault
// (COPILOT_STUDIO_DIRECT_LINE_SECRET), never in a browser.
import { BusinessRuleError } from './rules';
import type { Event } from './types';

/** The prompt box's label on the Marketing Factory. */
export const COPILOT_PROMPT_LABEL = 'Ask GYST Co-Pilot to Design Advanced Collateral';

/** The longest request a member may type (the event facts the portal adds come on top). */
export const COPILOT_PROMPT_MAX_LENGTH = 2000;

/** A typed request, trimmed. Rejects INVALID_INPUT when empty or too long. */
export function cleanCopilotPrompt(value: unknown): string {
  const text = typeof value === 'string' ? value.replace(/\r\n/g, '\n').trim() : '';
  if (!text || text.length > COPILOT_PROMPT_MAX_LENGTH) {
    throw new BusinessRuleError('INVALID_INPUT', `Type a request of 1-${COPILOT_PROMPT_MAX_LENGTH} characters for the co-pilot.`, { field: 'prompt' });
  }
  return text;
}

/**
 * The message sent to the agent: the member's request, then the chosen event's own facts and the council's voice rules
 * (the marketing-factory skill: warm public-event copy, no invented numbers, quotes or endorsements, no emblem).
 */
export function buildCollateralPrompt(input: {
  request: string;
  councilName: string;
  event?: Pick<Event, 'EventName' | 'EventDescription' | 'StartDate' | 'EndDate' | 'Location'> | null;
}): string {
  const lines = [input.request.trim(), '', `Council: ${input.councilName.trim() || 'Knights of Columbus council'}`];
  if (input.event) {
    const e = input.event;
    const start = e.StartDate.slice(0, 10);
    const end = e.EndDate.slice(0, 10);
    lines.push(`Event: ${e.EventName.trim()}`, `Date: ${start === end ? start : `${start} to ${end}`}`);
    if (e.Location?.trim()) lines.push(`Location: ${e.Location.trim()}`);
    if (e.EventDescription?.trim()) lines.push(`Description: ${e.EventDescription.trim()}`);
  }
  lines.push(
    '',
    'Write in a warm, plain, welcoming voice for families and parish neighbors. Use only the facts above; do not invent numbers, quotes, testimonials or endorsements, and do not use the Knights of Columbus emblem. Mark any missing fact as [PLACEHOLDER].',
  );
  return lines.join('\n');
}

/** The Bot Framework Direct Line 3.0 service the Copilot Studio web channel uses. */
export const DEFAULT_DIRECT_LINE_ENDPOINT = 'https://directline.botframework.com/v3/directline';

/** Only Microsoft's Direct Line hosts (the global one and its regional ones) may receive a council's secret. */
const DIRECT_LINE_HOST = /^(?:[a-z]+\.)?directline\.botframework\.com$/;

/**
 * The Direct Line base URL to call: the default, or an HTTPS override on a Microsoft Direct Line host (for example the
 * European region). Anything else is refused, so a misconfigured server never sends a secret elsewhere.
 */
export function resolveDirectLineEndpoint(override?: string | null): string {
  if (!override?.trim()) return DEFAULT_DIRECT_LINE_ENDPOINT;
  let url: URL;
  try {
    url = new URL(override.trim());
  } catch {
    throw new BusinessRuleError('INVALID_INPUT', 'The Direct Line endpoint is not a valid URL.', { field: 'COPILOT_DIRECT_LINE_ENDPOINT' });
  }
  if (url.protocol !== 'https:' || !DIRECT_LINE_HOST.test(url.hostname) || url.username || url.password || url.port) {
    throw new BusinessRuleError('INVALID_INPUT', 'The Direct Line endpoint must be an https://…directline.botframework.com address.', {
      field: 'COPILOT_DIRECT_LINE_ENDPOINT',
    });
  }
  return `${url.origin}${url.pathname.replace(/\/+$/, '') || '/v3/directline'}`;
}

/** The parts of a Direct Line activity the portal reads. */
export interface DirectLineActivity {
  type?: string;
  id?: string;
  from?: { id?: string; role?: string };
  replyToId?: string;
  text?: string;
}

/**
 * The agent's answer to the message `sentId`: the text of every bot message that replies to it, in order. An agent that
 * does not set replyToId is read from the bot messages after ours instead. Null while there is none yet.
 */
export function copilotReplyText(activities: readonly DirectLineActivity[], userId: string, sentId: string): string | null {
  const fromBot = (a: DirectLineActivity) => a.type === 'message' && a.from?.id !== userId && typeof a.text === 'string' && a.text.trim() !== '';
  let replies = activities.filter((a) => fromBot(a) && a.replyToId === sentId);
  if (replies.length === 0) {
    const ours = activities.findIndex((a) => a.id === sentId);
    replies = ours === -1 ? [] : activities.slice(ours + 1).filter((a) => fromBot(a) && !a.replyToId);
  }
  return replies.length > 0 ? replies.map((a) => a.text!.trim()).join('\n\n') : null;
}
