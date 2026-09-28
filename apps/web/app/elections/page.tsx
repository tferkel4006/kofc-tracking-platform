'use client';
// Officer Nominations Desk (Sprint 5U): a dense ballot grid of the council's elected offices. While a seat takes
// nominations (May 1-31, or before a mid-year election closes) any active member picks its card, chooses a brother
// Knight and submits the nomination (elections.submitNomination). A Grand Knight nominee who has never served as
// Deputy Grand Knight or Grand Knight is still recorded, with a Supreme Council dispensation warning beside his name.
// Outside every window the page shows only the placeholder notice; the drivers refuse late nominations
// (NOMINATIONS_WINDOW_CLOSED) whatever the screen shows.
import { useState } from 'react';
import { describeError, formatTimestamp, GRAND_KNIGHT_ROLE, type BallotSeat, type OfficerSeat } from '@kofc/shared';
import { CouncilSelect, RequireArea, useCouncilScope } from '@/components/CouncilScope';
import { Button, cx, Field, Notice, PageTitle, Pill, Select } from '@/components/ui';
import { formatPersonName } from '@/lib/format';
import { useUser } from '@/lib/session';
import { useLoad } from '@/lib/use-load';
import { db } from '@/services/db';

const NOMINATIONS_CLOSED_TEXT = 'The regular officer nomination window opens annually on May 1st.';

/** Beside a Grand Knight nominee stored with IsEligible = 0. Gold is the manual's priority-alert fill. */
function DispensationBadge() {
  return (
    <span title="Has not served as Deputy Grand Knight or Grand Knight">
      <Pill tone="gold">Requires Supreme Council Dispensation</Pill>
    </span>
  );
}

function SeatStatus({ ballot }: { ballot: BallotSeat | undefined }) {
  if (!ballot) return <Pill tone="outline">Not on ballot</Pill>;
  if (ballot.ballot.IsMidYearElection === 1) {
    return <Pill tone="red">Mid-year · closes {formatTimestamp(ballot.ballot.NominationsCloseAt)}</Pill>;
  }
  return ballot.nominationsOpen ? <Pill tone="navy">Open</Pill> : <Pill tone="outline">Closed</Pill>;
}

