'use client';
// Appointed Leadership Matrix (Sprint 5U): the Grand Knight's desk, open only to the council's sitting Grand Knight
// and Super Admins (canAppointOfficers; the drivers refuse anyone else with GRAND_KNIGHT_REQUIRED).
//   - Appointed Positions Tracker: the Financial Secretary, Chaplain, Lecturer and the four ministry directors. An empty
//     seat is filled at once with elections.assignAppointedRole; an occupied one waits for its holder's abdication.
//   - Mid-Year Vacancies Ledger: empty or abdicated trustee seats (elections.listVacancies), each filled for the rest
//     of the term with "Appoint Replacement".
//   - Demo simulator: concludes the fraternal year with the real elections.concludeFraternalYear, so officers can watch
//     the trustee ladder climb. Only on the in-memory demo driver, only for Super Admins, and only after a
//     confirmation that names who moves to which chair.
import { useEffect, useRef, useState } from 'react';
import {
  chairMoves,
  describeError,
  GRAND_KNIGHT_ROLE,
  isSuperAdmin,
  planConclusionFromSeats,
  withNewMemberBadge,
  type FraternalYearConclusion,
  type Member,
  type OfficerSeat,
  type SeatVacancy,
} from '@kofc/shared';
import { CouncilSelect, RequireArea, useCouncilScope } from '@/components/CouncilScope';
import { Button, Empty, Notice, PageTitle, Panel, Pill, Select, Table, Td } from '@/components/ui';
import { formatFullDate, formatPersonName } from '@/lib/format';
import { useUser } from '@/lib/session';
import { useLoad } from '@/lib/use-load';
import { db } from '@/services/db';

/** The simulator exists only for demos on the in-memory driver; it never renders against the production database. */
const IS_MEMORY_DRIVER = (process.env.NEXT_PUBLIC_DATA_DRIVER ?? 'memory') === 'memory';

interface DeskData {
  /** The council the rows were loaded for; every write goes to it. */
  councilId: number;
  seats: OfficerSeat[];
  vacancies: SeatVacancy[];
  members: Member[];
}

type Act = (action: () => Promise<string>) => Promise<boolean>;

const holderName = (seat: OfficerSeat) => (seat.holder ? `${seat.holder.firstName} ${seat.holder.lastName}` : null);

function MemberSelect({
  members,
  value,
  onChange,
  label,
  exclude = new Set<number>(),
}: {
  members: Member[];
  value: string;
  onChange: (value: string) => void;
  label: string;
  exclude?: ReadonlySet<number>;
}) {
  return (
    <Select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} className="min-w-56">
      <option value="">Choose a brother Knight…</option>
      {members.map((m) => (
        <option key={m.id} value={m.id} disabled={exclude.has(m.id)}>
          {withNewMemberBadge(formatPersonName(m.MemberFirstName, m.MemberLastName), m, new Date())}
        </option>
      ))}
    </Select>
  );
}

/** One vacant office's inline appointment: pick a member, then appoint. */
function AppointControl({ seat, data, act, buttonLabel }: { seat: { roleId: number; roleName: string }; data: DeskData; act: Act; buttonLabel: string }) {
  const user = useUser();
  const [memberId, setMemberId] = useState('');
  const [busy, setBusy] = useState(false);
  // A member sits in at most one trustee chair (the drivers refuse a second with INVALID_INPUT).
  const sittingTrustees = new Set(data.seats.filter((s) => s.kind === 'trustee' && s.holder).map((s) => s.holder!.memberId));
  const exclude = seat.roleName.startsWith('Trustee') ? sittingTrustees : new Set<number>();

  const appoint = async () => {
    setBusy(true);
    const member = data.members.find((m) => m.id === Number(memberId));
    const done = await act(async () => {
      await db.elections.assignAppointedRole(user.memberId, data.councilId, seat.roleId, Number(memberId));
      return `Appointed ${member ? `${member.MemberFirstName} ${member.MemberLastName}` : `member ${memberId}`} as ${seat.roleName}.`;
    });
    setBusy(false);
    if (done) setMemberId('');
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <MemberSelect members={data.members} value={memberId} onChange={setMemberId} label={`Appointee for ${seat.roleName}`} exclude={exclude} />
      <Button size="sm" disabled={busy || memberId === ''} onClick={() => void appoint()}>
        {busy ? 'Appointing…' : buttonLabel}
      </Button>
    </div>
  );
}

