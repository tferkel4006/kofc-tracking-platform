'use client';
// Annual Budget Forecast Center (Sprint 5Y): council leadership - its Admins, Financial Secretary and Treasurer, or a
// Super Admin (canManageBudgetForecast; the drivers: assertMayManageBudgetForecast) - drafts the next fraternal year's
// budget each June. "Initialize Automated Prior Year Baseline Rollup" runs budget.prePopulateNextYear, which seeds the
// year's lines from last year's actual spend on annual events, annual charities and meetings, and carries last year's
// custom lines forward. The lines are grouped into the council's six funds (budgetFundOf); approved amounts and notes
// save on blur (budget.updateLineItemBudget). Inputs open only in the June drafting window and lock as Finalized on
// July 1 (budgetWindowOf). A Super Admin on the in-memory mock may tick "Simulate June Drafting Window" for demos.
import { useEffect, useMemo, useState } from 'react';
import {
  BUDGET_LINE_NAME_MAX_LENGTH,
  BUDGET_NOTES_MAX_LENGTH,
  budgetWindowOf,
  canManageBudgetForecast,
  describeError,
  groupBudgetByFund,
  isSuperAdmin,
  sumBudgetAmounts,
  upcomingFraternalYear,
  type BudgetLineSource,
  type BudgetPrePopulationResult,
  type BudgetWindowState,
  type CouncilBudgetForecast,
} from '@kofc/shared';
import { CouncilSelect, RequireArea, useCouncilScope } from '@/components/CouncilScope';
import { Drawer } from '@/components/Drawer';
import { Button, Empty, Field, Input, Notice, PageTitle, Pill, Select, Table, Td, Textarea } from '@/components/ui';
import { formatMoney, parseNumberField } from '@/lib/format';
import { useUser } from '@/lib/session';
import { useLoad } from '@/lib/use-load';
import { DATA_DRIVER, db } from '@/services/db';

const shiftYear = (fraternalYear: string, by: number) => {
  const start = Number(fraternalYear.slice(0, 4)) + by;
  return `${start}-${start + 1}`;
};

const WINDOW_TONE: Record<BudgetWindowState, 'gold' | 'navy' | 'outline'> = { Draft: 'gold', Finalized: 'navy', 'Not Yet Open': 'outline' };

function windowExplanation(state: BudgetWindowState, year: string, simulated: boolean): string {
  const start = year.slice(0, 4);
  if (simulated) return `Simulated drafting window: inputs are unlocked for this demo. Real budgets for ${year} are drafted in June ${start}.`;
  if (state === 'Draft') return `The ${year} budget is open for drafting until it locks as Finalized on July 1, ${start}.`;
  if (state === 'Finalized') return `The ${year} budget was locked as Finalized on July 1, ${start}. Figures are read-only.`;
  return `The ${year} budget opens for drafting on June 1, ${start}. Figures are read-only until then.`;
}

/** Scorecard tile. */
function Scorecard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded border-2 border-navy border-t-8 border-t-gold bg-white p-3">
      <p className="text-xs font-bold uppercase tracking-wide">{label}</p>
      <p className="font-serif text-2xl font-bold">{value}</p>
      <p className="text-xs text-muted">{detail}</p>
    </div>
  );
}

type SaveState = { kind: 'idle' } | { kind: 'saving' } | { kind: 'saved' } | { kind: 'error'; message: string };

