'use client';
// Supreme Council Compliance Center (Sprint 5T): council leadership (Admins, Financial Secretary, Treasurer, any Super
// Admin) picks Form 1728 or Form 1295 and a completed reporting period, audits the figures the council's own ledgers
// produce (supreme.previewReport), then transmits them to Supreme's Alchemer survey (supreme.syncAlchemerReport).
// The post goes through the portal's server route, which holds the Alchemer credentials (services/alchemer-transport).
// Every attempt, successful or failed, lands on the sync history timeline (supreme.listSyncHistory).
// Sprint 6B Patch: the council's Admins (and Super Admins) also bring in Supreme Headquarters' roster export here
// (RosterImport, supreme.syncSupremeRoster): new members are added with their join date and sent the welcome email with
// the Expo Go steps and a one-time setup code; members already on the roster have their join date brought in line.
import { useState } from 'react';
import {
  alchemerAnswers,
  canAdministerCouncil,
  canSyncSupremeReports,
  describeError,
  formatTimestamp,
  parseSupremeRosterCsv,
  SUPREME_FORM_LABELS,
  SUPREME_FORM_TYPES,
  supremePeriodOptions,
  type SupremeComplianceSnapshot,
  type SupremeFormType,
  type SupremeRosterRow,
  type SupremeRosterSyncResult,
  type SupremeSyncHistoryEntry,
} from '@kofc/shared';
import { CouncilSelect, RequireArea, useCouncilScope } from '@/components/CouncilScope';
import { Button, cx, Empty, Field, Input, NewMemberBadge, Notice, PageTitle, Panel, Pill, Select, Table, Tabs, Td, Textarea } from '@/components/ui';
import { formatDecimalHours, formatMoney } from '@/lib/format';
import { useUser } from '@/lib/session';
import { useLoad } from '@/lib/use-load';
import { db } from '@/services/db';
import { readRosterOnServer } from '@/services/roster-transport';

const FORM_TABS = SUPREME_FORM_TYPES.map((id) => ({ id, label: `${SUPREME_FORM_LABELS[id].form} · ${SUPREME_FORM_LABELS[id].title}` }));

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border-t-4 border-gold bg-white px-3 py-2 ring-1 ring-line">
      <p className="text-xs font-bold uppercase tracking-wide text-muted">{label}</p>
      <p className="font-serif text-2xl font-bold">{value}</p>
    </div>
  );
}

/** The on-screen audit: the snapshot's figures, then exactly the answers the transmit button would file. */
function ComplianceAudit({ snapshot }: { snapshot: SupremeComplianceSnapshot }) {
  const { volunteerHours, donations, expenseChecks } = snapshot;
  const share = (hours: number) => (volunteerHours.total > 0 ? `${Math.round((hours / volunteerHours.total) * 100)}%` : '–');
  const answers = Object.entries(alchemerAnswers(snapshot));
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Volunteer hours" value={formatDecimalHours(volunteerHours.total)} />
        <Stat label="Volunteers" value={String(snapshot.volunteers)} />
        <Stat label="Events held" value={String(snapshot.eventsHeld)} />
        <Stat label="Funds raised" value={formatMoney(donations.raised)} />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Table caption="Volunteer hours by category" head={['Category', 'Hours', 'Share']}>
          {snapshot.hoursByCategory.length === 0 ? (
            <tr>
              <Td colSpan={3} className="text-muted">
                No hours were logged in this period.
              </Td>
            </tr>
          ) : (
            snapshot.hoursByCategory.map((row) => (
              <tr key={row.category}>
                <Td>{row.category}</Td>
                <Td>{formatDecimalHours(row.hours)}</Td>
                <Td>{share(row.hours)}</Td>
              </tr>
            ))
          )}
          <tr className="font-bold">
            <Td>Event shifts / standalone activities</Td>
            <Td>
              {formatDecimalHours(volunteerHours.events)} / {formatDecimalHours(volunteerHours.activities)}
            </Td>
            <Td>{formatDecimalHours(volunteerHours.total)} total</Td>
          </tr>
        </Table>

        <Table caption="Financial figures" head={['Ledger line', 'Amount']}>
          <tr>
            <Td>Cash receipts</Td>
            <Td>{formatMoney(donations.cash)}</Td>
          </tr>
          <tr>
            <Td>Electronic receipts (card and QR)</Td>
            <Td>{formatMoney(donations.electronic)}</Td>
          </tr>
          <tr className="font-bold">
            <Td>Total raised ({donations.count} donations)</Td>
            <Td>{formatMoney(donations.raised)}</Td>
          </tr>
          <tr>
            <Td>Donated items (estimated value, not funds)</Td>
            <Td>{formatMoney(donations.itemValue)}</Td>
          </tr>
          <tr>
            <Td>Event spend</Td>
            <Td>{formatMoney(snapshot.eventSpend)}</Td>
          </tr>
          <tr>
            <Td>Expense checks paid ({expenseChecks.count})</Td>
            <Td>{formatMoney(expenseChecks.total)}</Td>
          </tr>
        </Table>
      </div>

      <Table caption="Answers to transmit" head={['Alchemer question shortname', 'Answer filed']}>
        {answers.map(([key, value]) => (
          <tr key={key}>
            <Td className="text-xs font-bold">{key}</Td>
            <Td>{String(value)}</Td>
          </tr>
        ))}
      </Table>
    </div>
  );
}

