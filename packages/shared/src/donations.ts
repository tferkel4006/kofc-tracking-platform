// =========================================================================
// DONATION STREAM SESSION
// Specifications: "When recording donations for an event you should only have to
// specify the event for the first donation, all subsequent donations should be
// associated with the event until the person indicates the event is over ...
// click Start Accepting Donations, enter in default amount and description."
//
// A framework-neutral controller: the phone screen renders `state` and calls
// start / record / stop. While a session is active every recorded donation is
// pinned to its EventID and pre-filled from the session defaults; after stop()
// donations are standalone again. State lives on this device only, so several
// members can accept donations for the same event from different phones.
// =========================================================================
import type { CouncilDonationOption, DataService, DonationMethodKind, NewDonation } from './contract';
import { EVENT_INTAKE_SESSION_STATUSES } from './finance';
import { BusinessRuleError, hasSuperAdminRights, SecurityPrivilegeError, type MemberWriteActor } from './rules';
import type { Donation, DonationType, EventIntakeSessionStatus } from './types';

/** Pre-filled values for each donation in the session; any of them can be overridden per donation. */
export interface DonationDefaults {
  amount?: number;
  donationTypeId?: number;
  description?: string;
}

/** What the member enters per donation. The council, and during a session the event, come from the controller. */
export type DonationEntry = Partial<Omit<NewDonation, 'CouncilID' | 'EventID' | 'DonationMethodID'>> &
  Pick<NewDonation, 'DonationMethodID'>;

export type DonationSessionState =
  | { active: false }
  | {
      active: true;
      eventId: number;
      eventName: string;
      defaults: DonationDefaults;
      /** Donations this device recorded in the session, and their total. */
      recordedCount: number;
      recordedTotal: number;
    };

type Listener = (state: DonationSessionState) => void;

export class DonationSessionController {
  private current: DonationSessionState = { active: false };
  private readonly listeners = new Set<Listener>();

  /** `recordedBy` is the signed-in member; every donation this controller records is stamped with it. */
  constructor(
    private readonly db: DataService,
    private readonly councilId: number,
    private readonly recordedBy: number,
  ) {}

  get state(): DonationSessionState {
    return this.current;
  }

  /** Calls `listener` on every change; returns the unsubscribe function (shape used by React's useSyncExternalStore). */
  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** "Start Accepting Donations": pins `eventId` until stop(). The event must be linked to this controller's council. */
  async start(eventId: number, defaults: DonationDefaults = {}): Promise<DonationSessionState> {
    const event = await this.db.events.get(eventId);
    if (!event) throw new BusinessRuleError('EVENT_NOT_FOUND', `No event with id ${eventId}.`, { eventId });
    const councils = await this.db.events.listCouncilIds(eventId);
    if (!councils.includes(this.councilId)) {
      throw new BusinessRuleError(
        'INVALID_INPUT',
        `"${event.EventName}" is not linked to council ${this.councilId}, so its donations cannot be recorded here.`,
        { eventId, councilId: this.councilId },
      );
    }
    return this.set({ active: true, eventId, eventName: event.EventName, defaults: { ...defaults }, recordedCount: 0, recordedTotal: 0 });
  }

  /** Changes the pre-filled values mid-session (e.g. the suggested amount). Does nothing when no session is active. */
  updateDefaults(defaults: DonationDefaults): DonationSessionState {
    if (!this.current.active) return this.current;
    return this.set({ ...this.current, defaults: { ...this.current.defaults, ...defaults } });
  }

  /** "The event is over": later donations are standalone. */
  stop(): DonationSessionState {
    return this.set({ active: false });
  }

  /** The full donation `record` would send, without sending it. */
  compose(entry: DonationEntry): NewDonation {
    const s = this.current;
    const d = s.active ? s.defaults : {};
    return {
      ...entry,
      CouncilID: this.councilId,
      EventID: s.active ? s.eventId : null,
      DonationAmount: entry.DonationAmount ?? (d.amount as number),
      DonationTypeID: entry.DonationTypeID ?? (d.donationTypeId as number),
      DonationDesciption: entry.DonationDesciption ?? d.description ?? null,
    };
  }

