'use client';
// A member's trade skills (each with a proficiency level), training classes and, optionally, working status.
// Used by My Profile (a member editing their own) and by the roster drawer (an Admin editing a member of their
// council). Saving replaces all three at once through memberProfiles.updateExtensions, and the drivers decide
// who may save (ADMIN_REQUIRED, COUNCIL_ACCESS_DENIED), so a refusal is reported, never hidden.
import { useEffect, useState } from 'react';
import { describeError, EARLIEST_TRAINING_YEAR, type MemberExtensions, type ProfileOptions } from '@kofc/shared';
import { Button, cx, Empty, Field, Input, Notice, Select, Table, Td } from '@/components/ui';
import { useUser } from '@/lib/session';
import { useLoad } from '@/lib/use-load';
import { db } from '@/services/db';

interface TrainingDraft {
  trainingClassId: number;
  year: number;
}

interface Draft {
  /** skillId -> skillLevelId for every ticked skill. */
  skills: Map<number, number>;
  training: TrainingDraft[];
  workingStatusId: number | null;
}

const draftFrom = (ext: MemberExtensions): Draft => ({
  skills: new Map(ext.skills.map((s) => [s.skill.id, s.level.id])),
  training: ext.training.map((t) => ({ trainingClassId: t.trainingClass.id, year: t.year })),
  workingStatusId: ext.workingStatus?.id ?? null,
});

