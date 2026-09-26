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
import type { DataService, NewDonation } from './contract';
import { BusinessRuleError } from './rules';
import type { Donation } from './types';

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

  constructor(
    private readonly db: DataService,
    private readonly councilId: number,
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
    const saved = await this.db.donations.record(this.compose(entry));
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