  /** Records one donation, auto-linked to the pinned event while a session is active. */
  async record(entry: DonationEntry): Promise<Donation> {
    const pinned = this.current.active ? this.current.eventId : null;
    const saved = await this.db.donations.record(this.recordedBy, this.compose(entry));
    // Only count it if the same session is still running (stop() may have been pressed while saving).
    if (this.current.active && this.current.eventId === pinned) {
      this.set({
        ...this.current,
        recordedCount: this.current.recordedCount + 1,
        recordedTotal: Math.round((this.current.recordedTotal + saved.DonationAmount) * 100) / 100,
      });
    }
    return saved;
  }

  private set(state: DonationSessionState): DonationSessionState {
    this.current = state;
    for (const listener of this.listeners) listener(state);
    return state;
  }
}

// =========================================================================
// HIGH-SPEED GATE INTAKE (Sprint 5Z-10)
// While an event's IntakeSessionStatus is 'Active', the phone's donation screen covers itself with two giant one-tap
// targets - cash and card - that record a donation at a preset amount with nothing typed. The phone must be pinned
// to the event (DonationSessionController), so every tap is linked to it, stamped with the member and dated today.
// =========================================================================

/** The one-tap amounts the gate overlay offers when the session has no default amount. */
export const GATE_INTAKE_AMOUNTS: readonly number[] = [5, 10, 20, 25, 50, 100];

/** The overlay's two targets: which method kind each logs, and the description stamped on the donation. */
export const GATE_INTAKE_TARGETS = {
  cash: { kind: 'cash', label: '💵 Log Cash Transaction', description: 'Gate intake: cash' },
  card: { kind: 'card', label: '💳 Log Stripe CC Swipe', description: 'Gate intake: Stripe card swipe' },
} as const satisfies Record<string, { kind: DonationMethodKind; label: string; description: string }>;

export type GateIntakeTarget = keyof typeof GATE_INTAKE_TARGETS;

/** The council's first enabled method of the target's kind (Cash, Credit Card), or null when it has none enabled. */
export const gateIntakeOption = (options: readonly CouncilDonationOption[], target: GateIntakeTarget): CouncilDonationOption | null =>
  options.find((o) => o.kind === GATE_INTAKE_TARGETS[target].kind) ?? null;

/**
 * The donation one tap records: the target's method at `amount`, the session's default donation type (or the
 * council's first type), and the target's description. Rejects INVALID_INPUT when the council has not enabled the
 * method or has no donation types.
 */
export function gateIntakeEntry(
  target: GateIntakeTarget,
  amount: number,
  options: readonly CouncilDonationOption[],
  types: readonly Pick<DonationType, 'id'>[],
  defaults: DonationDefaults,
): DonationEntry {
  const option = gateIntakeOption(options, target);
  if (!option) {
    throw new BusinessRuleError('INVALID_INPUT', `The council has not enabled a ${GATE_INTAKE_TARGETS[target].kind} donation method.`, { target });
  }
  const typeId = defaults.donationTypeId ?? types[0]?.id;
  if (typeId === undefined) throw new BusinessRuleError('INVALID_INPUT', 'The council has no donation types yet.', { target });
  return {
    DonationMethodID: option.method.id,
    DonationAmount: amount,
    DonationTypeID: typeId,
    Donor: null,
    DonationDesciption: GATE_INTAKE_TARGETS[target].description,
  };
}

/** Rejects INVALID_INPUT unless `value` is one of EVENT_INTAKE_SESSION_STATUSES. */
export function assertIntakeSessionStatus(value: unknown): EventIntakeSessionStatus {
  if ((EVENT_INTAKE_SESSION_STATUSES as readonly unknown[]).includes(value)) return value as EventIntakeSessionStatus;
  throw new BusinessRuleError('INVALID_INPUT', `An intake session is Inactive or Active; received ${JSON.stringify(value)}.`, { status: value });
}

/**
 * events.setIntakeSessionStatus: whoever takes the event's donations may open or close its gate intake - any Active
 * member of a council the event is linked to (as at the donation table), or an Active Super Admin.
 */
export function assertMayRunEventIntake(actor: MemberWriteActor, eventId: number, eventCouncilIds: readonly number[]): void {
  if (hasSuperAdminRights(actor) || (actor.active && eventCouncilIds.includes(actor.councilId))) return;
  throw new SecurityPrivilegeError(
    'COUNCIL_ACCESS_DENIED',
    `Member ${actor.memberId} of council ${actor.councilId} cannot run the gate intake of event ${eventId}; only active members of its councils can.`,
    { actorId: actor.memberId, actorCouncilId: actor.councilId, eventId },
  );
}
