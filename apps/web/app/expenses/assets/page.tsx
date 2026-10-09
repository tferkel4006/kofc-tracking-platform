'use client';
// Council Assets (Sprint 6P): the asset form and the assets inventory. When the Grand Knight counter-signs a sheet marked
// "This item is a long-term Council Asset" on the Authorization Desk, the workflow engine writes its CouncilAssetsInventory
// row and the desk opens this page at ?asset=<id>. The name and cost basis come from the sheet; the approver adds the
// serial number, where the item is kept and notes (expenses.updateAssetRecord). Without ?asset the page lists the
// inventory. Open to the council's expense leadership and its Grand Knight (canManageCouncilAssets); the drivers check
// assertMayManageCouncilAssets.
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import {
  ASSET_LOCATION_MAX_LENGTH,
  ASSET_NAME_MAX_LENGTH,
  ASSET_NOTES_MAX_LENGTH,
  ASSET_SERIAL_MAX_LENGTH,
  assetFormPath,
  canManageCouncilAssets,
  COUNCIL_ASSET_STATUSES,
  describeError,
  formatDate,
  type CouncilAssetsInventory,
  type CouncilAssetStatus,
} from '@kofc/shared';
import { CouncilSelect, RequireArea, useCouncilScope } from '@/components/CouncilScope';
import { Button, Empty, Field, Input, Notice, PageTitle, Panel, Pill, Select, Table, Td, Textarea } from '@/components/ui';
import { formatMoney } from '@/lib/format';
import { useUser } from '@/lib/session';
import { useLoad } from '@/lib/use-load';
import { db } from '@/services/db';

const STATUS_LABELS: Record<CouncilAssetStatus, string> = { ACTIVE: 'Active', DISPOSED: 'Disposed', LOST: 'Lost' };

const purchaseDay = (asset: CouncilAssetsInventory) => formatDate(asset.purchase_date.slice(0, 10));

