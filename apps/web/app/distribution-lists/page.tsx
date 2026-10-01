'use client';
// My Distribution Lists (Sprint 5Z-10.8; the header's Messaging menu): named lists of the council's members. Every member
// builds private segments for their own use, seen and changed by them alone; the council-wide lists for council blasts
// (Specifications: "Allow creation of distribution lists by admin or super admin") are shown to everyone but kept by
// the council's Admins and Super Admins. Only they see the Reach control that makes a list council-wide
// (canPublishDistributionList); anyone else's new lists are private, and the drivers enforce the same
// (assertMayCreateDistributionList, assertMayChangeDistributionList). The form carries a searchable, multi-select member
// picker. Deleting a list removes its member entries with it; messages already sent keep their read receipts.
import { useState } from 'react';
import {
  canEditDistributionList,
  canPublishDistributionList,
  isCouncilWideList,
  listScopeLabel,
  type DistributionListSummary,
  type Member,
} from '@kofc/shared';
import { CouncilSelect, RequireArea, useCouncilScope } from '@/components/CouncilScope';
import { RecordGrid, type Draft, type Selection } from '@/components/RecordGrid';
import { Button, cx, Input, Notice, PageTitle, Pill } from '@/components/ui';
import { formatPersonName } from '@/lib/format';
import { useUser } from '@/lib/session';
import { useLoad } from '@/lib/use-load';
import { db } from '@/services/db';

/** The grid works on rows with an id; a list summary carries its row's id alongside. */
type ListRow = DistributionListSummary & { id: number };

// The picker stores the chosen ids in the form draft as comma-separated text.
const parseIds = (text: string): number[] => text.split(',').filter(Boolean).map(Number);
const joinIds = (ids: Iterable<number>): string => [...ids].sort((a, b) => a - b).join(',');

