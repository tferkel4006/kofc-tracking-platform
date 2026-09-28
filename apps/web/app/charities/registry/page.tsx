'use client';
// Global Charities Registry (Sprint 5V): the registry every council shares, for Admins and Super Admins
// (canManageCharityRegistry). A state picker, defaulting to the council's own state, lists the council's
// "Suggested Local Charities" (charities.listSuggestedLocal: entries in that state the council is not connected to,
// Catholic ones first), each with a Connect button (charities.connectCouncilToCharity). A search box filters the whole
// registry by name or EIN, with a type filter. When a charity is missing, the "add a charity" form mints a new entry
// (charities.addGlobalCharity), filed under one of the six core types; a duplicate is refused naming the entry.
import { useState } from 'react';
import {
  CHARITY_TYPES,
  canConnectCouncilCharity,
  charityDraftFrom,
  charityFromDraft,
  charitySearchFromText,
  describeError,
  US_STATE_CODES,
  type CharityDraft,
  type CharitySearchFilters,
  type GlobalCharityRegistry,
} from '@kofc/shared';
import { CharityRecordFields, CharitySummary, StateSelect } from '@/components/CharityParts';
import { CouncilSelect, RequireArea, useCouncilScope } from '@/components/CouncilScope';
import { Button, Empty, Field, Input, Notice, PageTitle, Panel, Pill, Select, Table, Td } from '@/components/ui';
import { useUser } from '@/lib/session';
import { useLoad } from '@/lib/use-load';
import { db } from '@/services/db';

type Message = { tone: 'error' | 'info'; text: string };

const isStateCode = (code: string | undefined): code is string => (US_STATE_CODES as readonly string[]).includes((code ?? '').trim().toUpperCase());