/** Past attempts as a vertical timeline: a gold dot for Success, a red one for Failed. */
function SyncTimeline({ entries }: { entries: SupremeSyncHistoryEntry[] }) {
  if (entries.length === 0) return <Empty>No report has been transmitted for this council yet.</Empty>;
  return (
    <ol className="relative flex flex-col gap-4 border-l-2 border-line pl-6" aria-label="Sync history">
      {entries.map(({ sync, syncedByName }) => {
        const ok = sync.Status === 'Success';
        return (
          <li key={sync.id} className="relative">
            <span aria-hidden="true" className={cx('absolute -left-[1.95rem] top-1 h-4 w-4 rounded-full border-2 border-white ring-2', ok ? 'bg-gold ring-gold' : 'bg-brand-red ring-brand-red')} />
            <p className="flex flex-wrap items-center gap-2 text-sm">
              <span className="font-bold">{SUPREME_FORM_LABELS[sync.FormType].form}</span>
              <Pill tone={ok ? 'gold' : 'red'}>{sync.Status}</Pill>
            </p>
            <p className="text-xs text-muted">
              {formatTimestamp(sync.SyncDate)} · survey {sync.AlchemerSurveyID} · by {syncedByName}
            </p>
          </li>
        );
      })}
    </ol>
  );
}