/** One spreadsheet row: the approved amount and notes save when their box loses focus, if they changed. */
function BudgetRow({ line, editable, actorId, onSaved }: { line: CouncilBudgetForecast; editable: boolean; actorId: number; onSaved: (line: CouncilBudgetForecast) => void }) {
  const [amount, setAmount] = useState(String(line.ApprovedBudgetAmount));
  const [notes, setNotes] = useState(line.Notes ?? '');
  const [state, setState] = useState<SaveState>({ kind: 'idle' });
  useEffect(() => {
    setAmount(String(line.ApprovedBudgetAmount));
    setNotes(line.Notes ?? '');
  }, [line.ApprovedBudgetAmount, line.Notes]);

  const save = async () => {
    const trimmedNotes = notes.trim();
    try {
      const value = parseNumberField(amount, 'Approved budget amount') ?? 0;
      if (value === line.ApprovedBudgetAmount && trimmedNotes === (line.Notes ?? '')) return;
      setState({ kind: 'saving' });
      const saved = await db.budget.updateLineItemBudget(actorId, line.id, value, trimmedNotes === '' ? null : trimmedNotes);
      setState({ kind: 'saved' });
      onSaved(saved);
    } catch (err) {
      setState({ kind: 'error', message: describeError(err) });
    }
  };

  return (
    <tr>
      <Td>
        <span className="font-bold">{line.LineItemName}</span>
        <span className="ml-2">
          <Pill tone="outline">{line.CategoryType}</Pill>
        </span>
      </Td>
      <Td className="whitespace-nowrap text-right">{formatMoney(line.PrePopulatedAmount)}</Td>
      <Td className="w-40">
        {editable ? (
          <Input
            aria-label={`Approved budget for ${line.LineItemName}`}
            inputMode="decimal"
            className="w-full text-right"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            onBlur={() => void save()}
          />
        ) : (
          <span className="block text-right font-bold">{formatMoney(line.ApprovedBudgetAmount)}</span>
        )}
      </Td>
      <Td>
        {editable ? (
          <Input
            aria-label={`Notes for ${line.LineItemName}`}
            maxLength={BUDGET_NOTES_MAX_LENGTH}
            className="w-full"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={() => void save()}
            placeholder="Reviewer notes"
          />
        ) : (
          <span className="text-sm">{line.Notes ?? ''}</span>
        )}
      </Td>
      <Td className="w-24 text-xs">
        {state.kind === 'saving' ? <span className="text-muted">Saving…</span> : null}
        {state.kind === 'saved' ? <span className="font-bold">Saved</span> : null}
        {state.kind === 'error' ? (
          <span role="alert" className="font-bold text-brand-red" title={state.message}>
            Not saved: {state.message}
          </span>
        ) : null}
      </Td>
    </tr>
  );
}