function Registry() {
  const user = useUser();
  const scope = useCouncilScope();
  const councilId = scope.councilId;
  const council = scope.councils.find((c) => c.id === councilId);
  const councilState = isStateCode(council?.State) ? council.State.trim().toUpperCase() : 'OR';
  const [chosenState, setChosenState] = useState<string | null>(null);
  const state = chosenState ?? councilState;
  const mayConnect = canConnectCouncilCharity(user, councilId);

  const suggestions = useLoad(() => db.charities.listSuggestedLocal(user.memberId, councilId, state), [user.memberId, councilId, state]);
  const ledger = useLoad(() => (mayConnect ? db.charities.listCouncilLedger(user.memberId, councilId) : Promise.resolve([])), [user.memberId, councilId, mayConnect]);
  const linked = new Set((ledger.data ?? []).map((e) => e.charity.id));

  const [searchText, setSearchText] = useState('');
  const [searchType, setSearchType] = useState('');
  const [filters, setFilters] = useState<CharitySearchFilters>({});
  const results = useLoad(() => db.charities.searchGlobalRegistry(user.memberId, filters), [user.memberId, filters]);

  const [adding, setAdding] = useState<CharityDraft | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<Message | null>(null);

  const reloadAll = async () => {
    await Promise.all([suggestions.reload(), ledger.reload(), results.reload()]);
  };

  const connect = async (charity: GlobalCharityRegistry) => {
    setMessage(null);
    try {
      await db.charities.connectCouncilToCharity(user.memberId, councilId, charity.id);
      setMessage({ tone: 'info', text: `${charity.Name} is now connected to ${council?.CouncilName ?? 'the council'}.` });
      await reloadAll();
    } catch (err) {
      setMessage({ tone: 'error', text: describeError(err) });
    }
  };

  const add = async (draft: CharityDraft) => {
    setBusy(true);
    setMessage(null);
    try {
      const saved = await db.charities.addGlobalCharity(user.memberId, charityFromDraft(draft));
      setAdding(null);
      setMessage({ tone: 'info', text: `${saved.Name} (${saved.State}) was added to the global registry.` });
      setFilters({ name: saved.Name });
      setSearchText(saved.Name);
      setSearchType('');
      await suggestions.reload();
    } catch (err) {
      setMessage({ tone: 'error', text: describeError(err) });
    } finally {
      setBusy(false);
    }
  };

  const connectCell = (charity: GlobalCharityRegistry) =>
    !mayConnect ? null : linked.has(charity.id) ? (
      <Pill tone="navy">Connected</Pill>
    ) : (
      <Button size="sm" variant="secondary" onClick={() => void connect(charity)}>
        Connect
      </Button>
    );

  const rows = results.data ?? [];
  const suggested = suggestions.data ?? [];

  return (
    <>
      <PageTitle actions={<CouncilSelect scope={scope} />}>Global Charities Registry</PageTitle>
      <div className="flex flex-col gap-4">
        {message ? (
          <Notice tone={message.tone} onDismiss={() => setMessage(null)}>
            {message.text}
          </Notice>
        ) : null}

        <Panel
          title={`Suggested local charities (${suggested.length})`}
          actions={
            <Field label="State" className="w-28">
              {(id) => <StateSelect id={id} value={state} onChange={setChosenState} />}
            </Field>
          }
        >
          {suggestions.error ? <Notice tone="error">{suggestions.error}</Notice> : null}
          {suggestions.data && suggested.length === 0 ? (
            <Empty>No registry charity in {state} is waiting to be connected. Search the registry below, or add a new charity.</Empty>
          ) : (
            <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 2xl:grid-cols-3" aria-label={`Charities in ${state} not yet connected to the council`}>
              {suggested.map((c) => (
                <li key={c.id} className="flex items-start justify-between gap-3 rounded border border-line border-l-4 border-l-gold bg-white p-3">
                  <CharitySummary charity={c} />
                  {connectCell(c)}
                </li>
              ))}
            </ul>
          )}
          <p className="mt-2 text-xs text-muted">Catholic charities are listed first, then A to Z.</p>
        </Panel>

        <Panel title="Search the registry">
          <form
            className="flex flex-wrap items-end gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              setFilters({ ...charitySearchFromText(searchText), charityType: searchType || null });
            }}
          >
            <Field label="Name or EIN" className="min-w-64 flex-1">
              {(id) => <Input id={id} type="search" value={searchText} onChange={(e) => setSearchText(e.target.value)} placeholder="e.g. Vincent, or 93-0386970" />}
            </Field>
            <Field label="Type" className="w-56">
              {(id) => (
                <Select id={id} value={searchType} onChange={(e) => setSearchType(e.target.value)}>
                  <option value="">Every type</option>
                  {CHARITY_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Button type="submit">Search</Button>
            <Button
              variant="secondary"
              onClick={() => {
                setSearchText('');
                setSearchType('');
                setFilters({});
              }}
            >
              Clear
            </Button>
          </form>

          <div className="mt-4">
            {results.error ? <Notice tone="error">{results.error}</Notice> : null}
            {results.loading && !results.data ? (
              <p className="text-sm text-muted">Searching…</p>
            ) : rows.length === 0 ? (
              <Empty>No charity in the registry matches. If it is missing, add it below.</Empty>
            ) : (
              <Table caption="Registry charities matching the search" head={['Charity', 'Type', 'State', 'EIN', 'Catholic', '']}>
                {rows.map((c) => (
                  <tr key={c.id}>
                    <Td className="font-bold">
                      {c.Name}
                      <span className="block text-xs font-normal text-muted">{c.Description}</span>
                    </Td>
                    <Td>{c.CharityType}</Td>
                    <Td>{c.State}</Td>
                    <Td className="whitespace-nowrap">{c.EIN ?? <span className="text-muted">None</span>}</Td>
                    <Td>{c.IsCatholic ? 'Yes' : 'No'}</Td>
                    <Td className="text-right">{connectCell(c)}</Td>
                  </tr>
                ))}
              </Table>
            )}
          </div>
        </Panel>

        <Panel
          title="Add a charity to the global registry"
          actions={
            adding ? null : (
              <Button size="sm" onClick={() => setAdding(charityDraftFrom(null, { Name: filters.name ?? '', State: state }))}>
                Can&apos;t find it? Add a new charity
              </Button>
            )
          }
        >
          {adding ? (
            <form
              className="flex flex-col gap-3"
              onSubmit={(e) => {
                e.preventDefault();
                void add(adding);
              }}
            >
              <CharityRecordFields draft={adding} onChange={setAdding} />
              <div className="flex gap-3">
                <Button type="submit" disabled={busy}>
                  {busy ? 'Adding…' : 'Add to the registry'}
                </Button>
                <Button variant="secondary" onClick={() => setAdding(null)}>
                  Cancel
                </Button>
              </div>
              <p className="text-xs text-muted">Every council shares the registry. A charity with the same EIN, or the same name in the same state, is already registered.</p>
            </form>
          ) : (
            <p className="text-sm text-muted">Search first; if the charity is not in the registry, add it here for every council to use.</p>
          )}
        </Panel>
      </div>
    </>
  );
}

export default function CharityRegistryPage() {
  return (
    <RequireArea area="charities/registry">
      <Registry />
    </RequireArea>
  );
}
