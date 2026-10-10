'use client';
// Council Wide Settings (Sprint 7C): the numbers each council sets for itself, which used to be fixed in code - the
// volunteer time limits behind leadership review (volunteer-quarantine.ts) and the window Check for Inactive Members
// uses (member-lifecycle.ts). The council's Admins and officers edit their own council (canEditCouncilWideSettings);
// a Super Admin picks any council. The data service checks the same rule (assertMayEditCouncilWideSettings).
// The universal limits every council shares (recording time, character limits) are on Global System Parameters
// (/system-settings/global-settings, Sprint 7C Extension), for Super Admins.
import { useState } from 'react';
import {
  councilLabel,
  councilWideSettings,
  COUNCIL_WIDE_SETTING_RULES,
  isSuperAdmin,
  sortCouncils,
  type Council,
} from '@kofc/shared';
import { RequireArea } from '@/components/CouncilScope';
import { NumberSettingsForm } from '@/components/SettingsParts';
import { Notice, PageTitle, Panel, Select } from '@/components/ui';
import { useUser } from '@/lib/session';
import { useLoad } from '@/lib/use-load';
import { db } from '@/services/db';

const GUARD_NAMES = ['quarantine_max_daily_activities', 'quarantine_max_single_hours', 'max_shift_padding_hours'] as const;
const ROSTER_NAMES = ['inactivity_threshold_days'] as const;

function SettingsPanels({ council, onSaved }: { council: Council; onSaved: () => Promise<void> }) {
  const user = useUser();
  const values = councilWideSettings(council);
  const save = async (changed: Partial<typeof values>) => {
    const saved = await db.councils.setCouncilWideSettings(user.memberId, council.id, changed);
    await onSaved();
    return `Saved for council ${saved.CouncilNumber}. The new limits apply to the next hours a member logs.`;
  };
  return (
    <>
      <Panel title="Volunteer time limits">
        <div className="flex flex-col gap-3">
          <p className="text-sm text-muted">
            A member&apos;s hours that go past one of these limits wait on the Executive Dashboard for the Grand Knight, Deputy Grand Knight or an Admin
            to approve or reject. Admins, elected officers, Trustees and the event&apos;s owner are never held.
          </p>
          <NumberSettingsForm
            key={`guards-${council.id}-${GUARD_NAMES.map((n) => values[n]).join('-')}`}
            names={GUARD_NAMES}
            rules={COUNCIL_WIDE_SETTING_RULES}
            values={values}
            submitLabel="Save time limits"
            onSave={save}
          />
        </div>
      </Panel>
      <Panel title="Inactive members">
        <div className="flex flex-col gap-3">
          <p className="text-sm text-muted">
            <strong>🔍 Check for Inactive Members</strong> on the member roster marks a plain member Inactive after this many days with no logged service.
            Admins and Super Admins are never marked.
          </p>
          <NumberSettingsForm
            key={`roster-${council.id}-${values.inactivity_threshold_days}`}
            names={ROSTER_NAMES}
            rules={COUNCIL_WIDE_SETTING_RULES}
            values={values}
            submitLabel="Save inactive-member window"
            onSave={save}
          />
        </div>
      </Panel>
    </>
  );
}

function CouncilWideSettings() {
  const user = useUser();
  const councils = useLoad(async () => sortCouncils(await db.councils.list()), []);
  const [councilId, setCouncilId] = useState(user.councilId);
  const list = isSuperAdmin(user) ? (councils.data ?? []) : (councils.data ?? []).filter((c) => c.id === user.councilId);
  const council = list.find((c) => c.id === councilId) ?? list[0];

  return (
    <>
      <PageTitle
        actions={
          isSuperAdmin(user) && list.length > 1 && council ? (
            <label className="flex flex-col gap-1">
              <span className="text-sm uppercase tracking-wide text-muted">Council</span>
              <Select value={council.id} onChange={(e) => setCouncilId(Number(e.target.value))}>
                {list.map((c) => (
                  <option key={c.id} value={c.id}>
                    {councilLabel(c)}
                  </option>
                ))}
              </Select>
            </label>
          ) : null
        }
      >
        Council Wide Settings
      </PageTitle>
      {councils.error ? <Notice tone="error">{councils.error}</Notice> : null}
      {councils.loading && !councils.data ? (
        <p className="text-sm text-muted">Loading council settings…</p>
      ) : council ? (
        <SettingsPanels council={council} onSaved={councils.reload} />
      ) : (
        <Notice tone="info">No council found.</Notice>
      )}
    </>
  );
}

export default function CouncilSettingsPage() {
  return (
    <RequireArea area="setup/council-settings">
      <CouncilWideSettings />
    </RequireArea>
  );
}
