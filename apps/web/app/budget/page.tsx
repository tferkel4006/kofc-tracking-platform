'use client';
// Annual Budget Forecast Center (Sprint 5Y). Every member of the council may read its budget (Sprint 5Y-3
// transparency: canViewBudgetForecast; the drivers: assertMayViewBudgetForecast). Council leadership - its Admins,
// Financial Secretary and Treasurer, its Designated Budget Director, or a Super Admin (canManageBudgetForecast; the
// drivers: assertMayManageBudgetForecast) - prepares it from May 1 to June 30: "Initialize Automated Prior Year Baseline Rollup" runs
// budget.prePopulateNextYear, custom lines come from the drawer (budget.addCustomBudgetLine), and each line's proposed
// amount, notes and category save on change (budget.updateLineItemBudget). Everyone else sees the same sheet as
// read-only text. Lines are grouped under the council's own budget categories (CouncilBudgetCategory, kept on Council
// Lookup Tables) with an Uncategorized group for the rest. Writes are open May 1 through June 30 (canEditBudgetYear);
// before that the drivers refuse them (BUDGET_WINDOW_NOT_OPEN) and from July 1 the year is Finalized
// (BUDGET_YEAR_FINALIZED). A Super Admin on the in-memory mock may tick "Simulate June Drafting Window", which unlocks
// the inputs and sends superAdminOverride with every write.
//
// Sprint 5Y-4 lifecycle: every figure drafted here - including a new custom line's - is a Proposed Budget Amount. The
// Approved column stays locked until leadership (canFinalizeBudgetYear; not the Budget Director) records the council's
// vote with "Approve & Finalize Entire Budget" (budget.approveAndFinalizeEntireBudget), which copies every proposed
// figure into the approved column and freezes the year for good (BUDGET_YEAR_APPROVED). The "Historical Performance
// Review" tab (canReviewBudgetPerformance: the executive summaries' readers) compares a completed year's final
// allocations with its actual year-end spend (budget.getHistoricalKPIs).
//
// Sprint 5Y-6.5 dual baseline: beside every line the sheet shows last year's approved cap and last year's actual spend
// (budget.getPriorYearBaselines), so the Budget Director drafts against both. Custom lines roll forward at last year's
// approved cap.
import { useEffect, useMemo, useState } from 'react';
import {
  BUDGET_LINE_NAME_MAX_LENGTH,
  BUDGET_NOTES_MAX_LENGTH,
  budgetWindowOf,
  canEditBudgetYear,
  canFinalizeBudgetYear,
  canManageBudgetForecast,
  canReviewBudgetPerformance,
  canApproveBudget,
  canViewBudgetForecast,
  describeError,
  groupBudgetByCategory,
  isSuperAdmin,
  sumBudgetAmounts,
  upcomingFraternalYear,
  type BudgetHistoricalKPIs,
  type BudgetLineBaseline,
  type BudgetLineStatus,
  type BudgetPrePopulationResult,
  type BudgetWindowState,
  type BudgetYearPerformance,
  type CouncilBudgetCategory,
  type CouncilBudgetForecast,
} from '@kofc/shared';
import { BudgetAlertTag, formatPercent } from '@/components/BudgetParts';
import { CouncilSelect, RequireArea, useCouncilScope } from '@/components/CouncilScope';
import { Drawer } from '@/components/Drawer';
import { Button, cx, Empty, Field, Input, Notice, PageTitle, Pill, Select, Table, Tabs, Td, Textarea } from '@/components/ui';
import { formatFullDate, formatMoney, parseNumberField } from '@/lib/format';
import { useUser } from '@/lib/session';
import { useLoad } from '@/lib/use-load';
import { DATA_DRIVER, db } from '@/services/db';

const shiftYear = (fraternalYear: string, by: number) => {
  const start = Number(fraternalYear.slice(0, 4)) + by;
  return `${start}-${start + 1}`;
};

const WINDOW_TONE: Record<BudgetWindowState, 'gold' | 'navy' | 'outline'> = { Draft: 'gold', Finalized: 'navy', 'Not Yet Open': 'outline' };
const STATUS_TONE: Record<BudgetLineStatus, 'gold' | 'navy' | 'outline'> = { Draft: 'outline', Proposed: 'gold', Approved: 'navy' };

function windowExplanation(state: BudgetWindowState, year: string, simulated: boolean): string {
  const start = year.slice(0, 4);
  if (simulated) return `Simulated drafting window: inputs are unlocked for this demo. Real budgets for ${year} are drafted May 1 - June 30, ${start}.`;
  if (state === 'Draft') return `The ${year} budget is open for drafting until it locks as Finalized on July 1, ${start}.`;
  if (state === 'Finalized') return `The ${year} budget was locked as Finalized on July 1, ${start}. Figures are read-only.`;
  return `The ${year} budget opens for drafting on May 1, ${start}. Figures are read-only until then.`;
}

