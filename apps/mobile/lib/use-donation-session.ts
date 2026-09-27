import { useSyncExternalStore } from 'react';
import { DonationSessionController, type DonationSessionState } from '@kofc/shared';
import { db } from '../services/db';

// One controller per council and signed-in member for the life of the app, so a pinned event survives
// moving between screens and stays pinned until the member taps "Stop Accepting Donations". Keyed by member
// too, because each donation is stamped with the member who recorded it.
const controllers = new Map<string, DonationSessionController>();

export function donationSessionFor(councilId: number, memberId: number): DonationSessionController {
  const key = `${councilId}:${memberId}`;
  let controller = controllers.get(key);
  if (!controller) {
    controller = new DonationSessionController(db, councilId, memberId);
    controllers.set(key, controller);
  }
  return controller;
}

/** The council's donation session and its live state; re-renders whenever the session starts, records or stops. */
export function useDonationSession(
  councilId: number,
  memberId: number,
): { controller: DonationSessionController; state: DonationSessionState } {
  const controller = donationSessionFor(councilId, memberId);
  const state = useSyncExternalStore(
    (onChange) => controller.subscribe(onChange),
    () => controller.state,
  );
  return { controller, state };
}