/** Supreme Headquarters' roster export, brought into the council's Member table (supreme.syncSupremeRoster). */
function RosterImport({ councilId }: { councilId: number }) {
  const user = useUser();
  const [csv, setCsv] = useState('');
  const [rows, setRows] = useState<SupremeRosterRow[] | null>(null);
  const [result, setResult] = useState<SupremeRosterSyncResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const read = (text: string) => {
    setCsv(text);
    setResult(null);
    setError(null);
    try {
      setRows(text.trim() === '' ? null : parseSupremeRosterCsv(text));
    } catch (err) {
      setRows(null);
      setError(describeError(err));
    }
  };
  const sync = async () => {
    if (!rows) return;
    setBusy(true);
    setError(null);
    try {
      // The preview above is read in the browser; the rows synced are the server's reading (Sprint 6Z-Engine-Upgrade).
      setResult(await db.supreme.syncSupremeRoster(user.memberId, councilId, await readRosterOnServer(councilId, csv)));
    } catch (err) {
      setError(describeError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Panel title="Supreme roster sync - new member onboarding">
      <div className="flex flex-col gap-3">
        <p className="text-sm">
          Load Supreme Headquarters&apos; roster export (CSV: Member Number, First Name, Last Name, Email, Phone, Street, Street 2, City, State, Zip,
          Birth Date, Degree, Date Joined). New members are added with their join date and wear the [🆕 New Member] badge for 180 days; each is sent
          the welcome email with the Expo Go download steps and a one-time setup code the moment the roster is stored.
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <Field label="Roster file">
            {(id) => (
              <input
                id={id}
                type="file"
                accept=".csv,text/csv"
                className="text-sm"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void file.text().then(read);
                }}
              />
            )}
          </Field>
        </div>
        <Field label="…or paste the export">
          {(id) => <Textarea id={id} value={csv} onChange={(e) => read(e.target.value)} rows={5} placeholder="Member Number,First Name,Last Name,Email,..." />}
        </Field>
        {error ? (
          <Notice tone="error" onDismiss={() => setError(null)}>
            {error}
          </Notice>
        ) : null}
        <Button variant="gold" disabled={busy || !rows || rows.length === 0} onClick={() => void sync()} className="self-start">
          {busy ? 'Syncing…' : rows ? `Sync ${rows.length} roster row${rows.length === 1 ? '' : 's'} from Supreme` : 'Sync roster from Supreme'}
        </Button>
        {result ? (
          <div className="flex flex-col gap-2" aria-live="polite">
            <Notice tone="info">
              {result.created.length} new member{result.created.length === 1 ? '' : 's'} added and welcomed, {result.updated.length} join date
              {result.updated.length === 1 ? '' : 's'} updated, {result.skipped.length} row{result.skipped.length === 1 ? '' : 's'} skipped.
            </Notice>
            {result.created.length ? (
              <ul className="flex flex-col gap-1 text-sm">
                {result.created.map((m) => (
                  <li key={m.id}>
                    <strong>
                      {m.MemberLastName}, {m.MemberFirstName}
                    </strong>{' '}
                    #{m.MemberNumber} · joined {m.DateJoinedCouncil}
                    <NewMemberBadge member={m} />
                  </li>
                ))}
              </ul>
            ) : null}
            {result.skipped.length ? (
              <ul className="flex flex-col gap-1 text-sm">
                {result.skipped.map((s, i) => (
                  <li key={i} className="text-brand-red">
                    {s.memberNumber !== null ? `#${s.memberNumber}: ` : ''}
                    {s.reason}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </div>
    </Panel>
  );
}

function ComplianceCenter() {
  const user = useUser();
  const scope = useCouncilScope();
  const councilId = scope.councilId;
  const [form, setForm] = useState<SupremeFormType>('AnnualSurvey');
  const [periodIndex, setPeriodIndex] = useState(0);
  const [surveyId, setSurveyId] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'error' | 'info'; text: string } | null>(null);
  const allowed = canSyncSupremeReports(user, councilId);

  const periods = supremePeriodOptions(form, new Date());
  const picked = periods[periodIndex] ?? periods[0];
  const preview = useLoad(
    () => (allowed ? db.supreme.previewReport(user.memberId, councilId, form, picked.choice) : Promise.resolve(null)),
    [allowed, user.memberId, councilId, form, picked.period.fromDate],
  );
  const history = useLoad(() => (allowed ? db.supreme.listSyncHistory(user.memberId, councilId) : Promise.resolve([])), [allowed, user.memberId, councilId]);

  const transmit = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const result = await db.supreme.syncAlchemerReport(user.memberId, councilId, form, surveyId, picked.choice);
      setMessage(
        result.sync.Status === 'Success'
          ? { tone: 'info', text: `${SUPREME_FORM_LABELS[form].form} for ${picked.period.label} was filed to Alchemer survey ${result.sync.AlchemerSurveyID}.` }
          : { tone: 'error', text: `The transmission failed and was logged: ${result.error ?? 'no reason given'}` },
      );
    } catch (err) {
      setMessage({ tone: 'error', text: describeError(err) });
    } finally {
      setBusy(false);
      await history.reload();
    }
  };

  return (
    <>
      <PageTitle>Supreme Council Compliance Center</PageTitle>
      <div className="mb-4">
        <CouncilSelect scope={scope} />
      </div>
      {!allowed ? (
        <Notice tone="error">Only this council&apos;s Admins, Financial Secretary and Treasurer, or a Super Admin, file its Supreme reports.</Notice>
      ) : (
        <div className="flex flex-col gap-4">
          <Tabs
            tabs={FORM_TABS}
            value={form}
            onChange={(id) => {
              setForm(id);
              setPeriodIndex(0);
              setMessage(null);
            }}
            label="Supreme form"
            idPrefix="supreme-form"
          />
          <div id="supreme-form-panel" role="tabpanel" aria-labelledby={`supreme-form-tab-${form}`} className="flex flex-col gap-4">
            <Field
              label="Reporting period"
              hint={form === 'AnnualSurvey' ? 'Form 1728 covers a calendar year.' : 'Form 1295 covers a half-year, January-June or July-December.'}
              className="w-72"
            >
              {(id) => (
                <Select id={id} value={periodIndex} onChange={(e) => setPeriodIndex(Number(e.target.value))}>
                  {periods.map((p, i) => (
                    <option key={p.period.fromDate} value={i}>
                      {p.period.label} ({p.period.fromDate} to {p.period.toDate})
                    </option>
                  ))}
                </Select>
              )}
            </Field>

            <Panel title="Simulate and Audit Compliance Report">
              {preview.error ? <Notice tone="error">{preview.error}</Notice> : null}
              {preview.data ? <ComplianceAudit snapshot={preview.data} /> : <p className="text-sm text-muted">Compiling the council&apos;s figures…</p>}
            </Panel>

            <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_24rem]">
              <Panel title="Transmit to Supreme">
                <div className="flex flex-col gap-3">
                  <Field label="Alchemer survey id" hint="The number Supreme gives for this form's survey, e.g. 7654321.">
                    {(id) => <Input id={id} inputMode="numeric" value={surveyId} onChange={(e) => setSurveyId(e.target.value.replace(/\D/g, ''))} maxLength={100} />}
                  </Field>
                  {message ? (
                    <Notice tone={message.tone} onDismiss={() => setMessage(null)}>
                      {message.text}
                    </Notice>
                  ) : null}
                  <Button onClick={() => void transmit()} disabled={busy || surveyId === '' || !preview.data} className="w-full py-4 text-lg shadow-lg">
                    {busy ? 'Transmitting…' : 'Transmit Report to Supreme via Alchemer API'}
                  </Button>
                  <p className="text-xs text-muted">
                    Files the audited figures above for {picked.period.label}. The Alchemer credentials stay on the portal&apos;s server and never
                    reach this browser.
                  </p>
                </div>
              </Panel>
              <Panel title="Sync history">
                {history.error ? <Notice tone="error">{history.error}</Notice> : null}
                {history.data ? <SyncTimeline entries={history.data} /> : null}
              </Panel>
            </div>
            {canAdministerCouncil(user, councilId) ? <RosterImport councilId={councilId} /> : null}
          </div>
        </div>
      )}
    </>
  );
}

export default function SupremeSyncPage() {
  return (
    <RequireArea area="supreme-sync">
      <ComplianceCenter />
    </RequireArea>
  );
}
