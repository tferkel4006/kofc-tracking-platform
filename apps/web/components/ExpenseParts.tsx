'use client';
// Pieces shared by the three expense screens (My Expense Reports, the audit queue and check disbursements):
// the status chip, the receipt link and the read-only receipt grid.
import { expenseStatusBadge, type ExpenseLineItem, type ExpenseReport } from '@kofc/shared';
import { Pill, Table, Td } from '@/components/ui';
import { formatFullDate, formatMoney, minutesFileName } from '@/lib/format';
import { photoName, photoSrc } from '@/lib/media';

export function ExpenseStatusPill({ report }: { report: Pick<ExpenseReport, 'Status' | 'RejectionReason'> }) {
  const { label, tone } = expenseStatusBadge(report);
  return <Pill tone={tone}>{label}</Pill>;
}

/**
 * A stored receipt reference. Files attached in the portal are browser blob links with the file name after the #
 * (as meeting minutes are); a phone's file:// path exists only on that phone, so it is named but not linked.
 */
export function ReceiptLink({ url }: { url: string | null | undefined }) {
  if (!url) return <span className="text-muted">None</span>;
  const name = url.includes('#') ? (minutesFileName(url) ?? url) : photoName(url);
  const src = photoSrc(url);
  if (!src) {
    return (
      <span className="text-xs" title={url}>
        {name} <span className="text-muted">(on the member&apos;s phone)</span>
      </span>
    );
  }
  return (
    <a href={src} target="_blank" rel="noreferrer" className="font-bold underline">
      {name}
    </a>
  );
}

/** A sheet's receipts, oldest first as the driver returns them, with their total. */
export function ExpenseLineItemsTable({ items, total, caption }: { items: readonly ExpenseLineItem[]; total: number; caption: string }) {
  return (
    <Table caption={caption} head={['Date', 'Vendor', 'Description', 'Receipt', 'Amount']}>
      {items.map((li) => (
        <tr key={li.id}>
          <Td className="whitespace-nowrap">{formatFullDate(li.DateOfExpense)}</Td>
          <Td className="font-bold">{li.VendorName}</Td>
          <Td>{li.ExpenseDescription}</Td>
          <Td>
            <ReceiptLink url={li.ReceiptPhotoURL} />
          </Td>
          <Td className="whitespace-nowrap text-right">{formatMoney(li.Amount)}</Td>
        </tr>
      ))}
      <tr>
        <Td colSpan={4} className="text-right text-xs font-bold uppercase tracking-wide">
          Total
        </Td>
        <Td className="whitespace-nowrap text-right font-bold">{formatMoney(total)}</Td>
      </tr>
    </Table>
  );
}