/** One elected office in the grid; open seats are buttons that select the card for the nomination form. */
function SeatCard({ seat, ballot, selected, onSelect }: { seat: OfficerSeat; ballot: BallotSeat | undefined; selected: boolean; onSelect: () => void }) {
  const open = ballot?.nominationsOpen === true;
  const nominees = ballot?.nominees ?? [];
  return (
    <li
      className={cx(
        'flex flex-col gap-2 rounded border bg-white p-3 text-sm',
        selected ? 'border-navy border-t-8 border-t-gold' : 'border-line border-t-8',
        !open && 'text-muted',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <h2 className="font-serif text-base font-bold text-navy">{seat.roleName}</h2>
        <SeatStatus ballot={ballot} />
      </div>
      <p className="text-xs">
        Sitting: {seat.holder ? `${seat.holder.firstName} ${seat.holder.lastName}` : <span className="italic">vacant</span>}
      </p>
      {open ? (
        nominees.length ? (
          <ol className="flex flex-col gap-1 border-t border-line pt-2">
            {nominees.map((n, i) => (
              <li key={n.nomination.id} className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="font-bold text-navy">
                  {i + 1}. {n.firstName} {n.lastName}
                </span>
                {n.nomination.IsEligible === 0 ? <DispensationBadge /> : null}
                <span className="w-full text-xs text-muted">nominated by {n.nominatedByName}</span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="border-t border-line pt-2 text-xs italic">No nominations yet.</p>
        )
      ) : null}
      {open ? (
        <Button size="sm" variant={selected ? 'primary' : 'secondary'} aria-pressed={selected} onClick={onSelect} className="mt-auto self-start">
          {selected ? 'Selected' : 'Nominate'}
        </Button>
      ) : null}
    </li>
  );
}

function NominationForm({ councilId, seat, onSaved }: { councilId: number; seat: BallotSeat; onSaved: (text: string) => Promise<void> }) {
  const user = useUser();
  const members = useLoad(() => db.members.listByCouncil(councilId, { activeOnly: true }), [councilId]);
  const [nomineeId, setNomineeId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const already = new Set(seat.nominees.map((n) => n.nomination.NomineeMemberID));

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const nominee = members.data?.find((m) => m.id === Number(nomineeId));
      const result = await db.elections.submitNomination(user.memberId, councilId, seat.roleId, Number(nomineeId));
      const name = nominee ? `${nominee.MemberFirstName} ${nominee.MemberLastName}` : `Member ${nomineeId}`;
      setNomineeId('');
      await onSaved(
        `Nominated ${name} for ${seat.roleName} (${seat.fraternalYear}); ${result.tally} nomination${result.tally === 1 ? '' : 's'} for the seat so far.` +
          (result.eligible ? '' : ' This nominee has not served as Deputy Grand Knight or Grand Knight, so the candidacy requires Supreme Council dispensation.'),
      );
    } catch (err) {
      setError(describeError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section aria-label={`Nominate for ${seat.roleName}`} className="rounded border-2 border-navy border-l-8 border-l-gold bg-white p-4">
      <h2 className="mb-3 font-serif text-lg font-bold">Nominate for {seat.roleName}</h2>
      {error ? (
        <div className="mb-3">
          <Notice tone="error" onDismiss={() => setError(null)}>
            {error}
          </Notice>
        </div>
      ) : null}
      {members.error ? <Notice tone="error">{members.error}</Notice> : null}
      <div className="flex flex-wrap items-end gap-3">
        <Field label="Nominee" className="w-80" hint="Active members of the council">
          {(id) => (
            <Select id={id} value={nomineeId} onChange={(e) => setNomineeId(e.target.value)} disabled={!members.data}>
              <option value="">Choose a brother Knight…</option>
              {(members.data ?? []).map((m) => (
                <option key={m.id} value={m.id} disabled={already.has(m.id)}>
                  {formatPersonName(m.MemberFirstName, m.MemberLastName)}
                  {already.has(m.id) ? ' (already nominated)' : ''}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Button disabled={busy || nomineeId === ''} onClick={() => void submit()}>
          {busy ? 'Submitting…' : 'Submit nomination'}
        </Button>
      </div>
      {seat.roleName === GRAND_KNIGHT_ROLE ? (
        <p className="mt-3 text-xs text-muted">
          A Grand Knight nominee should have served as Deputy Grand Knight or Grand Knight. Anyone else is still recorded, marked as requiring Supreme
          Council dispensation.
        </p>
      ) : null}
    </section>
  );
}

/** Outside every nomination window: a quiet placeholder, in the manual's Arial. */
function WindowClosed() {
  return (
    <div role="status" className="mx-auto mt-10 flex max-w-xl flex-col items-center gap-3 rounded border-2 border-navy border-t-8 border-t-gold bg-white px-8 py-10 text-center">
      <p className="font-serif text-xl font-bold">Officer nominations are closed</p>
      <p className="font-sans text-base text-navy">
        {NOMINATIONS_CLOSED_TEXT}
      </p>
    </div>
  );
}

function NominationsDesk() {
  const scope = useCouncilScope();
  const councilId = scope.councilId;
  const data = useLoad(async () => {
    const [seats, ballot] = await Promise.all([db.elections.listOfficerSeats(councilId), db.elections.listBallotConfig(councilId)]);
    return { seats: seats.filter((s) => s.kind === 'elected'), ballot };
  }, [councilId]);
  const [selectedRoleId, setSelectedRoleId] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const title = <PageTitle actions={<CouncilSelect scope={scope} />}>Officer Nominations Desk</PageTitle>;
  if (data.error) {
    return (
      <>
        {title}
        <Notice tone="error">{data.error}</Notice>
      </>
    );
  }
  if (!data.data) {
    return (
      <>
        {title}
        <p className="text-sm text-muted">Loading the ballot…</p>
      </>
    );
  }

  const { seats, ballot } = data.data;
  const openSeats = ballot.filter((b) => b.nominationsOpen);
  if (openSeats.length === 0) {
    return (
      <>
        {title}
        <WindowClosed />
      </>
    );
  }

  const selected = openSeats.find((b) => b.roleId === selectedRoleId) ?? null;
  const midYear = openSeats.filter((b) => b.ballot.IsMidYearElection === 1);
  const regular = openSeats.filter((b) => b.ballot.IsMidYearElection !== 1);

  return (
    <>
      {title}
      <div className="mb-4 flex flex-col gap-2">
        {regular.length ? (
          <p className="text-sm">
            <span className="font-bold">Regular election, term {regular[0].fraternalYear}.</span> Nominations run May 1 through May 31.
          </p>
        ) : null}
        {midYear.map((b) => (
          <p key={b.roleId} className="text-sm">
            <span className="font-bold">Mid-year election for {b.roleName}, term {b.fraternalYear}.</span> Nominations close{' '}
            {formatTimestamp(b.ballot.NominationsCloseAt)}.
          </p>
        ))}
        <p className="text-xs text-muted">Pick an open office, then choose the brother Knight you are nominating.</p>
      </div>
      {message ? (
        <div className="mb-4">
          <Notice tone="info" onDismiss={() => setMessage(null)}>
            {message}
          </Notice>
        </div>
      ) : null}

      <ul aria-label="Elected offices" className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {seats.map((seat) => (
          <SeatCard
            key={seat.roleId}
            seat={seat}
            ballot={ballot.find((b) => b.roleId === seat.roleId)}
            selected={seat.roleId === selected?.roleId}
            onSelect={() => setSelectedRoleId(seat.roleId)}
          />
        ))}
      </ul>

      {selected ? (
        <NominationForm
          key={`${councilId}-${selected.roleId}`}
          councilId={councilId}
          seat={selected}
          onSaved={async (text) => {
            setMessage(text);
            await data.reload();
          }}
        />
      ) : null}
    </>
  );
}

export default function ElectionsPage() {
  return (
    <RequireArea area="elections">
      <NominationsDesk />
    </RequireArea>
  );
}
