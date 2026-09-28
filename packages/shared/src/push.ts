// =========================================================================
// SMARTPHONE PUSH ALERTS (Sprint 5T)
// Pure helpers behind notifications.registerDeviceToken, listMemberAlerts and
// dispatchHighPriorityAlert. Every alert is logged per recipient in
// NotificationLog; the phones are reached through the Expo Push API. No push
// credentials exist yet, so the drivers print the Expo requests with
// console.log instead of sending them (the same stub as the .ics emails).
// =========================================================================
import type { AlertDispatchResult, AlertFilters, AlertPayload, ExpoPushMessage, ExpoPushRequest } from './contract';
import { assertText, BusinessRuleError } from './rules';
import { toTimestamp } from './messaging';
import type { NotificationLog, NotificationPriority } from './types';

/** Members read back the alerts of this many trailing months. */
export const ALERT_HISTORY_MONTHS = 6;
/** Longest Member.ExpoPushToken (VARCHAR(512)). */
export const EXPO_PUSH_TOKEN_MAX_LENGTH = 512;
/** Longest NotificationLog.Title (VARCHAR(100)). */
export const ALERT_TITLE_MAX_LENGTH = 100;
/** Longest NotificationLog.MessageBody (VARCHAR(2000)). */
export const ALERT_BODY_MAX_LENGTH = 2000;
export const NOTIFICATION_PRIORITIES: readonly NotificationPriority[] = ['Low', 'Medium', 'High'];

/** Expo Push API: POST a JSON array of at most EXPO_PUSH_BATCH_SIZE messages. */
export const EXPO_PUSH_ENDPOINT = 'https://exp.host/--/api/v2/push/send';
export const EXPO_PUSH_BATCH_SIZE = 100;

const EXPO_TOKEN_PATTERN = /^Expo(?:nent)?PushToken\[[^\]\s]+\]$/;

const invalid = (message: string, details: Record<string, unknown> = {}) => new BusinessRuleError('INVALID_INPUT', message, details);

/** A device token for registerDeviceToken: an Expo push token, or null (or blank) to unregister the device. */
export function cleanExpoPushToken(token: unknown): string | null {
  if (token === null || token === undefined) return null;
  if (typeof token !== 'string') throw invalid('The device push token must be text.', { token });
  const trimmed = token.trim();
  if (!trimmed) return null;
  if (trimmed.length > EXPO_PUSH_TOKEN_MAX_LENGTH) {
    throw invalid(`The device push token is longer than ${EXPO_PUSH_TOKEN_MAX_LENGTH} characters.`, { length: trimmed.length });
  }
  if (!EXPO_TOKEN_PATTERN.test(trimmed)) {
    throw invalid('The device push token is not an Expo push token (ExponentPushToken[...]).', { token: trimmed });
  }
  return trimmed;
}

const cleanIds = (ids: unknown, label: string): number[] => {
  if (ids === undefined || ids === null) return [];
  if (!Array.isArray(ids)) throw invalid(`${label} must be a list of ids.`, { [label]: ids });
  for (const id of ids) if (!Number.isInteger(id) || id < 1) throw invalid(`${label} holds an invalid id: ${String(id)}.`, { id });
  return [...new Set(ids as number[])].sort((a, b) => a - b);
};

/** Who an alert targets: holders of any of the skills, and volunteers signed up for any of the shifts. At least one id. */
export function cleanAlertFilters(filters: AlertFilters): { skillIds: number[]; shiftIds: number[] } {
  const skillIds = cleanIds(filters?.skillIds, 'skillIds');
  const shiftIds = cleanIds(filters?.shiftIds, 'shiftIds');
  if (skillIds.length === 0 && shiftIds.length === 0) {
    throw invalid('Choose at least one skill or shift roster to alert.', { filters });
  }
  return { skillIds, shiftIds };
}

/** The alert's title, body and priority (default 'High'), trimmed and length-checked. */
export function cleanAlertPayload(payload: AlertPayload): { title: string; body: string; priority: NotificationPriority } {
  const priority = payload?.priority ?? 'High';
  if (!NOTIFICATION_PRIORITIES.includes(priority)) {
    throw invalid(`Priority must be one of ${NOTIFICATION_PRIORITIES.join(', ')}; received ${String(priority)}.`, { priority });
  }
  return {
    title: assertText(payload?.title, 'Title', ALERT_TITLE_MAX_LENGTH),
    body: assertText(payload?.body, 'Message', ALERT_BODY_MAX_LENGTH),
    priority,
  };
}