function statusExplanation(status: BudgetLineStatus, year: string): string {
  if (status === 'Approved') return `The council approved and finalized the ${year} budget. Its approved figures are frozen.`;
  if (status === 'Proposed') return 'Figures entered here are proposals. The Approved column stays locked until leadership records the council vote.';
  return 'No figure has been proposed yet. Pre-populated lines start as drafts.';
}

/** What every budget write sends: the override only while a Super Admin simulates the drafting window. */
interface WriteContext {
  actorId: number;
  override: boolean;
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

/** A budget category picker; '' is Uncategorized. */
function CategorySelect({ id, value, categories, onChange, label }: { id?: string; value: number | null; categories: CouncilBudgetCategory[]; onChange: (id: number | null) => void; label?: string }) {
  return (
    <Select id={id} aria-label={label} value={value ?? ''} onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}>
      <option value="">Uncategorized</option>
      {categories.map((c) => (
        <option key={c.id} value={c.id}>
          {c.CategoryName}
        </option>
      ))}
    </Select>
  );
}

type SaveState = { kind: 'idle' } | { kind: 'saving' } | { kind: 'saved' } | { kind: 'error'; message: string };

/**
 * One spreadsheet row. Editors change the proposed amount and notes (saved when the box loses focus, if changed) and
 * the category (saved on pick); the approved figure is always read-only. Everyone else reads the same figures as text.
 */
/** Last year's approved cap and actual spend, side by side; actual spend over the cap is red. */
function PriorYearCells({ baseline }: { baseline: BudgetLineBaseline | undefined }) {
  const over = baseline?.priorApproved != null && baseline.priorActual > baseline.priorApproved;
  return (
    <>
      <Td className="whitespace-nowrap border-l-4 border-navy text-right font-bold">
        {baseline?.priorApproved != null ? (
          formatMoney(baseline.priorApproved)
        ) : (
          <span className="font-normal text-muted" title="No approved line for this item last year">
            —
          </span>
        )}
      </Td>
      <Td className={cx('whitespace-nowrap border-r-4 border-navy text-right font-bold', over && 'text-brand-red')}>
        {baseline ? formatMoney(baseline.priorActual) : '…'}
        {over ? <span className="sr-only"> (over last year&apos;s cap)</span> : null}
      </Td>
    </>
  );
}

