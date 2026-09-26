import { useSyncExternalStore } from 'react';
import { DonationSessionController, type DonationSessionState } from '@kofc/shared';
import { db } from '../services/db';

// One controller per council for the life of the app, so a pinned event survives moving between
// screens and stays pinned until the member taps "Stop Accepting Donations".
const controllers = new Map<number, DonationSessionController>();

export function donationSessionFor(councilId: number): DonationSessionController {
  let controller = controllers.get(councilId);
  if (!controller) {
    controller = new DonationSessionController(db, councilId);
    controllers.set(councilId, controller);
  }
  return controller;
}

/** The council's donation session and its live state; re-renders whenever the session starts, records or stops. */
export function useDonationSession(councilId: number): { controller: DonationSessionController; state: DonationSessionState } {
  const controller = donationSessionFor(councilId);
  const state = useSyncExternalStore(
    (onChange) => controller.subscribe(onChange),
    () => controller.state,
  );
  return { controller, state };
}
