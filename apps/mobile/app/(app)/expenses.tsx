// My expense reports, on the phone: file receipts where the money was spent. A draft sheet names the event or
// meeting it was for and holds one card per receipt, each with a "Scan Paper Receipt" camera tile (the photo is
// copied into the app's media folder and its path saved as ReceiptPhotoURL), vendor, date, amount and description.
// The member saves a draft or submits it to the council's leadership, then follows it through Submitted, Approved
// and Reimbursed. A sheet leadership returned shows its reason in red until it is resubmitted. Opened from Home.
// Sprint 5Z-6: a sheet naming an event or meeting that has not started, or ended more than 30 days ago, is outside its
// submission window: the submit button grays out behind a padlock (drafts still save) and the draft card says why.
// Sprint 5Z-Mobile-Clean: "Spent for" is two steps. A toggle picks Event, Meeting or General council expense, then a
// dropdown lists only that category's items whose submission window is open today. A draft already naming an item
// outside its window keeps it in the list, so the padlock can explain why.
// Sprint 6I: the "Long-term Council Asset" switch matches the web form's checkbox (ExpenseReport.is_long_term_asset). A
// draft opens with its saved value and every save sends it, as it does the web-set charity link, so re-saving on the
// phone never clears either.
// Sprint 6Q: a fourth toggle, Activity, files receipts against a long-running council activity (such as the Ultrasound
// Initiative). Activities have no dates, so every activity of the council is listed and no padlock applies.
// Sprint 6S: each receipt card has a Personal switch (a split-ticket item the council does not pay), and the Honor
// Voucher switch covers a report with no receipt and asks why. Receipts entered on the web (ExpenseReceipts) are not
// edited here; a draft resends them, and its lines keep their receipt, so saving on the phone never drops them.
import { useMemo, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import {
  addDays,
  blankExpenseLine,
  expenseDraftPersonalTotal,
  expenseDraftTotal,
  expenseLineDraftFrom,
  expenseReceiptInputsOf,
  expenseLinesFromDrafts,
  expenseReferenceChoices,
  expenseReferenceKey,
  expenseReferenceLabel,
  expenseReferenceSpan,
  expenseStatusBadge,
  expenseWindowState,
  expenseWindowLockMessage,
  formatDate,
  isLongTermAssetExpense,
  listExpenseReferences,
  parseExpenseReferenceKey,
  SPACING,
  toIsoDate,
  EXPENSE_DESCRIPTION_MAX_LENGTH,
  EXPENSE_SUBMISSION_GRACE_DAYS,
  EXPENSE_VENDOR_MAX_LENGTH,
  MISSING_RECEIPT_REASON_MAX_LENGTH,
  type ExpenseLineDraft,
  type ExpenseReferenceOptions,
  type ExpenseReportDetail,
} from '@kofc/shared';
import { Dropdown } from '@/components/Dropdown';
import { FeatureGate } from '@/components/FeatureGate';
import { NavStrip } from '@/components/NavStrip';
import { ReceiptScanTile, SCAN_RECEIPT_TITLE } from '@/components/ReceiptScanTile';
import { AppInput, AppText, choiceStyle, Button, Card, EmptyState, Field, Loading, Notice, Pill, Screen, Section, ToggleSwitch } from '@/components/ui';
import { useUser } from '@/lib/app-context';
import { useTheme } from '@/lib/layout-mode';
import { describeError, useLoad } from '@/lib/use-async';
import { db } from '@/services/db';

const money = (n: number) => `$${n.toFixed(2)}`;
/** A multi-line note box; AppInput lifts the height to the large text layout's touchTarget. */
const multiline = { minHeight: 72, textAlignVertical: 'top' as const, paddingTop: SPACING.md };

type Row = ExpenseLineDraft & { key: number };

type SpentFor = 'event' | 'activity' | 'meeting' | 'general';

const SPENT_FOR: { key: SpentFor; label: string }[] = [
  { key: 'event', label: 'Event' },
  { key: 'activity', label: 'Activity' },
  { key: 'meeting', label: 'Meeting' },
  { key: 'general', label: 'General' },
];

const spentForOf = (reference: string): SpentFor =>
  reference.startsWith('event:') ? 'event' : reference.startsWith('activity:') ? 'activity' : reference.startsWith('meeting:') ? 'meeting' : 'general';

/** The picker group, dropdown label and placeholder of each linked category. */
const SPENT_FOR_PICKER: Record<Exclude<SpentFor, 'general'>, { group: 'Events' | 'Activities' | 'Meetings'; title: string; question: string }> = {
  event: { group: 'Events', title: 'Event', question: 'WHICH EVENT?' },
  activity: { group: 'Activities', title: 'Activity', question: 'WHICH ACTIVITY?' },
  meeting: { group: 'Meetings', title: 'Meeting', question: 'WHICH MEETING?' },
};

// ---- the draft form ------------------------------------------------------------------

function ExpenseDraftForm({
  detail,
  refs,
  today,
  onSaved,
  onCancel,
}: {
  detail: ExpenseReportDetail | null;
  refs: ExpenseReferenceOptions;
  today: string;
  onSaved: (saved: ExpenseReportDetail) => Promise<void>;
  onCancel: () => void;
}) {
  const theme = useTheme();
  const { color, radius, space, touchTarget } = theme;
  const user = useUser();
  const nextKey = useRef(0);
  const keyed = (line: ExpenseLineDraft): Row => ({ ...line, key: nextKey.current++ });
  const [reference, setReference] = useState(() => (detail ? expenseReferenceKey(detail.report) : ''));
  const [spentFor, setSpentFor] = useState<SpentFor>(() => spentForOf(reference));
  const [longTermAsset, setLongTermAsset] = useState(() => isLongTermAssetExpense(detail?.report ?? {}));
  const [rows, setRows] = useState<Row[]>(() =>
    detail && detail.lineItems.length > 0 ? detail.lineItems.map((li) => keyed(expenseLineDraftFrom(li, detail.receipts))) : [keyed(blankExpenseLine(today))],
  );
  const [honorVoucher, setHonorVoucher] = useState(() => Boolean(detail?.report.flag_missing_receipt));
  const [missingReason, setMissingReason] = useState(() => detail?.report.missing_receipt_reason ?? '');
  const [busy, setBusy] = useState<'Draft' | 'Submitted' | null>(null);
  const [error, setError] = useState<string | null>(null);
  // The chosen category's items whose submission window is open today, plus the draft's own pick if it is not.
  const options = useMemo(() => {
    if (spentFor === 'general') return [];
    const { group } = SPENT_FOR_PICKER[spentFor];
    return expenseReferenceChoices(refs)
      .filter((c) => c.group === group)
      .filter((c) => {
        // Activities run without dates, so they are always open for filing.
        if (group === 'Activities') return true;
        const span = expenseReferenceSpan(c.key, refs);
        return c.key === reference || (span !== null && expenseWindowState(span, today) === 'open');
      })
      .map((c) => ({ value: c.key, label: c.label }));
  }, [refs, spentFor, reference, today]);
  const needsPick = spentFor !== 'general' && reference === '';

  // Sprint 5Z-6: outside the linked event's or meeting's submission window the submit button is padlocked.
  const span = expenseReferenceSpan(reference, refs);
  const locked = span ? expenseWindowLockMessage(span, today) : null;

  const setCell = <K extends keyof ExpenseLineDraft>(key: number, field: K, value: ExpenseLineDraft[K]) =>
    setRows((now) => now.map((r) => (r.key === key ? { ...r, [field]: value } : r)));

  const save = async (status: 'Draft' | 'Submitted') => {
    setBusy(status);
    setError(null);
    try {
      const items = expenseLinesFromDrafts(rows);
      const saved = await db.expenses.submitReport(
        user.memberId,
        {
          id: detail?.report.id ?? null,
          Status: status,
          ...parseExpenseReferenceKey(reference),
          is_long_term_asset: longTermAsset,
          charity_request_id: detail?.report.charity_request_id ?? null, // keeps a link set on the web (Sprint 6H)
          receipts: expenseReceiptInputsOf(detail?.receipts ?? []), // keeps receipts entered on the web (Sprint 6S)
          flag_missing_receipt: honorVoucher,
          missing_receipt_reason: honorVoucher ? missingReason : null,
        },
        items,
      );
      await onSaved(saved);
    } catch (err) {
      setError(describeError(err));
      setBusy(null);
    }
  };

  return (
    <View style={{ gap: space.lg }}>
      <Card accent={color.gold}>
        <AppText variant="title">{detail ? `Draft #${detail.report.id}` : 'New expense report'}</AppText>
        {detail?.report.RejectionReason ? <Notice tone="error" message={`Returned by council leadership: ${detail.report.RejectionReason}`} /> : null}
        <Field label="SPENT FOR">
          <View accessibilityRole="tablist" style={{ flexDirection: 'row', borderWidth: 2, borderColor: color.edge, borderRadius: radius.md, overflow: 'hidden' }}>
            {SPENT_FOR.map(({ key, label }) => {
              const selected = spentFor === key;
              return (
                <Pressable
                  key={key}
                  accessibilityRole="tab"
                  accessibilityState={{ selected }}
                  onPress={() => {
                    if (selected) return;
                    setSpentFor(key);
                    setReference('');
                  }}
                  style={[{ flex: 1, minHeight: touchTarget, alignItems: 'center', justifyContent: 'center' }, choiceStyle(theme, selected)]}
                >
                  <AppText variant="label" tone={selected ? 'white' : 'navy'}>
                    {label}
                  </AppText>
                </Pressable>
              );
            })}
          </View>
        </Field>
        {spentFor === 'general' ? (
          <AppText variant="small" tone="muted">
            A general council expense is not tied to an event, activity or meeting.
          </AppText>
        ) : options.length === 0 ? (
          <EmptyState
            message={
              spentFor === 'activity'
                ? 'This council has no activities yet.'
                : `No ${spentFor}s are open for expense filing today. Filing opens when the ${spentFor} starts and closes ${EXPENSE_SUBMISSION_GRACE_DAYS} days after it ends.`
            }
          />
        ) : (
          <Field label={SPENT_FOR_PICKER[spentFor].question}>
            <Dropdown
              title={SPENT_FOR_PICKER[spentFor].title}
              placeholder={`Choose ${spentFor === 'meeting' ? 'a' : 'an'} ${spentFor}…`}
              value={reference === '' ? null : reference}
              options={options}
              onChange={setReference}
            />
          </Field>
        )}
        <ToggleSwitch
          label="Long-term Council Asset"
          hint="When the Grand Knight approves this report, the item is added to the council's assets inventory at the report total."
          value={longTermAsset}
          onChange={setLongTermAsset}
        />
        <AppText variant="small" tone="muted">
          Turn this on for equipment the council keeps, such as a grill or a banner. When the Grand Knight approves the report, the item is added to the
          council’s assets inventory at the report total.
        </AppText>
        <ToggleSwitch
          label="⚠️ No receipt (Honor Voucher)"
          hint="The receipt was lost or never given. Leadership sees an Honor Voucher warning on this report."
          value={honorVoucher}
          onChange={setHonorVoucher}
        />
        {honorVoucher ? (
          <Field label="WHY IS THERE NO RECEIPT? (REQUIRED)">
            <AppInput
              value={missingReason}
              onChangeText={setMissingReason}
              maxLength={MISSING_RECEIPT_REASON_MAX_LENGTH}
              multiline
              style={multiline}
              placeholder="e.g. Cash purchase; the stall gave no receipt."
            />
          </Field>
        ) : null}
      </Card>

      {rows.map((row, i) => (
        <Card key={row.key} accent={color.navy}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <AppText variant="title">Receipt {i + 1}</AppText>
            {rows.length > 1 ? <Button title="Remove" variant="secondary" onPress={() => setRows((now) => now.filter((r) => r.key !== row.key))} /> : null}
          </View>
          <ReceiptScanTile
            prefix="receipt"
            title={SCAN_RECEIPT_TITLE}
            hint="Lay the receipt flat in good light so the vendor, date and total are readable."
            photoPath={row.ReceiptPhotoURL || null}
            photoLabel={`Photo of receipt ${i + 1}`}
            onCaptured={(path) => setCell(row.key, 'ReceiptPhotoURL', path)}
            onRemove={() => setCell(row.key, 'ReceiptPhotoURL', '')}
          />
          <Field label="VENDOR NAME">
            <AppInput value={row.VendorName} onChangeText={(v) => setCell(row.key, 'VendorName', v)} maxLength={EXPENSE_VENDOR_MAX_LENGTH} placeholder="e.g. Costco" autoCapitalize="words" />
          </Field>
          <Field label="EXPENSE DATE (YYYY-MM-DD)">
            <AppInput
              value={row.DateOfExpense}
              onChangeText={(v) => setCell(row.key, 'DateOfExpense', v)}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="numbers-and-punctuation"
              maxLength={10}
            />
            <View style={{ flexDirection: 'row', gap: space.md }}>
              <Button title="Today" variant="secondary" style={{ flex: 1 }} onPress={() => setCell(row.key, 'DateOfExpense', today)} />
              <Button title="Yesterday" variant="secondary" style={{ flex: 1 }} onPress={() => setCell(row.key, 'DateOfExpense', addDays(today, -1))} />
            </View>
          </Field>
          <Field label="AMOUNT">
            <AppInput value={row.Amount} onChangeText={(v) => setCell(row.key, 'Amount', v)} keyboardType="decimal-pad" placeholder="0.00" style={{ fontSize: 22 }} />
          </Field>
          <Field label="DESCRIPTION">
            <AppInput
              value={row.ExpenseDescription}
              onChangeText={(v) => setCell(row.key, 'ExpenseDescription', v)}
              maxLength={EXPENSE_DESCRIPTION_MAX_LENGTH}
              multiline
              style={multiline}
              placeholder="What was bought, and for what"
            />
          </Field>
          <ToggleSwitch
            label="Personal, not for the council"
            hint="Your own item on a shared receipt. It stays on the report so the receipt adds up, but the council does not pay it."
            value={row.IsPersonal}
            onChange={(v) => setCell(row.key, 'IsPersonal', v)}
          />
        </Card>
      ))}

      <Button title="+ Add another receipt" variant="secondary" onPress={() => setRows((now) => [...now, keyed(blankExpenseLine(today))])} />

      <Card accent={color.gold}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <AppText variant="label">COUNCIL REIMBURSES</AppText>
          <AppText variant="heading">{money(expenseDraftTotal(rows))}</AppText>
        </View>
        {expenseDraftPersonalTotal(rows) > 0 ? (
          <AppText variant="small" tone="muted">
            Personal, not reimbursed: {money(expenseDraftPersonalTotal(rows))}
          </AppText>
        ) : null}
        {error ? <Notice tone="error" message={error} onDismiss={() => setError(null)} /> : null}
        {locked ? <WindowLock message={locked} /> : null}
        {needsPick ? (
          <AppText variant="small" tone="muted">
            Choose the {spentFor} this report is for, or switch to General.
          </AppText>
        ) : null}
        <Button
          title={locked ? '🔒 Submission locked' : 'Submit for approval'}
          busy={busy === 'Submitted'}
          disabled={busy !== null || locked !== null || needsPick}
          onPress={() => void save('Submitted')}
        />
        <View style={{ flexDirection: 'row', gap: space.md }}>
          <Button title="Cancel" variant="secondary" style={{ flex: 1 }} disabled={busy !== null} onPress={onCancel} />
          <Button title="Save draft" variant="secondary" style={{ flex: 2 }} busy={busy === 'Draft'} disabled={busy !== null || needsPick} onPress={() => void save('Draft')} />
        </View>
      </Card>
    </View>
  );
}

/** A grayed padlock line beside an item outside its submission window (Sprint 5Z-6). */
function WindowLock({ message }: { message: string }) {
  const { color, radius, space } = useTheme();
  return (
    <View
      accessibilityRole="text"
      accessibilityLabel={`Locked. ${message}`}
      style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.md, borderWidth: 1, borderColor: color.line, borderRadius: radius.sm, backgroundColor: color.white }}
    >
      <AppText variant="title" tone="muted">
        🔒
      </AppText>
      <AppText variant="small" tone="muted" style={{ flex: 1 }}>
        {message}
      </AppText>
    </View>
  );
}