function MemberPicker({ members, value, onChange, disabled }: { members: Member[]; value: string; onChange: (v: string) => void; disabled: boolean }) {
  const [query, setQuery] = useState('');
  const chosen = new Set(parseIds(value));
  const q = query.trim().toLowerCase();
  const shown = members.filter((m) => !q || `${m.MemberFirstName} ${m.MemberLastName} ${m.Email}`.toLowerCase().includes(q));
  const toggle = (id: number) => {
    const next = new Set(chosen);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange(joinIds(next));
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <Input type="search" aria-label="Filter members" placeholder="Filter by name or email" value={query} onChange={(e) => setQuery(e.target.value)} />
        <Button size="sm" variant="secondary" disabled={disabled} onClick={() => onChange(joinIds(new Set([...chosen, ...shown.map((m) => m.id)])))}>
          Add shown
        </Button>
        <Button size="sm" variant="secondary" disabled={disabled || chosen.size === 0} onClick={() => onChange('')}>
          Clear
        </Button>
      </div>
      <p className="text-xs text-muted">
        {chosen.size} of {members.length} members selected
      </p>
      <ul className="max-h-72 overflow-y-auto rounded border border-line" aria-label="Council members">
        {shown.map((m) => (
          <li key={m.id} className={cx('border-b border-line px-3 py-1 last:border-b-0', chosen.has(m.id) && 'bg-white font-bold')}>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={chosen.has(m.id)} disabled={disabled} onChange={() => toggle(m.id)} />
              <span className="flex-1">{formatPersonName(m.MemberFirstName, m.MemberLastName)}</span>
              <span className="text-xs text-muted">{m.Email}</span>
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}

function DistributionLists() {
  const user = useUser();
  const scope = useCouncilScope();
  const lists = useLoad(
    async () => (await db.distributionLists.listForMember(user.memberId, scope.councilId)).map((s): ListRow => ({ ...s, id: s.list.id })),
    [user.memberId, scope.councilId],
  );
  const members = useLoad(() => db.members.listByCouncil(scope.councilId), [scope.councilId]);
  const [selected, setSelected] = useState<Selection>(null);
  // The council-wide switch exists only for the council's Admins and Super Admins; everyone else builds private lists.
  const canPublish = canPublishDistributionList(user, scope.councilId);
  const memberName = new Map((members.data ?? []).map((m) => [m.id, formatPersonName(m.MemberFirstName, m.MemberLastName)]));

  const save = async (d: Draft, row: ListRow | null): Promise<ListRow> => {
    const memberIds = parseIds(d.memberIds);
    // Without publishing rights the reach is never sent: new lists are private and existing ones keep theirs.
    const reach = canPublish ? { IsCouncilWide: d.reach === 'council' } : {};
    const saved = row
      ? await db.distributionLists.update(user.memberId, row.id, { ListName: d.ListName, memberIds, ...reach })
      : await db.distributionLists.create(user.memberId, { ListName: d.ListName, CouncilID: scope.councilId, memberIds, ...reach });
    await lists.reload();
    return { ...saved, id: saved.list.id };
  };

  return (
    <>
      <PageTitle actions={<CouncilSelect scope={scope} />}>My Distribution Lists</PageTitle>
      <div className="mb-4">
        <Notice tone="info">
          {canPublish
            ? 'Private lists are yours alone. Set Reach to Council-wide to share a list with the whole council for council blasts.'
            : 'Lists you build here are private: only you can see or change them. Council-wide lists are kept by the council\x27s Admins.'}
        </Notice>
      </div>
      <RecordGrid
        key={scope.councilId}
        noun="list"
        title="Distribution lists"
        rows={lists.data}
        error={lists.error ?? members.error}
        canEdit
        canEditRow={(r) => canEditDistributionList(user, r.list)}
        columns={[
          { label: 'List', render: (r) => r.list.ListName ?? '(unnamed)' },
          {
            label: 'Reach',
            render: (r) => <Pill tone={isCouncilWideList(r.list) ? 'navy' : 'outline'}>{listScopeLabel(isCouncilWideList(r.list))}</Pill>,
          },
          { label: 'Members', render: (r) => r.memberIds.length, className: 'text-right' },
          {
            label: 'Recipients',
            render: (r) => {
              const names = r.memberIds.map((id) => memberName.get(id) ?? `#${id}`);
              return names.length > 3 ? `${names.slice(0, 3).join('; ')} +${names.length - 3} more` : names.join('; ') || '–';
            },
            className: 'text-xs',
          },
          { label: 'Created', render: (r) => (r.list.CreatedAt ?? '').slice(0, 10) || '–', className: 'whitespace-nowrap text-xs' },
        ]}
        fields={[
          { key: 'ListName', label: 'List name', maxLength: 100, wide: true },
          // Sprint 5Z-10.8 safety lock: the council-wide option is not rendered for anyone without publishing rights.
          ...(canPublish
            ? [
                {
                  key: 'reach',
                  label: 'Reach',
                  options: [
                    { value: 'private', label: 'Private (only me)' },
                    { value: 'council', label: 'Council-wide (public to the council)' },
                  ],
                },
              ]
            : []),
          {
            key: 'memberIds',
            label: 'Members',
            wide: true,
            render: (value, set, disabled) => <MemberPicker members={members.data ?? []} value={value} onChange={set} disabled={disabled} />,
          },
        ]}
        blank={() => ({ ListName: '', memberIds: '', reach: 'private' })}
        toDraft={(r) => ({ ListName: r.list.ListName ?? '', memberIds: joinIds(r.memberIds), reach: isCouncilWideList(r.list) ? 'council' : 'private' })}
        rowLabel={(r) => r.list.ListName ?? 'Distribution list'}
        matches={(r, q) => (r.list.ListName ?? '').toLowerCase().includes(q)}
        onSave={save}
        onRemove={async (r) => {
          await db.distributionLists.remove(user.memberId, r.id);
          await lists.reload();
        }}
        selected={selected}
        onSelect={setSelected}
      />
    </>
  );
}

export default function DistributionListsPage() {
  return (
    <RequireArea area="distribution-lists">
      <DistributionLists />
    </RequireArea>
  );
}