function AppointedPositionsTracker({ data, act }: { data: DeskData; act: Act }) {
  const appointed = data.seats.filter((s) => s.kind === 'appointed');
  return (
    <Panel title="Appointed Positions Tracker">
      <p className="mb-3 text-xs text-muted">
        The Grand Knight appoints these offices; they are never on the ballot. An occupied seat can be reassigned once its holder&apos;s abdication is
        recorded.
      </p>
      <Table caption="Appointed council offices" head={['Office', 'Holder', 'Since', 'Appointment']}>
        {appointed.map((seat) => (
          <tr key={seat.roleId}>
            <Td className="font-bold">{seat.roleName}</Td>
            <Td>{holderName(seat) ?? <Pill tone="redOutline">Vacant</Pill>}</Td>
            <Td>{seat.holder?.since ? formatFullDate(seat.holder.since) : '–'}</Td>
            <Td>{seat.holder ? <span className="text-xs text-muted">Seat filled</span> : <AppointControl seat={seat} data={data} act={act} buttonLabel="Appoint" />}</Td>
          </tr>
        ))}
      </Table>
    </Panel>
  );
}

function VacancyRow({ vacancy, data, act }: { vacancy: SeatVacancy; data: DeskData; act: Act }) {
  const [open, setOpen] = useState(false);
  const previous = vacancy.previous;
  return (
    <tr>
      <Td className="font-bold">{vacancy.roleName}</Td>
      <Td>{previous ? `${previous.firstName} ${previous.lastName}` : <span className="text-muted">Never filled</span>}</Td>
      <Td>
        {previous ? (
          <span className="flex flex-wrap items-center gap-2">
            {formatFullDate(previous.endDate)}
            {previous.exitReason === 'Abdicated' ? <Pill tone="red">Abdicated</Pill> : previous.exitReason ? <Pill tone="outline">Term concluded</Pill> : null}
          </span>
        ) : (
          '–'
        )}
      </Td>
      <Td>
        {open ? (
          <AppointControl seat={vacancy} data={data} act={act} buttonLabel="Confirm appointment" />
        ) : (
          <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
            Appoint Replacement
          </Button>
        )}
      </Td>
    </tr>
  );
}

function VacanciesLedger({ data, act }: { data: DeskData; act: Act }) {
  const trustees = data.vacancies.filter((v) => v.kind === 'trustee');
  return (
    <Panel title="Mid-Year Vacancies Ledger">
      <p className="mb-3 text-xs text-muted">Empty or abdicated trustee seats. A replacement serves the remainder of the term.</p>
      {trustees.length ? (
        <Table caption="Vacant trustee seats" head={['Seat', 'Last held by', 'Left', 'Action']}>
          {trustees.map((v) => (
            <VacancyRow key={v.roleId} vacancy={v} data={data} act={act} />
          ))}
        </Table>
      ) : (
        <Empty>All three trustee seats are filled.</Empty>
      )}
    </Panel>
  );
}

