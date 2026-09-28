// My expense reports, on the phone: file receipts where the money was spent. A draft sheet names the event or
// meeting it was for and holds one card per receipt, each with a "Scan Paper Receipt" camera tile (the photo is
// copied into the app's media folder and its path saved as ReceiptPhotoURL), vendor, date, amount and description.
// The member saves a draft or submits it to the council's leadership, then follows it through Submitted, Approved
// and Reimbursed. A sheet leadership returned shows its reason in red until it is resubmitted. Opened from Home.
import { useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import {
  addDays,
  blankExpenseLine,
  expenseDraftTotal,
  expenseLineDraftFrom,
  expenseLinesFromDrafts,
  expenseReferenceChoices,
  expenseReferenceKey,
  expenseReferenceLabel,
  expenseStatusBadge,
  formatDate,
  listExpenseReferences,
  parseExpenseReferenceKey,
  toIsoDate,
  EXPENSE_DESCRIPTION_MAX_LENGTH,
  EXPENSE_VENDOR_MAX_LENGTH,
  type ExpenseLineDraft,
  type ExpenseReferenceOptions,
  type ExpenseReportDetail,
} from '@kofc/shared';
import { Dropdown } from '@/components/Dropdown';
import { ReceiptScanTile, SCAN_RECEIPT_TITLE } from '@/components/ReceiptScanTile';
import { AppInput, AppText, Button, Card, EmptyState, Field, Loading, Notice, Pill, Screen, Section } from '@/components/ui';
import { useUser } from '@/lib/app-context';
import { color, space } from '@/lib/theme';
import { describeError, useLoad } from '@/lib/use-async';
import { db } from '@/services/db';

const money = (n: number) => `$${n.toFixed(2)}`;
const multiline = { minHeight: 72, textAlignVertical: 'top' as const, paddingTop: space.md };

type Row = ExpenseLineDraft & { key: number };

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
  const user = useUser();
  const nextKey = useRef(0);
  const keyed = (line: ExpenseLineDraft): Row => ({ ...line, key: nextKey.current++ });
  const [reference, setReference] = useState(() => (detail ? expenseReferenceKey(detail.report) : ''));
  const [rows, setRows] = useState<Row[]>(() =>
    detail && detail.lineItems.length > 0 ? detail.lineItems.map((li) => keyed(expenseLineDraftFrom(li))) : [keyed(blankExpenseLine(today))],
  );
  const [busy, setBusy] = useState<'Draft' | 'Submitted' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const options = useMemo(
    () => [
      { value: '', label: 'General council expense' },
      ...expenseReferenceChoices(refs).map((c) => ({ value: c.key, label: `${c.group === 'Events' ? 'Event' : 'Meeting'}: ${c.label}` })),
    ],
    [refs],
  );

  const setCell = (key: number, field: keyof ExpenseLineDraft, value: string) =>
    setRows((now) => now.map((r) => (r.key === key ? { ...r, [field]: value } : r)));

  const save = async (status: 'Draft' | 'Submitted') => {
    setBusy(status);
    setError(null);
    try {
      const items = expenseLinesFromDrafts(rows);
      const saved = await db.expenses.submitReport(user.memberId, { id: detail?.report.id ?? null, Status: status, ...parseExpenseReferenceKey(reference) }, items);
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
          <Dropdown title="Event or meeting" value={reference} options={options} onChange={setReference} />
        </Field>
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
        </Card>
      ))}

      <Button title="+ Add another receipt" variant="secondary" onPress={() => setRows((now) => [...now, keyed(blankExpenseLine(today))])} />

      <Card accent={color.gold}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <AppText variant="label">REPORT TOTAL</AppText>
          <AppText variant="heading">{money(expenseDraftTotal(rows))}</AppText>
        </View>
        {error ? <Notice tone="error" message={error} onDismiss={() => setError(null)} /> : null}
        <Button title="Submit for approval" busy={busy === 'Submitted'} disabled={busy !== null} onPress={() => void save('Submitted')} />
        <View style={{ flexDirection: 'row', gap: space.md }}>
          <Button title="Cancel" variant="secondary" style={{ flex: 1 }} disabled={busy !== null} onPress={onCancel} />
          <Button title="Save draft" variant="secondary" style={{ flex: 2 }} busy={busy === 'Draft'} disabled={busy !== null} onPress={() => void save('Draft')} />
        </View>
      </Card>
    </View>
  );
}

// ---- one sheet in the list ------------------------------------------------------------

function ExpenseReportCard({ detail, refs, onEdit }: { detail: ExpenseReportDetail; refs: ExpenseReferenceOptions; onEdit?: () => void }) {
  const { report, disbursement } = detail;
  const badge = expenseStatusBadge(report);
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
      {onEdit ? <Button title={report.RejectionReason ? 'Fix and resubmit' : 'Edit draft'} variant="secondary" onPress={onEdit} /> : null}
    </Card>
  );
}

// ---- the screen ------------------------------------------------------------------------

export default function ExpensesScreen() {
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
                <ExpenseReportCard key={d.report.id} detail={d} refs={data.refs} onEdit={d.report.Status === 'Draft' ? () => setEditing(d) : undefined} />
              ))
            )}
          </Section>
        </>
      ) : null}
      <View style={{ height: space.lg }} />
    </Screen>
  );
}