// ---- one sheet in the list ------------------------------------------------------------

function ExpenseReportCard({ detail, refs, today, onEdit }: { detail: ExpenseReportDetail; refs: ExpenseReferenceOptions; today: string; onEdit?: () => void }) {
  const { color, space } = useTheme();
  const { report, disbursement } = detail;
  const badge = expenseStatusBadge(report);
  const span = report.Status === 'Draft' ? expenseReferenceSpan(expenseReferenceKey(report), refs) : null;
  const locked = span ? expenseWindowLockMessage(span, today) : null;
  return (
    <Card accent={badge.tone === 'redOutline' ? color.red : report.Status === 'Submitted' ? color.gold : color.navy}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space.md }}>
        <AppText variant="title">
          #{report.id} · {money(detail.total)}
        </AppText>
        <Pill label={badge.label.toUpperCase()} tone={badge.tone} />
      </View>
      <AppText variant="small" tone="muted">
        {expenseReferenceLabel(report, refs)} · {detail.lineItems.length} receipt{detail.lineItems.length === 1 ? '' : 's'}
      </AppText>
      {disbursement ? (
        <AppText variant="small">
          Paid by check {disbursement.CheckNumber} on {formatDate(disbursement.PayoutDate)}.
        </AppText>
      ) : null}
      {locked ? <WindowLock message={locked} /> : null}
      {onEdit ? <Button title={report.RejectionReason ? 'Fix and resubmit' : 'Edit draft'} variant="secondary" onPress={onEdit} /> : null}
    </Card>
  );
}

