'use client';
// Emergency dispatch drawer (Sprint 5T), opened from the Communications Hub by council leadership: a title, a message
// and a priority, sent to the chosen trade skill networks of the council and/or the rosters of its upcoming shifts
// (notifications.dispatchHighPriorityAlert). A shift roster includes volunteers from affiliated sister councils. Every
// recipient gets the alert in their notification log; those with a registered phone also get a push.
import { useState } from 'react';
import {
  ALERT_BODY_MAX_LENGTH,
  ALERT_TITLE_MAX_LENGTH,
  describeError,
  NOTIFICATION_PRIORITIES,
  toIsoDate,
  type CouncilSkillEntry,
  type NotificationPriority,
} from '@kofc/shared';
import { Drawer } from '@/components/Drawer';
import { Button, cx, Empty, Field, Input, Notice, Select, Textarea } from '@/components/ui';
import { useSession, useUser } from '@/lib/session';
import { useLoad } from '@/lib/use-load';
import { db } from '@/services/db';

/** How far ahead the shift roster picker looks. */
const ROSTER_HORIZON_DAYS = 60;

const toggle = (ids: readonly number[], id: number): number[] => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]);

function CheckList<T>({
  label,
  items,
  chosen,
  onToggle,
  keyOf,
  render,
}: {
  label: string;
  items: T[];
  chosen: readonly number[];
  onToggle: (id: number) => void;
  keyOf: (item: T) => number;
  render: (item: T) => string;
}) {
  return (
    <fieldset className="flex flex-col gap-1">
      <legend className="mb-1 text-xs font-bold uppercase tracking-wide text-navy">{label}</legend>
      <ul className="flex max-h-48 flex-col gap-1 overflow-y-auto rounded border border-line p-2">
        {items.map((item) => {
          const id = keyOf(item);
          const on = chosen.includes(id);
          return (
            <li key={id}>
              <label className={cx('flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm', on && 'bg-gold/25 font-bold')}>
                <input type="checkbox" checked={on} onChange={() => onToggle(id)} className="accent-navy" />
                {render(item)}
              </label>
            </li>
          );
        })}
      </ul>
    </fieldset>
  );
}

export function AlertDispatchDrawer({ councilId, onClose }: { councilId: number; onClose: () => void }) {
  const user = useUser();
  const { alertsChanged } = useSession();
  const today = new Date();
  const skills = useLoad(() => db.communication.listCouncilSkills(councilId), [councilId]);
  const shifts = useLoad(
    () =>
      db.events.listShiftFeed({
        memberId: user.memberId,
        councilIds: [councilId],
        fromDate: toIsoDate(today),
        toDate: toIsoDate(new Date(today.getFullYear(), today.getMonth(), today.getDate() + ROSTER_HORIZON_DAYS)),
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [councilId, user.memberId],
  );
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [priority, setPriority] = useState<NotificationPriority>('High');
  const [skillIds, setSkillIds] = useState<number[]>([]);
  const [shiftIds, setShiftIds] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'error' | 'info'; text: string } | null>(null);

  const networks = new Map<number, { skill: CouncilSkillEntry['skill']; holders: number }>();
  for (const entry of skills.data ?? []) {
    const n = networks.get(entry.skill.id) ?? { skill: entry.skill, holders: 0 };
    n.holders += 1;
    networks.set(entry.skill.id, n);
  }
  const ready = title.trim() !== '' && body.trim() !== '' && skillIds.length + shiftIds.length > 0;

  const dispatch = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const result = await db.notifications.dispatchHighPriorityAlert(user.memberId, councilId, { skillIds, shiftIds }, { title, body, priority });
      const reached = result.recipientIds.length;
      const pushed = result.pushRequests.reduce((n, r) => n + r.body.length, 0);
      setMessage({
        tone: 'info',
        text:
          `Alert logged for ${reached} member${reached === 1 ? '' : 's'}; pushed to ${pushed} registered phone${pushed === 1 ? '' : 's'}.` +
          (result.unreachableMemberIds.length > 0 ? ` ${result.unreachableMemberIds.length} without a registered phone will see it in their alert bell.` : ''),
      });
      setTitle('');
      setBody('');
      alertsChanged();
    } catch (err) {
      setMessage({ tone: 'error', text: describeError(err) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Drawer title="Dispatch High-Priority Push Notification Alert" onClose={onClose} wide>
      <Field label="Title">{(id) => <Input id={id} value={title} maxLength={ALERT_TITLE_MAX_LENGTH} onChange={(e) => setTitle(e.target.value)} />}</Field>
      <Field label="Message">{(id) => <Textarea id={id} value={body} maxLength={ALERT_BODY_MAX_LENGTH} onChange={(e) => setBody(e.target.value)} />}</Field>
      <Field label="Priority" className="w-48">
        {(id) => (
          <Select id={id} value={priority} onChange={(e) => setPriority(e.target.value as NotificationPriority)}>
            {[...NOTIFICATION_PRIORITIES].reverse().map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </Select>
        )}
      </Field>

      {skills.error ? <Notice tone="error">{skills.error}</Notice> : null}
      {networks.size > 0 ? (
        <CheckList
          label="Trade skill networks (this council's active members)"
          items={[...networks.values()]}
          chosen={skillIds}
          onToggle={(id) => setSkillIds((ids) => toggle(ids, id))}
          keyOf={(n) => n.skill.id}
          render={(n) => `${n.skill.SkillName} · ${n.holders} member${n.holders === 1 ? '' : 's'}`}
        />
      ) : skills.data ? (
        <Empty>No member of this council has recorded a skill yet.</Empty>
      ) : null}

      {shifts.error ? <Notice tone="error">{shifts.error}</Notice> : null}
      {shifts.data && shifts.data.length > 0 ? (
        <CheckList
          label={`Shift rosters in the next ${ROSTER_HORIZON_DAYS} days (includes sister-council volunteers)`}
          items={shifts.data}
          chosen={shiftIds}
          onToggle={(id) => setShiftIds((ids) => toggle(ids, id))}
          keyOf={(item) => item.shift.id}
          render={({ shift, event }) => `${shift.ShiftDate} · ${event.EventName} · ${shift.ShiftName} · ${shift.NumberVolunteersSignedUp} signed up`}
        />
      ) : shifts.data ? (
        <Empty>No shifts are scheduled in the next {ROSTER_HORIZON_DAYS} days.</Empty>
      ) : null}

      {message ? (
        <Notice tone={message.tone} onDismiss={() => setMessage(null)}>
          {message.text}
        </Notice>
      ) : null}
      <Button variant="danger" onClick={() => void dispatch()} disabled={busy || !ready} className="py-3 text-base">
        {busy ? 'Dispatching…' : `Dispatch ${priority}-priority alert`}
      </Button>
    </Drawer>
  );
}