/** "Add Custom Council Operational Line": a name and a target figure, added with budget.addCustomBudgetLine. */
function CustomLineDrawer({ actorId, councilId, year, onClose, onAdded }: { actorId: number; councilId: number; year: string; onClose: () => void; onAdded: (line: CouncilBudgetForecast) => void }) {
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const add = async () => {
    setBusy(true);
    setError(null);
    try {
      const line = await db.budget.addCustomBudgetLine(actorId, councilId, {
        FraternalYear: year,
        LineItemName: name,
        ApprovedBudgetAmount: parseNumberField(amount, 'Target budget amount'),
        Notes: notes.trim() || null,
      });
      onAdded(line);
    } catch (err) {
      setError(describeError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Drawer title="Add Custom Council Operational Line" onClose={onClose}>
      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          void add();
        }}
      >
        <p className="text-sm">
          A running cost of the council that is not an annual event or charity, such as bank fees or bulletin ads. It is added to the {year} budget under Council Maintenance &amp; State/Supreme Programs,
          and carried into the next year&apos;s rollup.
        </p>
        {error ? (
          <Notice tone="error" onDismiss={() => setError(null)}>
            {error}
          </Notice>
        ) : null}
        <Field label="Line item name">
          {(id) => <Input id={id} required maxLength={BUDGET_LINE_NAME_MAX_LENGTH} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Bank Fees" />}
        </Field>
        <Field label="Target budget amount ($)" hint="Recorded as the approved budget; custom lines have no prior-year baseline.">
          {(id) => <Input id={id} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />}
        </Field>
        <Field label="Notes (optional)">
          {(id) => <Textarea id={id} maxLength={BUDGET_NOTES_MAX_LENGTH} value={notes} onChange={(e) => setNotes(e.target.value)} />}
        </Field>
        <Button type="submit" disabled={busy || name.trim() === ''}>
          {busy ? 'Adding…' : 'Add line'}
        </Button>
      </form>
    </Drawer>
  );
}

function BudgetCenter() {
  const user = useUser();
  const scope = useCouncilScope();
  const councilId = scope.councilId;
  const today = useMemo(() => new Date(), []);
  const upcoming = upcomingFraternalYear(today);
  const [year, setYear] = useState(upcoming);
  const [simulate, setSimulate] = useState(false);
  const [adding, setAdding] = useState(false);
  const [rolling, setRolling] = useState(false);
  const [rollup, setRollup] = useState<BudgetPrePopulationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canManage = canManageBudgetForecast(user, councilId);
  // Demo-only override: a Super Admin on the in-memory mock may force the drafting window open.
  const maySimulate = isSuperAdmin(user) && DATA_DRIVER === 'memory';
  const simulated = maySimulate && simulate;
  const windowState: BudgetWindowState = simulated ? 'Draft' : budgetWindowOf(year, today);
  const editable = canManage && windowState === 'Draft';

  const forecast = useLoad(
    () => (canManage ? db.budget.listAnnualForecast(user.memberId, councilId, year) : Promise.resolve([])),
    [user.memberId, councilId, year, canManage],
  );
  const sources = useLoad(async () => {
    if (!canManage) return { events: new Map<number, string>(), charities: new Map<number, string>() };
    const [events, categories, ledger] = await Promise.all([
      db.events.listByCouncil(councilId),
      db.lookups.list('Category'),
      db.charities.listCouncilLedger(user.memberId, councilId),
    ]);
    const categoryName = new Map(categories.map((c) => [c.id, c.Category]));
    return {
      events: new Map(events.map((e) => [e.id, categoryName.get(e.CategoryID) ?? ''])),
      charities: new Map(ledger.map((entry) => [entry.charity.id, entry.charity.CharityType])),
    };
  }, [user.memberId, councilId, canManage]);
  useEffect(() => {
    setRollup(null);
    setError(null);
  }, [councilId, year]);

  const lines = forecast.data ?? [];
  const sourceOf = (line: CouncilBudgetForecast): BudgetLineSource => {
    const id = line.ReferenceSourceID;
    if (id == null) return {};
    if (line.CategoryType === 'Event') return { eventCategory: sources.data?.events.get(id) };
    return { charityType: sources.data?.charities.get(id) };
  };
  const funds = groupBudgetByFund(lines, sourceOf);
  const baselineTotal = sumBudgetAmounts(lines.map((l) => l.PrePopulatedAmount));
  const approvedTotal = sumBudgetAmounts(lines.map((l) => l.ApprovedBudgetAmount));
  const change = Math.round((approvedTotal - baselineTotal) * 100) / 100;

  const runRollup = async () => {
    setRolling(true);
    setError(null);
    try {
      const result = await db.budget.prePopulateNextYear(user.memberId, councilId, year);
      setRollup(result);
      await forecast.reload();
    } catch (err) {
      setError(describeError(err));
    } finally {
      setRolling(false);
    }
  };

  const yearOptions = [shiftYear(upcoming, 1), upcoming, shiftYear(upcoming, -1), shiftYear(upcoming, -2)];

  return (
    <>
      <PageTitle actions={<CouncilSelect scope={scope} />}>Annual Budget Forecast Center</PageTitle>
      {!canManage ? (
        <Notice tone="error">Only this council&apos;s Admins, Financial Secretary and Treasurer, or a Super Admin, may view and prepare its budget.</Notice>
      ) : (
        <div className="flex flex-col gap-4">
          <section aria-label="Budget year" className="flex flex-wrap items-end gap-4 rounded border border-line bg-white p-4">
            <Field label="Fraternal year">
              {(id) => (
                <Select id={id} value={year} onChange={(e) => setYear(e.target.value)}>
                  {yearOptions.map((y) => (
                    <option key={y} value={y}>
                      {y}
                      {y === upcoming ? ' (next to prepare)' : ''}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Button
              className="px-6 py-3 text-base shadow"
              disabled={!editable || rolling}
              onClick={() => void runRollup()}
              title={editable ? `Seed ${year} from ${shiftYear(year, -1)} actual spend` : 'Available only while the budget is open for drafting'}
            >
              {rolling ? 'Sweeping prior year actuals…' : 'Initialize Automated Prior Year Baseline Rollup'}
            </Button>
            <div className="flex flex-col gap-1">
              <span className="text-xs font-bold uppercase tracking-wide">Budget window</span>
              <Pill tone={WINDOW_TONE[windowState]}>{simulated ? 'Draft (simulated)' : windowState}</Pill>
            </div>
            {maySimulate ? (
              <label className="ml-auto flex items-center gap-2 rounded border-2 border-dashed border-brand-red px-3 py-2 text-sm font-bold text-brand-red">
                <input type="checkbox" className="size-4" checked={simulate} onChange={(e) => setSimulate(e.target.checked)} />
                Simulate June Drafting Window
                <span className="text-xs font-normal">(demo only · in-memory data)</span>
              </label>
            ) : null}
            <p className="basis-full text-sm text-muted">{windowExplanation(windowState, year, simulated)}</p>
          </section>

          {error ? (
            <Notice tone="error" onDismiss={() => setError(null)}>
              {error}
            </Notice>
          ) : null}
          {forecast.error ?? sources.error ? <Notice tone="error">{forecast.error ?? sources.error}</Notice> : null}
          {rollup ? (
            <Notice tone="info" onDismiss={() => setRollup(null)}>
              Rollup complete from {rollup.sourceFraternalYear} actual spend: {rollup.created} new line{rollup.created === 1 ? '' : 's'}, {rollup.refreshed} refreshed. Approved amounts were left for
              your review.
            </Notice>
          ) : null}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Scorecard label="Pre-populated baseline" value={formatMoney(baselineTotal)} detail={`${shiftYear(year, -1)} actual spend across ${lines.length} lines`} />
            <Scorecard label="Approved budget" value={formatMoney(approvedTotal)} detail={`${year} total across the six funds`} />
            <Scorecard label="Change from baseline" value={`${change > 0 ? '+' : ''}${formatMoney(change)}`} detail={change > 0 ? 'Planned increase over last year' : change < 0 ? 'Planned reduction from last year' : 'Level with last year'} />
          </div>

          <section aria-label="Budget spreadsheet" className="rounded border border-line bg-white">
            <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-2">
              <h2 className="font-serif text-lg font-bold">Annual Budget Projections · {year}</h2>
              <Button variant="secondary" className="border-gold" disabled={!editable} onClick={() => setAdding(true)}>
                + Add Custom Council Operational Line
              </Button>
            </header>
            <div className="flex flex-col gap-6 p-4">
              {forecast.loading && !forecast.data ? (
                <p className="text-sm text-muted">Loading…</p>
              ) : lines.length === 0 ? (
                <Empty>
                  No budget lines for {year} yet. {editable ? 'Run the prior year baseline rollup, or add a custom operational line.' : 'Lines are added while the budget is open in June.'}
                </Empty>
              ) : (
                funds.map((group) => (
                  <div key={group.fund} className="flex flex-col gap-2">
                    <h3 className="border-l-8 border-gold pl-2 font-serif text-base font-bold">{group.fund}</h3>
                    {group.lines.length === 0 ? (
                      <p className="pl-4 text-xs text-muted">No lines in this fund.</p>
                    ) : (
                      <Table caption={`${group.fund} budget lines for ${year}`} head={['Line Item', 'Pre-Populated Baseline', 'Approved Budget Amount', 'Notes', '']}>
                        {group.lines.map((line) => (
                          <BudgetRow key={line.id} line={line} editable={editable} actorId={user.memberId} onSaved={() => void forecast.reload()} />
                        ))}
                        <tr className="font-bold">
                          <Td className="border-t-2 border-navy">{group.fund} subtotal</Td>
                          <Td className="border-t-2 border-navy text-right">{formatMoney(group.prePopulatedTotal)}</Td>
                          <Td className="border-t-2 border-navy text-right">{formatMoney(group.approvedTotal)}</Td>
                          <Td colSpan={2} className="border-t-2 border-navy" />
                        </tr>
                      </Table>
                    )}
                  </div>
                ))
              )}
              {lines.length > 0 ? (
                <div className="flex flex-wrap justify-end gap-8 rounded bg-navy px-4 py-3 text-white" data-surface="navy">
                  <span className="font-bold uppercase tracking-wide">Council total</span>
                  <span>Baseline {formatMoney(baselineTotal)}</span>
                  <span className="font-bold">Approved {formatMoney(approvedTotal)}</span>
                </div>
              ) : null}
            </div>
          </section>
        </div>
      )}
      {adding ? (
        <CustomLineDrawer
          actorId={user.memberId}
          councilId={councilId}
          year={year}
          onClose={() => setAdding(false)}
          onAdded={() => {
            setAdding(false);
            void forecast.reload();
          }}
        />
      ) : null}
    </>
  );
}

export default function BudgetPage() {
  return (
    <RequireArea area="financials/budget">
      <BudgetCenter />
    </RequireArea>
  );
}