// ---- the screen ------------------------------------------------------------------------

/** Sprint 6R: the screen closes, back to Home, while the council's feature_expense_reporting flag is off. */
export default function ExpensesScreen() {
  return (
    <FeatureGate flag="feature_expense_reporting">
      <ExpensesDesk />
    </FeatureGate>
  );
}

function ExpensesDesk() {
  const { color, space } = useTheme();
  const user = useUser();
  const today = toIsoDate(new Date());
  const state = useLoad(async () => {
    const [reports, refs] = await Promise.all([db.expenses.listUserReports(user.memberId), listExpenseReferences(db, user.councilId)]);
    return { reports, refs };
  }, [user.memberId, user.councilId]);
  const [editing, setEditing] = useState<ExpenseReportDetail | 'new' | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const { data } = state;
  const returned = (data?.reports ?? []).filter((d) => d.report.Status === 'Draft' && d.report.RejectionReason);

  return (
    <Screen refreshing={state.refreshing} onRefresh={() => void state.reload()}>
      <NavStrip closeLabel="Close expense reports" />
      <AppText variant="heading" accessibilityRole="header">
        My expense reports
      </AppText>
      {state.error ? <Notice tone="error" message={state.error} /> : null}
      {message ? <Notice tone="info" message={message} onDismiss={() => setMessage(null)} /> : null}
      {!data && state.loading ? <Loading /> : null}

      {data && editing ? (
        <ExpenseDraftForm
          key={editing === 'new' ? 'new' : editing.report.id}
          detail={editing === 'new' ? null : editing}
          refs={data.refs}
          today={today}
          onCancel={() => setEditing(null)}
          onSaved={async (saved) => {
            setEditing(null);
            setMessage(
              saved.report.Status === 'Draft'
                ? `Saved draft #${saved.report.id} (${money(saved.total)}). Submit it when your receipts are complete.`
                : `Submitted report #${saved.report.id} for ${money(saved.total)} to your council's leadership.`,
            );
            await state.reload();
          }}
        />
      ) : null}

      {data && !editing ? (
        <>
          {returned.map((d) => (
            <Card key={d.report.id} accent={color.red}>
              <Pill label="RETURNED FOR CHANGES" tone="red" />
              <AppText variant="title">
                Report #{d.report.id} · {money(d.total)}
              </AppText>
              <AppText tone="red">{d.report.RejectionReason}</AppText>
              <Button title="Fix and resubmit" onPress={() => setEditing(d)} />
            </Card>
          ))}
          <Button
            title="New expense report"
            onPress={() => {
              setEditing('new');
              setMessage(null);
            }}
          />
          <Section title="My reports">
            {data.reports.length === 0 ? (
              <EmptyState message="You have not filed any expense reports. Start one to be reimbursed for council purchases." />
            ) : (
              data.reports.map((d) => (
                <ExpenseReportCard key={d.report.id} detail={d} refs={data.refs} today={today} onEdit={d.report.Status === 'Draft' ? () => setEditing(d) : undefined} />
              ))
            )}
          </Section>
        </>
      ) : null}
      <View style={{ height: space.lg }} />
    </Screen>
  );
}