function BudgetRow({
  line,
  baseline,
  editable,
  categories,
  write,
  onSaved,
}: {
  line: CouncilBudgetForecast;
  baseline: BudgetLineBaseline | undefined;
  editable: boolean;
  categories: CouncilBudgetCategory[];
  write: WriteContext;
  onSaved: () => void;
}) {
  const [amount, setAmount] = useState(String(line.ProposedBudgetAmount));
  const [notes, setNotes] = useState(line.Notes ?? '');
  const [state, setState] = useState<SaveState>({ kind: 'idle' });
  useEffect(() => {
    setAmount(String(line.ProposedBudgetAmount));
    setNotes(line.Notes ?? '');
  }, [line.ProposedBudgetAmount, line.Notes]);

  const save = async (budgetCategoryId?: number | null) => {
    const trimmedNotes = notes.trim();
    try {
      const value = parseNumberField(amount, 'Proposed budget amount') ?? 0;
      const unchanged = value === line.ProposedBudgetAmount && trimmedNotes === (line.Notes ?? '');
      if (unchanged && budgetCategoryId === undefined) return;
      setState({ kind: 'saving' });
      await db.budget.updateLineItemBudget(write.actorId, line.id, value, trimmedNotes === '' ? null : trimmedNotes, {
        budgetCategoryId,
        superAdminOverride: write.override,
      });
      setState({ kind: 'saved' });
      onSaved();
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
      <PriorYearCells baseline={baseline} />
      <Td className="whitespace-nowrap text-right">{formatMoney(line.PrePopulatedAmount)}</Td>
      <Td className="w-40">
        {editable ? (
          <Input
            aria-label={`Proposed budget for ${line.LineItemName}`}
            inputMode="decimal"
            className="w-full text-right"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            onBlur={() => void save()}
          />
        ) : (
          <span className="block text-right">{formatMoney(line.ProposedBudgetAmount)}</span>
        )}
      </Td>
      <Td className="whitespace-nowrap text-right">
        {line.BudgetStatus === 'Approved' ? (
          <span className="font-bold">{formatMoney(line.ApprovedBudgetAmount)}</span>
        ) : (
          <span className="text-xs text-muted" title="Set when leadership approves and finalizes the budget">
            🔒 Locked
          </span>
        )}
      </Td>
      <Td>
        <Pill tone={STATUS_TONE[line.BudgetStatus]}>{line.BudgetStatus}</Pill>
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
      {editable ? (
        <Td className="w-56">
          <CategorySelect label={`Category for ${line.LineItemName}`} value={line.BudgetCategoryID ?? null} categories={categories} onChange={(id) => void save(id)} />
        </Td>
      ) : null}
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

/**
 * "Add Custom Council Operational Line": a name, a proposed figure and a category, added with budget.addCustomBudgetLine.
 * The line is recorded as Proposed; its approved figure waits for the council's vote.
 */
function CustomLineDrawer({
  write,
  councilId,
  year,
  categories,
  onClose,
  onAdded,
}: {
  write: WriteContext;
  councilId: number;
  year: string;
  categories: CouncilBudgetCategory[];
  onClose: () => void;
  onAdded: () => void;
}) {
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const add = async () => {
    setBusy(true);
    setError(null);
    try {
      await db.budget.addCustomBudgetLine(
        write.actorId,
        councilId,
        {
          FraternalYear: year,
          LineItemName: name,
          ProposedBudgetAmount: parseNumberField(amount, 'Proposed budget amount'),
          Notes: notes.trim() || null,
          BudgetCategoryID: categoryId,
        },
        { superAdminOverride: write.override },
      );
      onAdded();
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
          A running cost of the council that is not an annual event or charity, such as bank fees or bulletin ads. It is added to the {year} budget and carried into the next year&apos;s rollup.
        </p>
        {error ? (
          <Notice tone="error" onDismiss={() => setError(null)}>
            {error}
          </Notice>
        ) : null}
        <Field label="Line item name">
          {(id) => <Input id={id} required maxLength={BUDGET_LINE_NAME_MAX_LENGTH} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Bank Fees" />}
        </Field>
        <Field
          label="Proposed budget amount ($)"
          hint="Recorded in the Proposed Budget Amount column. The approved figure stays locked until leadership approves and finalizes the whole budget."
        >
          {(id) => <Input id={id} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />}
        </Field>
        <Field label="Budget category" hint="The council's categories are kept under Council Lookup Tables → Budget categories.">
          {(id) => <CategorySelect id={id} value={categoryId} categories={categories} onChange={setCategoryId} />}
        </Field>
        <Field label="Notes (optional)">
          {(id) => <Textarea id={id} maxLength={BUDGET_NOTES_MAX_LENGTH} value={notes} onChange={(e) => setNotes(e.target.value)} />}
        </Field>
        <Button type="submit" disabled={busy || name.trim() === ''}>
          {busy ? 'Adding…' : 'Add proposed line'}
        </Button>
      </form>
    </Drawer>
  );
}

/**
 * The master finalization control: a two-step confirmation, then budget.approveAndFinalizeEntireBudget. Shown to
 * leadership who may approve; disabled (with the reason) while the year cannot be finalized.
 */
function FinalizeBudget({
  write,
  councilId,
  year,
  proposedTotal,
  lineCount,
  enabled,
  reason,
  onFinalized,
}: {
  write: WriteContext;
  councilId: number;
  year: string;
  proposedTotal: number;
  lineCount: number;
  enabled: boolean;
  reason: string;
  onFinalized: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => setConfirming(false), [councilId, year]);

  const finalize = async () => {
    setBusy(true);
    setError(null);
    try {
      await db.budget.approveAndFinalizeEntireBudget(write.actorId, councilId, year, { superAdminOverride: write.override });
      setConfirming(false);
      onFinalized();
    } catch (err) {
      setError(describeError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section aria-label="Approve and finalize" className="flex flex-col gap-2 rounded border-2 border-navy border-l-8 border-l-brand-red bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-serif text-base font-bold">Council vote</p>
          <p className="text-sm text-muted">{enabled ? `Records the council's approval of all ${lineCount} proposed lines (${formatMoney(proposedTotal)}).` : reason}</p>
        </div>
        {!confirming ? (
          <Button variant="danger" className="px-6 py-3 text-base" disabled={!enabled} onClick={() => setConfirming(true)}>
            Approve &amp; Finalize Entire Budget
          </Button>
        ) : null}
      </div>
      {error ? (
        <Notice tone="error" onDismiss={() => setError(null)}>
          {error}
        </Notice>
      ) : null}
      {confirming ? (
        <div role="alertdialog" aria-label="Confirm budget approval" className="flex flex-wrap items-center gap-3 rounded bg-navy px-4 py-3 text-white" data-surface="navy">
          <p className="text-sm">
            Approve the {year} budget at {formatMoney(proposedTotal)}? Every proposed figure becomes the approved figure and the whole year is frozen. This cannot be undone.
          </p>
          <div className="ml-auto flex gap-2">
            <Button variant="secondary" onClick={() => setConfirming(false)} disabled={busy}>
              Cancel
            </Button>
            <Button variant="danger" onClick={() => void finalize()} disabled={busy}>
              {busy ? 'Finalizing…' : 'Yes, approve and finalize'}
            </Button>
          </div>
        </div>
      ) : null}
    </section>
  );
}

/** The Annual Budget Projections tab: the year's spreadsheet, rollup, custom lines and the finalization control. */
function Projections({ councilId, year, today, simulated }: { councilId: number; year: string; today: Date; simulated: boolean }) {
  const user = useUser();
  const [adding, setAdding] = useState(false);
  const [rolling, setRolling] = useState(false);
  const [rollup, setRollup] = useState<BudgetPrePopulationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [approvedNotice, setApprovedNotice] = useState(false);

  const canEdit = canManageBudgetForecast(user, councilId);
  const write: WriteContext = { actorId: user.memberId, override: simulated };

  const forecast = useLoad(() => db.budget.listAnnualForecast(user.memberId, councilId, year), [user.memberId, councilId, year]);
  useEffect(() => {
    setRollup(null);
    setError(null);
    setApprovedNotice(false);
  }, [councilId, year]);

  const lines = forecast.data?.lines ?? [];
  const categories = forecast.data?.categories ?? [];
  // Reloaded whenever the set of lines changes (a rollup or a new custom line).
  const lineIds = lines.map((l) => l.id).join(',');
  const baselines = useLoad(() => db.budget.getPriorYearBaselines(user.memberId, councilId, year), [user.memberId, councilId, year, lineIds]);
  const baselineOf = useMemo(() => new Map((baselines.data?.lines ?? []).map((b) => [b.lineId, b])), [baselines.data]);
  const priorYear = shiftYear(year, -1);
  const priorCapTotal = (ls: readonly CouncilBudgetForecast[]) => {
    const caps = ls.map((l) => baselineOf.get(l.id)?.priorApproved).filter((v): v is number => v != null);
    return caps.length > 0 ? formatMoney(sumBudgetAmounts(caps)) : '—';
  };
  const priorActualTotal = (ls: readonly CouncilBudgetForecast[]) => formatMoney(sumBudgetAmounts(ls.map((l) => baselineOf.get(l.id)?.priorActual ?? 0)));
  const status: BudgetLineStatus = forecast.data?.status ?? 'Draft';
  const windowState: BudgetWindowState = simulated ? 'Draft' : (forecast.data?.window ?? budgetWindowOf(year, today));
  const editable = canEditBudgetYear(user, councilId, year, today, simulated, status);
  const finalizable = canFinalizeBudgetYear(user, councilId, year, today, status, lines.length, simulated);
  const groups = groupBudgetByCategory(lines, categories);
  const baselineTotal = sumBudgetAmounts(lines.map((l) => l.PrePopulatedAmount));
  const proposedTotal = sumBudgetAmounts(lines.map((l) => l.ProposedBudgetAmount));
  const approvedTotal = sumBudgetAmounts(lines.map((l) => l.ApprovedBudgetAmount));
  const planned = status === 'Approved' ? approvedTotal : proposedTotal;
  const change = Math.round((planned - baselineTotal) * 100) / 100;
  const finalizeReason =
    status === 'Approved'
      ? `The ${year} budget is approved and finalized.`
      : lines.length === 0
        ? 'There are no lines to approve yet.'
        : `The ${year} budget can be approved once it opens for drafting on May 1, ${year.slice(0, 4)}.`;

  const runRollup = async () => {
    setRolling(true);
    setError(null);
    try {
      const result = await db.budget.prePopulateNextYear(user.memberId, councilId, year, { superAdminOverride: simulated });
      setRollup(result);
      await forecast.reload();
    } catch (err) {
      setError(describeError(err));
    } finally {
      setRolling(false);
    }
  };

  const head = [
    'Line Item',
    `${priorYear} Approved Cap`,
    `${priorYear} Actual Spend`,
    'Pre-Populated Baseline',
    'Proposed Budget Amount',
    'Approved Budget Amount',
    'Status',
    'Notes',
    ...(editable ? ['Category'] : []),
    '',
  ];

  return (
    <div className="flex flex-col gap-4">
      <section aria-label="Budget year status" className="flex flex-wrap items-end gap-4 rounded border border-line bg-white p-4">
        {canEdit ? (
          <Button
            className="px-6 py-3 text-base shadow"
            disabled={!editable || rolling}
            onClick={() => void runRollup()}
            title={editable ? `Seed ${year} from ${shiftYear(year, -1)} actual spend` : 'Available only while the budget is open for drafting and not yet approved'}
          >
            {rolling ? 'Sweeping prior year actuals…' : 'Initialize Automated Prior Year Baseline Rollup'}
          </Button>
        ) : (
          <div className="rounded border-2 border-navy border-l-8 border-l-gold px-4 py-2">
            <p className="text-xs font-bold uppercase tracking-wide">Transparency view</p>
            <p className="text-sm">You can review every line of the council&apos;s budget. Council leadership and the Budget Director prepare it.</p>
          </div>
        )}
        <div className="flex flex-col gap-1">
          <span className="text-xs font-bold uppercase tracking-wide">Budget window</span>
          <Pill tone={WINDOW_TONE[windowState]}>{simulated ? 'Draft (simulated)' : windowState}</Pill>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs font-bold uppercase tracking-wide">Lifecycle</span>
          <Pill tone={STATUS_TONE[status]}>{status}</Pill>
        </div>
        <p className="basis-full text-sm text-muted">
          {windowExplanation(windowState, year, simulated)} {statusExplanation(status, year)}
        </p>
      </section>

      {error ? (
        <Notice tone="error" onDismiss={() => setError(null)}>
          {error}
        </Notice>
      ) : null}
      {forecast.error ? <Notice tone="error">{forecast.error}</Notice> : null}
      {baselines.error ? <Notice tone="error">Last year&apos;s baselines could not be loaded: {baselines.error}</Notice> : null}
      {rollup ? (
        <Notice tone="info" onDismiss={() => setRollup(null)}>
          Rollup complete from {rollup.sourceFraternalYear} actual spend and approved caps: {rollup.created} new line{rollup.created === 1 ? '' : 's'}, {rollup.refreshed} refreshed. Proposed amounts were left for
          your review.
        </Notice>
      ) : null}
      {approvedNotice ? (
        <Notice tone="info" onDismiss={() => setApprovedNotice(false)}>
          The {year} budget is approved and finalized at {formatMoney(approvedTotal)}. Its figures are now frozen and drive the dashboard&apos;s budget gauges.
        </Notice>
      ) : null}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Scorecard
          label="Pre-populated baseline"
          value={formatMoney(baselineTotal)}
          detail={`${priorYear} actual spend, and approved caps for custom lines, across ${lines.length} lines`}
        />
        <Scorecard label="Proposed budget" value={formatMoney(proposedTotal)} detail={`${year} total across ${categories.length} categor${categories.length === 1 ? 'y' : 'ies'}`} />
        <Scorecard
          label="Approved budget"
          value={status === 'Approved' ? formatMoney(approvedTotal) : 'Locked'}
          detail={status === 'Approved' ? 'Approved and finalized by the council' : 'Set by the council vote'}
        />
        <Scorecard
          label="Change from baseline"
          value={`${change > 0 ? '+' : ''}${formatMoney(change)}`}
          detail={change > 0 ? 'Planned increase over last year' : change < 0 ? 'Planned reduction from last year' : 'Level with last year'}
        />
      </div>

      {canApproveBudget(user, councilId) ? (
        <FinalizeBudget
          write={write}
          councilId={councilId}
          year={year}
          proposedTotal={proposedTotal}
          lineCount={lines.length}
          enabled={finalizable}
          reason={finalizeReason}
          onFinalized={() => {
            setApprovedNotice(true);
            void forecast.reload();
          }}
        />
      ) : null}

      <section aria-label="Budget spreadsheet" className="rounded border border-line bg-white">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-2">
          <h2 className="font-serif text-lg font-bold">Annual Budget Projections · {year}</h2>
          {canEdit ? (
            <Button variant="secondary" className="border-gold" disabled={!editable} onClick={() => setAdding(true)}>
              + Add Custom Council Operational Line
            </Button>
          ) : (
            <Pill tone="outline">Read only</Pill>
          )}
        </header>
        <div className="flex flex-col gap-6 p-4">
          {categories.length === 0 && canEdit ? (
            <Notice tone="info">This council has no budget categories yet. Add them under Council Lookup Tables → Budget categories; until then every line is Uncategorized.</Notice>
          ) : null}
          {forecast.loading && !forecast.data ? (
            <p className="text-sm text-muted">Loading…</p>
          ) : lines.length === 0 ? (
            <Empty>
              No budget lines for {year} yet.{' '}
              {editable ? 'Run the prior year baseline rollup, or add a custom operational line.' : 'Lines are added while the budget is open, May 1 to June 30.'}
            </Empty>
          ) : (
            groups.map((group) => (
              <div key={group.category?.id ?? 'uncategorized'} className="flex flex-col gap-2">
                <h3 className="border-l-8 border-gold pl-2 font-serif text-base font-bold">{group.label}</h3>
                {group.lines.length === 0 ? (
                  <p className="pl-4 text-xs text-muted">No lines in this category.</p>
                ) : (
                  <Table caption={`${group.label} budget lines for ${year}`} head={head}>
                    {group.lines.map((line) => (
                      <BudgetRow key={line.id} line={line} baseline={baselineOf.get(line.id)} editable={editable} categories={categories} write={write} onSaved={() => void forecast.reload()} />
                    ))}
                    <tr className="font-bold">
                      <Td className="border-t-2 border-navy">{group.label} subtotal</Td>
                      <Td className="border-t-2 border-l-4 border-navy text-right">{priorCapTotal(group.lines)}</Td>
                      <Td className="border-t-2 border-r-4 border-navy text-right">{priorActualTotal(group.lines)}</Td>
                      <Td className="border-t-2 border-navy text-right">{formatMoney(group.prePopulatedTotal)}</Td>
                      <Td className="border-t-2 border-navy text-right">{formatMoney(group.proposedTotal)}</Td>
                      <Td className="border-t-2 border-navy text-right">{status === 'Approved' ? formatMoney(group.approvedTotal) : '—'}</Td>
                      <Td colSpan={head.length - 6} className="border-t-2 border-navy" />
                    </tr>
                  </Table>
                )}
              </div>
            ))
          )}
          {lines.length > 0 ? (
            <div className="flex flex-wrap justify-end gap-8 rounded bg-navy px-4 py-3 text-white" data-surface="navy">
              <span className="font-bold uppercase tracking-wide">Council total</span>
              <span>
                {priorYear} cap {priorCapTotal(lines)} · actual {priorActualTotal(lines)}
              </span>
              <span>Baseline {formatMoney(baselineTotal)}</span>
              <span>Proposed {formatMoney(proposedTotal)}</span>
              <span className="font-bold">Approved {status === 'Approved' ? formatMoney(approvedTotal) : '(locked)'}</span>
            </div>
          ) : null}
        </div>
      </section>
      {adding ? (
        <CustomLineDrawer
          write={write}
          councilId={councilId}
          year={year}
          categories={categories}
          onClose={() => setAdding(false)}
          onAdded={() => {
            setAdding(false);
            void forecast.reload();
          }}
        />
      ) : null}
    </div>
  );
}

/** The KPI card crowning a year's review: its final allocation, actual spend, variance and fiscal efficiency. */
function KpiSummaryCard({ year }: { year: BudgetYearPerformance }) {
  const over = year.variance < 0;
  return (
    <section aria-label={`${year.fraternalYear} performance summary`} className="grid grid-cols-1 gap-4 rounded border-2 border-navy border-t-8 border-t-gold bg-white p-4 md:grid-cols-5">
      <div className="md:col-span-5 flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-serif text-lg font-bold">Financial performance KPI · {year.fraternalYear}</h3>
        <div className="flex gap-2">
          <Pill tone={STATUS_TONE[year.status]}>{year.status}</Pill>
          <BudgetAlertTag alert={year.alert} />
        </div>
      </div>
      <div>
        <p className="text-xs font-bold uppercase tracking-wide">Final allocation</p>
        <p className="font-serif text-2xl font-bold">{formatMoney(year.approvedTotal)}</p>
      </div>
      <div>
        <p className="text-xs font-bold uppercase tracking-wide">Actual year-end spend</p>
        <p className="font-serif text-2xl font-bold">{formatMoney(year.actualTotal)}</p>
        <p className="text-xs text-muted">incl. {formatMoney(year.unbudgetedActual)} unbudgeted</p>
      </div>
      <div>
        <p className="text-xs font-bold uppercase tracking-wide">Variance</p>
        <p className={cx('font-serif text-2xl font-bold', over && 'text-brand-red')}>{formatMoney(year.variance)}</p>
        <p className="text-xs text-muted">{over ? 'Over the approved budget' : 'Under the approved budget'}</p>
      </div>
      <div>
        <p className="text-xs font-bold uppercase tracking-wide">Fiscal efficiency</p>
        <p className="font-serif text-2xl font-bold">{formatPercent(year.utilizationPercent)}</p>
        <p className="text-xs text-muted">Actual spend ÷ approved budget</p>
      </div>
      <div>
        <p className="text-xs font-bold uppercase tracking-wide">Lines within budget</p>
        <p className="font-serif text-2xl font-bold">
          {year.linesWithinBudget} / {year.lines.length}
        </p>
        <p className={cx('text-xs', year.linesOverBudget > 0 ? 'font-bold text-brand-red' : 'text-muted')}>{year.linesOverBudget} over budget</p>
      </div>
    </section>
  );
}

/** A completed year's read-only spreadsheet: each category's lines, final allocation beside actual year-end spend. */
function YearComparison({ year }: { year: BudgetYearPerformance }) {
  // A line whose category is not one of the council's falls in the Uncategorized group (groupBudgetByCategory).
  const known = new Set(year.categories.map((c) => c.categoryId).filter((id) => id !== null));
  const groupOf = (id: number | null | undefined) => (id != null && known.has(id) ? id : null);
  const groups = year.categories.map((c) => ({ ...c, lines: year.lines.filter((l) => groupOf(l.line.BudgetCategoryID) === c.categoryId) }));
  const head = ['Line Item', 'Final Allocation', 'Actual Year-End Spend', 'Variance', '% Used', 'Status'];
  return (
    <div className="flex flex-col gap-6">
      {groups
        .filter((g) => g.lines.length > 0)
        .map((g) => (
          <div key={g.categoryId ?? 'uncategorized'} className="flex flex-col gap-2">
            <h3 className="border-l-8 border-gold pl-2 font-serif text-base font-bold">{g.label}</h3>
            <Table caption={`${g.label}: ${year.fraternalYear} allocations against actual spend`} head={head}>
              {g.lines.map((l) => (
                <tr key={l.line.id}>
                  <Td>
                    <span className="font-bold">{l.line.LineItemName}</span>
                    <span className="ml-2">
                      <Pill tone="outline">{l.line.CategoryType}</Pill>
                    </span>
                  </Td>
                  <Td className="whitespace-nowrap text-right">{formatMoney(l.line.ApprovedBudgetAmount)}</Td>
                  <Td className="whitespace-nowrap text-right">{formatMoney(l.actual)}</Td>
                  <Td className={cx('whitespace-nowrap text-right', l.variance < 0 && 'font-bold text-brand-red')}>{formatMoney(l.variance)}</Td>
                  <Td className="whitespace-nowrap text-right">{formatPercent(l.percentUsed)}</Td>
                  <Td>
                    <BudgetAlertTag alert={l.alert} />
                  </Td>
                </tr>
              ))}
              <tr className="font-bold">
                <Td className="border-t-2 border-navy">{g.label} subtotal</Td>
                <Td className="border-t-2 border-navy text-right">{formatMoney(g.approved)}</Td>
                <Td className="border-t-2 border-navy text-right">{formatMoney(g.actual)}</Td>
                <Td className={cx('border-t-2 border-navy text-right', g.variance < 0 && 'text-brand-red')}>{formatMoney(g.variance)}</Td>
                <Td className="border-t-2 border-navy text-right">{formatPercent(g.percentUsed)}</Td>
                <Td className="border-t-2 border-navy">
                  <BudgetAlertTag alert={g.alert} />
                </Td>
              </tr>
            </Table>
          </div>
        ))}
      <div className="flex flex-wrap justify-end gap-8 rounded bg-navy px-4 py-3 text-white" data-surface="navy">
        <span className="font-bold uppercase tracking-wide">Council total</span>
        <span>Allocated {formatMoney(year.approvedTotal)}</span>
        <span>Budgeted spend {formatMoney(year.budgetedActual)}</span>
        <span>Unbudgeted spend {formatMoney(year.unbudgetedActual)}</span>
        <span className="font-bold">Actual {formatMoney(year.actualTotal)}</span>
      </div>
    </div>
  );
}

/** The trailing scorecard over every approved completed year. */
function TrailingScorecard({ kpis }: { kpis: BudgetHistoricalKPIs }) {
  const t = kpis.trailing;
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
      <Scorecard label="Years reviewed" value={`${t.approvedYears} approved`} detail={`${t.years} completed year${t.years === 1 ? '' : 's'} with a budget`} />
      <Scorecard label="Trailing approved budgets" value={formatMoney(t.approvedTotal)} detail={`Against ${formatMoney(t.actualTotal)} actual spend`} />
      <Scorecard label="Trailing fiscal efficiency" value={formatPercent(t.utilizationPercent)} detail="Actual spend ÷ approved budgets" />
      <Scorecard label="Years within budget" value={`${t.yearsWithinBudget} / ${t.approvedYears}`} detail={`${t.yearsOverBudget} over budget`} />
    </div>
  );
}

/** The Historical Performance Review tab: pick a completed year and compare its allocations with its actual spend. */
function HistoricalReview({ councilId }: { councilId: number }) {
  const user = useUser();
  const history = useLoad(() => db.budget.getHistoricalKPIs(user.memberId, councilId), [user.memberId, councilId]);
  const [chosen, setChosen] = useState<string | null>(null);
  const kpis = history.data;
  const years = kpis?.years ?? [];
  const year = years.find((y) => y.fraternalYear === chosen) ?? years[0];

  if (history.error) return <Notice tone="error">{history.error}</Notice>;
  if (!kpis) return <p className="text-sm text-muted">Loading the council&apos;s budget history…</p>;
  return (
    <div className="flex flex-col gap-4">
      <TrailingScorecard kpis={kpis} />
      {years.length === 0 ? (
        <Empty>No completed fraternal year has a budget yet. A year appears here once its June 30 has passed.</Empty>
      ) : (
        <>
          <section aria-label="Choose a year" className="flex flex-wrap items-end gap-4 rounded border border-line bg-white p-4">
            <Field label="Completed fraternal year">
              {(id) => (
                <Select id={id} value={year?.fraternalYear ?? ''} onChange={(e) => setChosen(e.target.value)}>
                  {years.map((y) => (
                    <option key={y.fraternalYear} value={y.fraternalYear}>
                      {y.fraternalYear} ({y.status})
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <p className="text-sm text-muted">
              Read-only. Actual spend runs {year ? `${formatFullDate(year.fromDate)} to ${formatFullDate(year.throughDate)}` : ''} and counts what the monthly executive
              summaries count: event spend, approved and reimbursed expenses, and charity checks.
            </p>
          </section>
          {year ? (
            <>
              <KpiSummaryCard year={year} />
              {year.status !== 'Approved' ? (
                <Notice tone="info">The council never approved the {year.fraternalYear} budget, so it has no final allocations to measure against.</Notice>
              ) : null}
              <YearComparison year={year} />
            </>
          ) : null}
        </>
      )}
    </div>
  );
}

type BudgetTab = 'projections' | 'history';

function BudgetCenter() {
  const user = useUser();
  const scope = useCouncilScope();
  const councilId = scope.councilId;
  const today = useMemo(() => new Date(), []);
  const upcoming = upcomingFraternalYear(today);
  const [year, setYear] = useState(upcoming);
  const [simulate, setSimulate] = useState(false);
  const [tab, setTab] = useState<BudgetTab>('projections');

  const canView = canViewBudgetForecast(user, councilId);
  const canReview = canReviewBudgetPerformance(user, councilId);
  // Demo-only override: a Super Admin on the in-memory mock may force the drafting window open.
  const maySimulate = isSuperAdmin(user) && DATA_DRIVER === 'memory';
  const simulated = maySimulate && simulate;
  const shown: BudgetTab = canReview ? tab : 'projections';

  const yearOptions = [shiftYear(upcoming, 1), upcoming, shiftYear(upcoming, -1), shiftYear(upcoming, -2)];
  const tabs: { id: BudgetTab; label: string }[] = [
    { id: 'projections', label: 'Annual Budget Projections' },
    ...(canReview ? [{ id: 'history' as const, label: 'Historical Performance Review' }] : []),
  ];

  return (
    <>
      <PageTitle actions={<CouncilSelect scope={scope} />}>Annual Budget Forecast Center</PageTitle>
      {!canView ? (
        <Notice tone="error">Only members of this council, or a Super Admin, may view its budget.</Notice>
      ) : (
        <div className="flex flex-col gap-4">
          {tabs.length > 1 ? <Tabs tabs={tabs} value={shown} onChange={setTab} label="Budget views" idPrefix="budget" /> : null}
          <div role={tabs.length > 1 ? 'tabpanel' : undefined} id="budget-panel" aria-labelledby={tabs.length > 1 ? `budget-tab-${shown}` : undefined} className="flex flex-col gap-4">
            {shown === 'projections' ? (
              <>
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
                  {maySimulate ? (
                    <label className="ml-auto flex items-center gap-2 rounded border-2 border-dashed border-brand-red px-3 py-2 text-sm font-bold text-brand-red">
                      <input type="checkbox" className="size-4" checked={simulate} onChange={(e) => setSimulate(e.target.checked)} />
                      Simulate June Drafting Window
                      <span className="text-xs font-normal">(demo only · overrides the July 1 lock, never an approval)</span>
                    </label>
                  ) : null}
                </section>
                <Projections councilId={councilId} year={year} today={today} simulated={simulated} />
              </>
            ) : (
              <HistoricalReview councilId={councilId} />
            )}
          </div>
        </div>
      )}
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
