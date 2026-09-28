'use client';
// The header's alert bell (Sprint 5T): a bell beside the member token with a red count of unread alerts that pulses
// while any are waiting. It opens the "Trailing 6-Month Notification Log" drawer (notifications.listMemberAlerts),
// newest first, with unread alerts on a soft gold wash; opening one marks it read (notifications.markAsRead), so its
// wash fades and the count drops at once. The log reloads when the session says alerts changed and once a minute.
import { useEffect, useState } from 'react';
import { ALERT_HISTORY_MONTHS, countUnreadAlerts, describeError, formatTimestamp, type NotificationLog } from '@kofc/shared';
import { Drawer } from '@/components/Drawer';
import { cx, Empty, Notice, Pill } from '@/components/ui';
import { useSession, useUser } from '@/lib/session';
import { useLoad } from '@/lib/use-load';
import { db } from '@/services/db';

/** How often the bell re-reads the log, so alerts sent from another session show up without a reload. */
const ALERT_POLL_MS = 60_000;

const PRIORITY_TONE = { High: 'red', Medium: 'gold', Low: 'outline' } as const;

/** A bell outline in currentColor (white on the navy header). */
function BellIcon() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}

function AlertRow({ alert, read, onOpen }: { alert: NotificationLog; read: boolean; onOpen: () => void }) {
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        aria-label={`${read ? '' : 'Unread: '}${alert.Title}`}
        className={cx(
          'w-full rounded border-l-4 px-3 py-2 text-left ring-1 ring-line transition-colors duration-700 motion-reduce:transition-none',
          read ? 'border-line bg-white' : 'border-gold bg-linear-to-r from-gold/35 to-white',
        )}
      >
        <span className="flex items-start justify-between gap-2">
          <span className={cx('text-sm', !read && 'font-bold')}>{alert.Title}</span>
          <Pill tone={PRIORITY_TONE[alert.Priority]}>{alert.Priority}</Pill>
        </span>
        <span className="mt-1 block whitespace-pre-wrap text-sm">{alert.MessageBody}</span>
        <span className="mt-1 block text-xs text-muted">
          {formatTimestamp(alert.SentAt)}
          {read ? ' · Read' : ' · New'}
        </span>
      </button>
    </li>
  );
}

export function AlertBell() {
  const user = useUser();
  const { alertsVersion, alertsChanged } = useSession();
  const alerts = useLoad(() => db.notifications.listMemberAlerts(user.memberId), [user.memberId, alertsVersion]);
  const [open, setOpen] = useState(false);
  /** Alerts marked read in this view, shown read before the reload confirms it. */
  const [readNow, setReadNow] = useState<ReadonlySet<number>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const reload = alerts.reload;

  useEffect(() => {
    const timer = setInterval(() => void reload(), ALERT_POLL_MS);
    return () => clearInterval(timer);
  }, [reload]);

  const rows = alerts.data ?? [];
  const isRead = (a: NotificationLog) => !!a.IsRead || readNow.has(a.id);
  const unread = countUnreadAlerts(rows.map((a) => ({ IsRead: isRead(a) ? 1 : 0 })));

  const markRead = async (alert: NotificationLog) => {
    if (isRead(alert)) return;
    setError(null);
    setReadNow((now) => new Set(now).add(alert.id));
    try {
      await db.notifications.markAsRead(user.memberId, alert.id);
      alertsChanged();
    } catch (err) {
      setReadNow((now) => {
        const next = new Set(now);
        next.delete(alert.id);
        return next;
      });
      setError(describeError(err));
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={unread > 0 ? `Alerts: ${unread} unread` : 'Alerts: none unread'}
        title="Trailing 6-month notification log"
        className="relative rounded p-2 text-white hover:bg-white/10"
      >
        <BellIcon />
        {unread > 0 ? (
          <span
            aria-hidden="true"
            className="absolute -right-0.5 -top-0.5 min-w-5 rounded-full border-2 border-navy bg-brand-red px-1 text-center text-xs font-bold leading-4 text-white motion-safe:animate-pulse"
          >
            {unread > 99 ? '99+' : unread}
          </span>
        ) : null}
      </button>
      {open ? (
        <Drawer title="Trailing 6-Month Notification Log" onClose={() => setOpen(false)}>
          <p className="text-sm text-muted">
            Alerts your council leadership sent you in the last {ALERT_HISTORY_MONTHS} months, newest first. Open an alert to mark it read.
          </p>
          {alerts.error ? <Notice tone="error">{alerts.error}</Notice> : null}
          {error ? (
            <Notice tone="error" onDismiss={() => setError(null)}>
              {error}
            </Notice>
          ) : null}
          {alerts.data && rows.length === 0 ? <Empty>No alerts in the last {ALERT_HISTORY_MONTHS} months.</Empty> : null}
          <ul className="flex flex-col gap-2" aria-label="Alerts">
            {rows.map((alert) => (
              <AlertRow key={alert.id} alert={alert} read={isRead(alert)} onOpen={() => void markRead(alert)} />
            ))}
          </ul>
        </Drawer>
      ) : null}
    </>
  );
}