export function ProfileExtensionsEditor({
  memberId,
  showWorkingStatus,
  onSaved,
}: {
  memberId: number;
  /** Off in the roster drawer: the member's stored working status is saved back unchanged. */
  showWorkingStatus: boolean;
  onSaved?: (ext: MemberExtensions) => void;
}) {
  const user = useUser();
  const loaded = useLoad(async (): Promise<{ options: ProfileOptions; ext: MemberExtensions }> => {
    const [options, ext] = await Promise.all([db.memberProfiles.listOptions(), db.memberProfiles.getExtensions(memberId)]);
    return { options, ext };
  }, [memberId]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [newClass, setNewClass] = useState('');
  const [newYear, setNewYear] = useState(String(new Date().getFullYear()));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'error' | 'info'; text: string } | null>(null);

  useEffect(() => {
    if (loaded.data) setDraft(draftFrom(loaded.data.ext));
  }, [loaded.data]);

  if (loaded.error) return <Notice tone="error">{loaded.error}</Notice>;
  if (!loaded.data || !draft) return <p className="text-sm text-muted">Loading skills and training…</p>;
  const { options } = loaded.data;
  const levelName = new Map(options.skillLevels.map((l) => [l.id, l.SkillLevel]));
  const className = new Map(options.trainingClasses.map((c) => [c.id, c.ClassName]));
  const thisYear = new Date().getFullYear();
  const defaultLevel = options.skillLevels[0]?.id;

  const toggleSkill = (skillId: number, on: boolean) =>
    setDraft((d) => {
      if (!d) return d;
      const skills = new Map(d.skills);
      if (on && defaultLevel !== undefined) skills.set(skillId, skills.get(skillId) ?? defaultLevel);
      else skills.delete(skillId);
      return { ...d, skills };
    });
  const setLevel = (skillId: number, levelId: number) => setDraft((d) => (d ? { ...d, skills: new Map(d.skills).set(skillId, levelId) } : d));

  const addTraining = () => {
    const year = Number(newYear);
    if (newClass === '' || !Number.isInteger(year)) return;
    setDraft((d) => (d ? { ...d, training: [...d.training, { trainingClassId: Number(newClass), year }] } : d));
    setNewClass('');
  };
  const removeTraining = (index: number) => setDraft((d) => (d ? { ...d, training: d.training.filter((_, i) => i !== index) } : d));

  const save = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const ext = await db.memberProfiles.updateExtensions(
        user.memberId,
        memberId,
        [...draft.skills].map(([skillId, skillLevelId]) => ({ skillId, skillLevelId })),
        draft.training,
        showWorkingStatus ? draft.workingStatusId : (loaded.data?.ext.workingStatus?.id ?? null),
      );
      await loaded.reload(); // the effect above resets the draft from what was stored
      setMessage({ tone: 'info', text: 'Skills and training saved.' });
      onSaved?.(ext);
    } catch (err) {
      setMessage({ tone: 'error', text: describeError(err) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      {message ? (
        <Notice tone={message.tone} onDismiss={() => setMessage(null)}>
          {message.text}
        </Notice>
      ) : null}

      {showWorkingStatus ? (
        <Field label="Working status" className="w-64">
          {(id) => (
            <Select
              id={id}
              value={draft.workingStatusId ?? ''}
              onChange={(e) => setDraft({ ...draft, workingStatusId: e.target.value === '' ? null : Number(e.target.value) })}
            >
              <option value="">Not specified</option>
              {options.workingStatuses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.WorkingStatus}
                </option>
              ))}
            </Select>
          )}
        </Field>
      ) : null}

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 font-serif text-base font-bold">Trade skills</legend>
        <p className="text-xs text-muted">Tick each skill and choose how proficient. Council leaders use these to find help for events.</p>
        <ul className="grid grid-cols-1 gap-2 md:grid-cols-2">
          {options.skills.map((skill) => {
            const level = draft.skills.get(skill.id);
            const held = level !== undefined;
            return (
              <li key={skill.id} className={cx('flex items-center gap-3 rounded border px-3 py-2', held ? 'border-gold' : 'border-line')}>
                <label className="flex flex-1 items-center gap-2 text-sm font-bold">
                  <input type="checkbox" checked={held} onChange={(e) => toggleSkill(skill.id, e.target.checked)} />
                  {skill.SkillName}
                </label>
                <Select
                  aria-label={`${skill.SkillName} proficiency`}
                  className="w-36"
                  value={level ?? ''}
                  disabled={!held}
                  onChange={(e) => setLevel(skill.id, Number(e.target.value))}
                >
                  {!held ? <option value="">–</option> : null}
                  {options.skillLevels.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.SkillLevel}
                    </option>
                  ))}
                </Select>
              </li>
            );
          })}
        </ul>
        <p className="text-xs text-muted">
          {draft.skills.size === 0
            ? 'No skills ticked.'
            : `${draft.skills.size} skill${draft.skills.size === 1 ? '' : 's'}: ${[...draft.skills]
                .map(([id, lvl]) => `${options.skills.find((s) => s.id === id)?.SkillName ?? id} (${levelName.get(lvl) ?? ''})`)
                .join(', ')}`}
        </p>
      </fieldset>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-2 font-serif text-base font-bold">Training classes</legend>
        {draft.training.length === 0 ? (
          <Empty>No training recorded yet. Add each class with the year it was completed.</Empty>
        ) : (
          <Table caption="Training classes" head={['Class', 'Year', '']}>
            {draft.training.map((t, i) => (
              <tr key={`${t.trainingClassId}-${t.year}-${i}`}>
                <Td>{className.get(t.trainingClassId) ?? t.trainingClassId}</Td>
                <Td>{t.year}</Td>
                <Td className="text-right">
                  <Button size="sm" variant="secondary" onClick={() => removeTraining(i)}>
                    Remove
                  </Button>
                </Td>
              </tr>
            ))}
          </Table>
        )}
        <div className="flex items-end gap-3">
          <Field label="Class" className="flex-1">
            {(id) => (
              <Select id={id} value={newClass} onChange={(e) => setNewClass(e.target.value)}>
                <option value="">Choose a class</option>
                {options.trainingClasses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.ClassName}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Year completed" className="w-32">
            {(id) => (
              <Input id={id} type="number" min={EARLIEST_TRAINING_YEAR} max={thisYear} value={newYear} onChange={(e) => setNewYear(e.target.value)} />
            )}
          </Field>
          <Button variant="secondary" onClick={addTraining} disabled={newClass === ''}>
            Add class
          </Button>
        </div>
      </fieldset>

      <div className="flex gap-2">
        <Button onClick={() => void save()} disabled={busy}>
          {busy ? 'Saving…' : 'Save skills and training'}
        </Button>
        <Button variant="secondary" onClick={() => setDraft(draftFrom(loaded.data!.ext))} disabled={busy}>
          Undo changes
        </Button>
      </div>
    </div>
  );
}