function AssetForm({ asset, fromApproval }: { asset: CouncilAssetsInventory; fromApproval: boolean }) {
  const user = useUser();
  const [name, setName] = useState(asset.asset_name);
  const [status, setStatus] = useState<CouncilAssetStatus>(asset.current_status);
  const [serial, setSerial] = useState(asset.serial_number ?? '');
  const [location, setLocation] = useState(asset.storage_location ?? '');
  const [notes, setNotes] = useState(asset.notes ?? '');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'error' | 'info'; text: string } | null>(null);

  const save = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const saved = await db.expenses.updateAssetRecord(user.memberId, asset.id, {
        asset_name: name,
        current_status: status,
        serial_number: serial,
        storage_location: location,
        notes,
      });
      setMessage({ tone: 'info', text: `Saved the details of ${saved.asset_name}.` });
    } catch (err) {
      setMessage({ tone: 'error', text: describeError(err) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Panel title="Asset Management">
      <div className="flex flex-col gap-4">
        {fromApproval ? (
          <Notice tone="info">
            Expense report #{asset.original_expense_id} is approved and was entered as a council asset. Add the serial number, where the item is
            kept and any notes, then save.
          </Notice>
        ) : null}
        {message ? (
          <Notice tone={message.tone} onDismiss={() => setMessage(null)}>
            {message.text}
          </Notice>
        ) : null}
        <dl className="grid gap-3 rounded border border-line p-3 text-sm sm:grid-cols-3">
          <div>
            <dt className="font-bold">Cost basis</dt>
            <dd>{formatMoney(asset.cost_basis)}</dd>
          </div>
          <div>
            <dt className="font-bold">Purchase date</dt>
            <dd>{purchaseDay(asset)}</dd>
          </div>
          <div>
            <dt className="font-bold">From expense report</dt>
            <dd>{asset.original_expense_id ? `#${asset.original_expense_id}` : 'None'}</dd>
          </div>
        </dl>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Asset name">{(id) => <Input id={id} value={name} maxLength={ASSET_NAME_MAX_LENGTH} onChange={(e) => setName(e.target.value)} />}</Field>
          <Field label="Status">
            {(id) => (
              <Select id={id} value={status} onChange={(e) => setStatus(e.target.value as CouncilAssetStatus)}>
                {COUNCIL_ASSET_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABELS[s]}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Serial number">
            {(id) => <Input id={id} value={serial} maxLength={ASSET_SERIAL_MAX_LENGTH} onChange={(e) => setSerial(e.target.value)} />}
          </Field>
          <Field label="Storage location">
            {(id) => (
              <Input id={id} value={location} maxLength={ASSET_LOCATION_MAX_LENGTH} placeholder="For example: parish hall closet" onChange={(e) => setLocation(e.target.value)} />
            )}
          </Field>
        </div>
        <Field label="Notes">{(id) => <Textarea id={id} rows={4} value={notes} maxLength={ASSET_NOTES_MAX_LENGTH} onChange={(e) => setNotes(e.target.value)} />}</Field>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => void save()} disabled={busy}>
            {busy ? 'Saving…' : 'Save asset details'}
          </Button>
          <Link href="/expenses/assets" className="self-center text-sm font-bold underline">
            Back to the assets inventory
          </Link>
        </div>
      </div>
    </Panel>
  );
}

function Inventory({ councilId }: { councilId: number }) {
  const user = useUser();
  const router = useRouter();
  const list = useLoad(() => db.expenses.listAssetsInventory(user.memberId, councilId), [user.memberId, councilId]);
  return (
    <Panel title="Assets Inventory">
      {list.error ? <Notice tone="error">{list.error}</Notice> : null}
      {list.data && list.data.length === 0 ? <Empty>No council assets yet. An approved expense report marked as a long-term asset adds one.</Empty> : null}
      {list.data && list.data.length > 0 ? (
        <Table caption="Council assets" head={['Asset', 'Purchased', 'Cost basis', 'Serial number', 'Kept at', 'Status', '']}>
          {list.data.map((a) => (
            <tr key={a.id}>
              <Td>{a.asset_name}</Td>
              <Td>{purchaseDay(a)}</Td>
              <Td>{formatMoney(a.cost_basis)}</Td>
              <Td>{a.serial_number ?? '—'}</Td>
              <Td>{a.storage_location ?? '—'}</Td>
              <Td>
                <Pill tone={a.current_status === 'ACTIVE' ? 'navy' : 'outline'}>{STATUS_LABELS[a.current_status]}</Pill>
              </Td>
              <Td>
                <Button size="sm" variant="secondary" onClick={() => router.push(assetFormPath(a.id))}>
                  Edit
                </Button>
              </Td>
            </tr>
          ))}
        </Table>
      ) : null}
    </Panel>
  );
}

function CouncilAssets() {
  const user = useUser();
  const scope = useCouncilScope();
  const params = useSearchParams();
  const assetId = Number(params.get('asset')) || null;
  const fromApproval = params.get('from') === 'approval';
  const asset = useLoad(() => (assetId === null ? Promise.resolve(null) : db.expenses.getAssetRecord(user.memberId, assetId)), [assetId, user.memberId]);
  const allowed = canManageCouncilAssets(user, asset.data?.council_id ?? scope.councilId);

  return (
    <>
      <PageTitle actions={assetId === null ? <CouncilSelect scope={scope} /> : undefined}>Council Assets</PageTitle>
      {!allowed ? (
        <Notice tone="error">Only this council&apos;s Grand Knight, Admins, Financial Secretary and Treasurer, or a Super Admin, manage its assets.</Notice>
      ) : assetId === null ? (
        <Inventory councilId={scope.councilId} />
      ) : (
        <>
          {asset.error ? <Notice tone="error">{asset.error}</Notice> : null}
          {asset.loading && !asset.data ? <p className="text-sm text-muted">Loading the asset…</p> : null}
          {asset.data ? <AssetForm key={asset.data.id} asset={asset.data} fromApproval={fromApproval} /> : null}
        </>
      )}
    </>
  );
}

export default function CouncilAssetsPage() {
  return (
    <RequireArea area="expenses">
      <Suspense fallback={<p className="text-sm text-muted">Loading…</p>}>
        <CouncilAssets />
      </Suspense>
    </RequireArea>
  );
}