/** The confirmation that names who moves to which chair; Escape or Cancel backs out. */
function RotateChairsDialog({
  seats,
  newGrandKnightId,
  names,
  onCancel,
  onConfirm,
}: {
  seats: OfficerSeat[];
  newGrandKnightId: number;
  names: ReadonlyMap<number, string>;
  onCancel: () => void;
  onConfirm: () => Promise<void>;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    box.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onCancel();
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      previous?.focus();
    };
  }, [onCancel]);

  let plan: ReturnType<typeof planConclusionFromSeats> | null = null;
  let refusal: string | null = null;
  try {
    plan = planConclusionFromSeats(seats, newGrandKnightId);
  } catch (err) {
    refusal = describeError(err);
  }
  const nameOf = (id: number) => names.get(id) ?? `Member ${id}`;
  const moves = plan ? chairMoves(plan.transitions) : [];
  const vacated = plan ? plan.transitions.filter((t) => t.to === null).map((t) => t.roleName) : [];

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-navy/60 p-4">
      <div
        ref={box}
        tabIndex={-1}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="rotate-title"
        aria-describedby="rotate-body"
        className="flex w-full max-w-lg flex-col gap-4 rounded border-t-8 border-gold bg-white p-6 shadow-xl"
      >
        <h2 id="rotate-title" className="font-serif text-xl font-bold">
          Conclude the fraternal year?
        </h2>
        <div id="rotate-body" className="flex flex-col gap-3 text-sm">
          {refusal ? (
            <Notice tone="error">{refusal}</Notice>
          ) : moves.length === 0 ? (
            <p>
              The Grand Knight seat was not on this year&apos;s ballot, so every chair stays as it is: {nameOf(newGrandKnightId)} continues as Grand
              Knight and no trustee moves. The ballot switches are cleared for the next cycle.
            </p>
          ) : (
            <>
              <p>{plan?.rotated ? 'The chairs rotate as follows:' : 'The Grand Knight is re-elected; the trustees stay in their chairs:'}</p>
              <ul className="flex flex-col gap-1 rounded border border-line p-3">
                {moves.map((m) => (
                  <li key={m.memberId}>
                    <span className="font-bold">{nameOf(m.memberId)}</span>:{' '}
                    {m.from === m.to
                      ? `${m.to} (term renewed)`
                      : `${m.from ?? 'joins the board'} → ${m.to ?? 'leaves the board'}`}
                  </li>
                ))}
              </ul>
              {vacated.length ? <p className="text-xs text-muted">Left vacant for appointment: {vacated.join(', ')}.</p> : null}
              <p className="text-xs text-muted">Every departure is closed as Term Concluded in the leadership history, and the ballot switches are cleared.</p>
            </>
          )}
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          {refusal ? null : (
            <Button
              variant="danger"
              disabled={busy}
              onClick={() => {
                setBusy(true);
                void onConfirm().finally(() => setBusy(false));
              }}
            >
              {busy ? 'Rotating…' : 'Rotate chairs'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function ConclusionSummary({ result, names }: { result: FraternalYearConclusion; names: ReadonlyMap<number, string> }) {
  const nameOf = (id: number | null) => (id === null ? 'vacant' : (names.get(id) ?? `Member ${id}`));
  return (
    <Table caption="Seats changed by the conclusion" head={['Seat', 'Before', 'After']}>
      {result.changes.map((c) => (
        <tr key={c.roleName}>
          <Td className="font-bold">{c.roleName}</Td>
          <Td>{nameOf(c.previousMemberId)}</Td>
          <Td>{nameOf(c.memberId)}</Td>
        </tr>
      ))}
    </Table>
  );
}

function FraternalYearSimulator({ data, onDone }: { data: DeskData; onDone: () => Promise<void> }) {
  const user = useUser();
  const grandKnight =data.seats.find((s) => s.roleName === GRAND_KNIGHT_ROLE);
  const [newGrandKnightId, setNewGrandKnightId] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [result, setResult] = useState<FraternalYearConclusion | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Names as they stood before the run, so the summary still reads after members change chairs.
  const names = new Map<number, string>(data.members.map((m) => [m.id, `${m.MemberFirstName} ${m.MemberLastName}`]));
  for (const s of data.seats) if (s.holder) names.set(s.holder.memberId, `${s.holder.firstName} ${s.holder.lastName}`);
  const [namesAtRun, setNamesAtRun] = useState<ReadonlyMap<number, string>>(names);

  const conclude = async () => {
    setError(null);
    try {
      const outcome = await db.elections.concludeFraternalYear(user.memberId, data.councilId, Number(newGrandKnightId));
      setNamesAtRun(names);
      setResult(outcome);
      setNewGrandKnightId('');
      await onDone();
    } catch (err) {
      setError(describeError(err));
    } finally {
      setConfirming(false);
    }
  };

  return (
    <section aria-labelledby="simulator-title" className="rounded border-2 border-dashed border-brand-red bg-white">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-2">
        <h2 id="simulator-title" className="font-serif text-lg font-bold">
          Demo simulator: conclude the fraternal year
        </h2>
        <Pill tone="redOutline">In-memory demo data · Super Admin only</Pill>
      </header>
      <div className="flex flex-col gap-3 p-4">
        <p className="text-sm">
          Runs the real year-end rotation against this browser tab&apos;s demo database. Grand Knight seat on this year&apos;s ballot:{' '}
          <span className="font-bold">{grandKnight?.ballot?.IsUpForElection === 1 ? 'yes, so the trustee ladder climbs' : 'no, so every chair stays put'}</span>.
          {grandKnight?.ballot?.IsUpForElection === 1 ? null : ' Open it under Council Lookup Tables, Officer Election Parameters.'}
        </p>
        {error ? (
          <Notice tone="error" onDismiss={() => setError(null)}>
            {error}
          </Notice>
        ) : null}
        <div className="flex flex-wrap items-center gap-3">
          <MemberSelect members={data.members} value={newGrandKnightId} onChange={setNewGrandKnightId} label="Incoming Grand Knight" />
          <Button variant="danger" disabled={newGrandKnightId === ''} onClick={() => setConfirming(true)}>
            Simulate Concluding Fraternal Year (Rotate Chairs)
          </Button>
        </div>
        {result ? (
          <div className="flex flex-col gap-2">
            <Notice tone="info" onDismiss={() => setResult(null)}>
              Fraternal year concluded. {result.rotated ? 'The chairs rotated' : 'No chairs moved'}; new terms start in {result.fraternalYear}, and{' '}
              {result.ballotsReset} ballot switch{result.ballotsReset === 1 ? ' was' : 'es were'} cleared. The {result.closingMetrics.fraternalYear} closing
              metrics ({result.closingMetrics.volunteerHours.total} volunteer hours, {result.closingMetrics.officers.length} officer terms) are saved in that
              year&apos;s Council History annals.
            </Notice>
            {result.changes.length ? <ConclusionSummary result={result} names={namesAtRun} /> : null}
          </div>
        ) : null}
      </div>
      {confirming ? (
        <RotateChairsDialog
          seats={data.seats}
          newGrandKnightId={Number(newGrandKnightId)}
          names={names}
          onCancel={() => setConfirming(false)}
          onConfirm={conclude}
        />
      ) : null}
    </section>
  );
}

function AppointmentsDesk() {
  const user = useUser();
  const scope = useCouncilScope();
  const councilId = scope.councilId;
  const data = useLoad(async (): Promise<DeskData> => {
    const [seats, vacancies, members] = await Promise.all([
      db.elections.listOfficerSeats(councilId),
      db.elections.listVacancies(councilId),
      db.members.listByCouncil(councilId, { activeOnly: true }),
    ]);
    return { councilId, seats, vacancies, members };
  }, [councilId]);
  const [message, setMessage] = useState<{ tone: 'error' | 'info'; text: string } | null>(null);

  const act: Act = async (action) => {
    setMessage(null);
    try {
      setMessage({ tone: 'info', text: await action() });
      await data.reload();
      return true;
    } catch (err) {
      setMessage({ tone: 'error', text: describeError(err) });
      return false;
    }
  };

  return (
    <>
      <PageTitle actions={<CouncilSelect scope={scope} />}>Appointed Leadership Matrix</PageTitle>
      {message ? (
        <div className="mb-4">
          <Notice tone={message.tone} onDismiss={() => setMessage(null)}>
            {message.text}
          </Notice>
        </div>
      ) : null}
      {data.error ? <Notice tone="error">{data.error}</Notice> : null}
      {data.data ? (
        <div className="flex flex-col gap-4">
          <AppointedPositionsTracker data={data.data} act={act} />
          <VacanciesLedger data={data.data} act={act} />
          {IS_MEMORY_DRIVER && isSuperAdmin(user) ? <FraternalYearSimulator key={councilId} data={data.data} onDone={data.reload} /> : null}
        </div>
      ) : data.error ? null : (
        <p className="text-sm text-muted">Loading the council&apos;s offices…</p>
      )}
    </>
  );
}

export default function AppointmentsPage() {
  return (
    <RequireArea area="elections/appointments">
      <AppointmentsDesk />
    </RequireArea>
  );
}