/** The oldest SentAt listMemberAlerts returns: exactly ALERT_HISTORY_MONTHS before `now`, as a UTC timestamp. */
export function alertHistoryThreshold(now: Date): string {
  const since = new Date(now);
  since.setMonth(since.getMonth() - ALERT_HISTORY_MONTHS);
  return toTimestamp(since);
}

/**
 * A Member row as the members.* reads return it: without ExpoPushToken, which works like a device credential (anyone
 * holding it can push to that phone), so the open roster never exposes it.
 */
export function withoutPushToken<T extends object>(row: T): T {
  const { ExpoPushToken: _token, ...rest } = row as T & { ExpoPushToken?: unknown };
  return rest as T;
}

/** Newest SentAt first, then newest id. */
export const sortAlerts = (rows: readonly NotificationLog[]): NotificationLog[] =>
  [...rows].sort((a, b) => b.SentAt.localeCompare(a.SentAt) || b.id - a.id);

/** Expo's priority for an alert's Priority. */
export const expoPriority = (priority: NotificationPriority): ExpoPushMessage['priority'] =>
  priority === 'High' ? 'high' : priority === 'Medium' ? 'default' : 'normal';

/**
 * One Expo message per logged alert whose recipient has a registered device. `data.notificationLogId` lets the app
 * open the alert when the member taps it.
 */
export function buildExpoPushMessages(
  logs: readonly NotificationLog[],
  tokens: ReadonlyMap<number, string | null>,
): ExpoPushMessage[] {
  const messages: ExpoPushMessage[] = [];
  for (const log of logs) {
    const to = tokens.get(log.TargetMemberID);
    if (!to) continue;
    messages.push({
      to,
      title: log.Title,
      body: log.MessageBody,
      priority: expoPriority(log.Priority),
      sound: 'default',
      data: { notificationLogId: log.id, councilId: log.CouncilID },
    });
  }
  return messages;
}

/** The Expo Push API requests that deliver `messages`, EXPO_PUSH_BATCH_SIZE per request. */
export function buildExpoPushRequests(messages: readonly ExpoPushMessage[]): ExpoPushRequest[] {
  const requests: ExpoPushRequest[] = [];
  for (let i = 0; i < messages.length; i += EXPO_PUSH_BATCH_SIZE) {
    requests.push({
      method: 'POST',
      url: EXPO_PUSH_ENDPOINT,
      headers: { Accept: 'application/json', 'Accept-Encoding': 'gzip, deflate', 'Content-Type': 'application/json' },
      body: messages.slice(i, i + EXPO_PUSH_BATCH_SIZE),
    });
  }
  return requests;
}

/** dispatchHighPriorityAlert found nobody to alert. */
export const noAlertRecipients = (councilId: number, filters: { skillIds: number[]; shiftIds: number[] }): BusinessRuleError =>
  new BusinessRuleError(
    'NO_RECIPIENTS',
    `No active member of council ${councilId} holds the chosen skills or is signed up for the chosen shifts, so there is nobody to alert.`,
    { councilId, ...filters },
  );

/**
 * The push stub, run once the alerts are logged: builds the Expo requests for recipients with a registered device and
 * prints each with `log` (console.log until push credentials exist). `tokens` maps each recipient to their token.
 */
export function deliverAlertsByStub(
  logs: readonly NotificationLog[],
  tokens: ReadonlyMap<number, string | null>,
  log: (...args: unknown[]) => void,
): AlertDispatchResult {
  const pushRequests = buildExpoPushRequests(buildExpoPushMessages(logs, tokens));
  for (const request of pushRequests) log('[expo-push]', JSON.stringify(request, null, 2));
  return {
    logs: [...logs],
    recipientIds: logs.map((l) => l.TargetMemberID),
    pushRequests,
    unreachableMemberIds: logs.filter((l) => !tokens.get(l.TargetMemberID)).map((l) => l.TargetMemberID),
  };
}
