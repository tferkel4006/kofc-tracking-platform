'use client';
// Skills filter drawer: every skill held in the council with how many members hold it, the holders of the
// chosen skill, and one message to all of them (communication.sendBulkToSkills). Used from the member roster
// and from the Communications Hub's "New message" button.
import { useState } from 'react';
import { describeError, type CouncilSkillEntry } from '@kofc/shared';
import { Drawer } from '@/components/Drawer';
import { Button, cx, Empty, Field, Notice, Table, Td, Textarea } from '@/components/ui';
import { useUser } from '@/lib/session';
import { useLoad } from '@/lib/use-load';
import { db } from '@/services/db';

export function SkillFilterDrawer({
  councilId,
  title = 'Council skills',
  onClose,
  onSent,
}: {
  councilId: number;
  title?: string;
  onClose: () => void;
  /** Called with the new thread's id after a message goes out. */
  onSent?: (threadId: number) => void;
}) {
  const user = useUser();
  const roster = useLoad(() => db.communication.listCouncilSkills(councilId), [councilId]);
  const [skillId, setSkillId] = useState<number | null>(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'error' | 'info'; text: string } | null>(null);

  const bySkill = new Map<number, { name: string; holders: CouncilSkillEntry[] }>();
  for (const entry of roster.data ?? []) {
    const group = bySkill.get(entry.skill.id) ?? { name: entry.skill.SkillName, holders: [] };
    group.holders.push(entry);
    bySkill.set(entry.skill.id, group);
  }
  const chosen = skillId === null ? undefined : bySkill.get(skillId);
  // The sender never receives their own bulk message, so they are not counted as a recipient.
  const recipients = chosen?.holders.filter((h) => h.memberId !== user.memberId).length ?? 0;

  const send = async () => {
    if (skillId === null) return;
    setBusy(true);
    setMessage(null);
    try {
      const result = await db.communication.sendBulkToSkills(councilId, skillId, text, user.memberId);
      const sentTo = result.recipientIds.length;
      setMessage({ tone: 'info', text: `Sent to ${sentTo} active member${sentTo === 1 ? '' : 's'} with ${chosen?.name ?? 'the skill'}. Replies arrive in the Communications Hub.` });
      setText('');
      if (result.message.ThreadID != null) onSent?.(result.message.ThreadID);
    } catch (err) {
      setMessage({ tone: 'error', text: describeError(err) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Drawer title={title} onClose={onClose}>
      {roster.error ? <Notice tone="error">{roster.error}</Notice> : null}
      {roster.data?.length === 0 ? <Empty>No member of this council has recorded a skill yet. Members add skills from My Profile.</Empty> : null}
      <ul className="flex flex-wrap gap-2" aria-label="Skills">
        {[...bySkill.entries()].map(([id, group]) => (
          <li key={id}>
            <button
              type="button"
              aria-pressed={skillId === id}
              onClick={() => {
                setSkillId(id);
                setMessage(null);
              }}
              className={cx('rounded-full border-2 px-3 py-1 text-sm font-bold', skillId === id ? 'border-gold bg-gold text-navy' : 'border-navy bg-white text-navy')}
            >
              {group.name} · {group.holders.length}
            </button>
          </li>
        ))}
      </ul>

      {chosen ? (
        <>
          <Table caption={`Members with ${chosen.name}`} head={['Member', 'Level', 'Contact']}>
            {chosen.holders.map((h) => (
              <tr key={h.memberId}>
                <Td>
                  {h.lastName}, {h.firstName}
                </Td>
                <Td>{h.level.SkillLevel}</Td>
                <Td className="text-xs">
                  <a href={`mailto:${h.email}`} className="underline">
                    {h.email}
                  </a>
                  <br />
                  {h.phone}
                </Td>
              </tr>
            ))}
          </Table>
          {message ? (
            <Notice tone={message.tone} onDismiss={() => setMessage(null)}>
              {message.text}
            </Notice>
          ) : null}
          <Field label={`Message everyone with ${chosen.name}`} hint="Only active members are messaged, and never you.">
            {(id) => <Textarea id={id} value={text} onChange={(e) => setText(e.target.value)} maxLength={4000} />}
          </Field>
          <Button onClick={() => void send()} disabled={busy || text.trim() === '' || recipients === 0}>
            {busy ? 'Sending…' : `Send to ${recipients} member${recipients === 1 ? '' : 's'}`}
          </Button>
        </>
      ) : roster.data && roster.data.length > 0 ? (
        <p className="text-sm text-muted">Choose a skill to see who has it and message them.</p>
      ) : null}
    </Drawer>
  );
}
